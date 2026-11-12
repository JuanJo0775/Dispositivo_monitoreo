/**
 * Bastón simulado fiel al contrato ESP32 ↔ App v0.1.
 *
 * Este módulo es el lado del bastón: habla el mismo protocolo que el
 * firmware real —tramas con CRC-16, líneas CSV del contrato, MTU negociada,
 * configuración cifrada guardada en memoria no volátil— sobre un transporte
 * falso. Vive en `src/infrastructure/` porque conoce detalles de hardware
 * (microSD, GPS, batería) que el dominio no debe conocer.
 *
 * Lo que simula:
 *
 * - microSD con registros numerados consecutivamente desde 1;
 * - bloque de sincronización del tamaño que permite la MTU negociada, con
 *   fragmentación cuando un registro no cabe entero;
 * - CRC calculable y alterable a propósito;
 * - corte de conexión a mitad de una transferencia;
 * - firmware y versión de protocolo declarados (un cambio mayor bloquea);
 * - batería, estado de la microSD, señal del GPS, hora UTC y contador de
 *   registros;
 * - configuración de sesión en memoria no volátil simulada: sobrevive a un
 *   reinicio y se aplica a todas las capturas siguientes.
 */

import {
  isBleCharacteristicKey,
  PROTOCOL_VERSION,
  type BleCharacteristicKey,
} from '@/domain/protocol/ble-profile';
import {
  crc16,
  decodeFrame,
  encodeFrame,
  FRAME_HEADER_BYTES,
  Opcode,
} from '@/domain/protocol/frame';
import {
  bitsFromFlags,
  encodeRecord,
  parseRecordHeader,
  RECORD_HEADERS,
  type StickRecord,
} from '@/domain/protocol/record-codec';
import { createEncryptor, deriveKey, type PayloadEncryptor } from '@/domain/protocol/encryption';
import type { CaptureFlags } from '@/domain/capture/types';
import type { SessionConfig } from '@/domain/session/types';
import type { RandomBytes } from '@/ports/random-bytes';

/** MTU por defecto del simulador (la que negocia Android con el ESP32). */
export const DEFAULT_MTU = 185;

/** MTU máxima que el simulador acepta negociar. */
export const MAX_MTU = 517;

/** MTU mínima del enlace BLE. */
export const MIN_MTU = 23;

/** PIN por defecto del simulador, para que las pruebas sean deterministas. */
export const DEFAULT_SIMULATED_PIN = '000000';

/** Sal fija del simulador, para que las pruebas sean deterministas. */
export const DEFAULT_SIMULATED_SALT: Uint8Array = new Uint8Array([
  0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00,
]);

/** Hora UTC por defecto del simulador. */
export const DEFAULT_SIMULATED_UTC = '2026-11-12T15:00:00.000Z';

/** Por debajo de este valor la batería se reporta como baja. */
export const LOW_BATTERY_PCT = 20;

/** Estado del almacenamiento microSD del bastón. */
export type MicroSdStatus = 'ok' | 'full' | 'error';

/** Señal del GPS del bastón. */
export interface StickGpsStatus {
  /** Satélites visibles. */
  readonly sats: number | null;
  /** Dilución horizontal de precisión. */
  readonly hdop: number | null;
  /** Hay fix válido. */
  readonly fix: boolean;
}

/** Lecturas de los sensores que el bastón pone en cada registro. */
export interface StickSensors {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitudeM: number;
  readonly speedKmh: number;
  readonly fixAgeS: number;
  readonly depthCm: number;
  readonly humidityPct: number;
  readonly temperatureC: number;
  readonly ph: number;
  readonly ecUsCm: number;
  readonly nMgKg: number;
  readonly pMgKg: number;
  readonly kMgKg: number;
}

/** Estado completo del bastón: es el cuerpo del mensaje Estado. */
export interface StickDeviceStatus {
  /** Batería en porcentaje. */
  readonly batteryPct: number;
  /** La batería está por debajo del umbral. */
  readonly lowBattery: boolean;
  /** Estado de la microSD. */
  readonly microSd: MicroSdStatus;
  /** Señal del GPS. */
  readonly gps: StickGpsStatus;
  /** Versión del firmware del bastón. */
  readonly firmwareVersion: string;
  /** Versión mayor del protocolo que habla el bastón. */
  readonly protocolVersion: number;
  /** Hora UTC del bastón, ISO 8601. */
  readonly utcTime: string;
  /** Registros que hay en la microSD. */
  readonly recordCount: number;
  /** Registros que todavía no se han confirmado. */
  readonly pendingCount: number;
  /** Configuración activa; 0 si el bastón no tiene ninguna. */
  readonly configId: number;
}

/** Motivo por el que el bastón rechaza una configuración. */
export type ConfigWriteReason =
  | 'crc_invalido'
  | 'clave_incorrecta'
  | 'formato_invalido'
  | 'version_incompatible'
  | 'no_emparejado';

/** Estado de la configuración: es el cuerpo del mensaje Configuración · estado. */
export interface StickConfigStatus {
  /** La última escritura quedó aceptada. */
  readonly aceptada: boolean;
  /** Motivo del rechazo, si lo hubo. */
  readonly motivo: ConfigWriteReason | null;
  /** Identificador de la configuración activa; 0 si no hay. */
  readonly configId: number;
  /** Configuración activa. */
  readonly config: SessionConfig | null;
}

/** Bloque de sincronización que el bastón envía en Sync · datos. */
export interface StickSyncBlock {
  /** Primer id del bloque. */
  readonly desde: number;
  /** Último id del bloque, inclusive. */
  readonly hasta: number;
  /** Fragmento 1..n de este bloque. */
  readonly fragmento: number;
  /** Cuántos fragmentos tiene el bloque. */
  readonly fragmentos: number;
  /** Texto CSV del fragmento: las líneas de los registros, separadas por \n. */
  readonly texto: string;
}

/** Cuerpo del mensaje Sync · solicitud. */
export interface SyncRequestBody {
  /** Id del primer registro que la app quiere. */
  readonly desde: number;
}

/** Cuerpo del mensaje Sync · datos. */
export interface SyncDataBody {
  readonly desde: number;
  readonly hasta: number;
  readonly fragmento: number;
  readonly fragmentos: number;
  readonly texto: string;
}

/** Cuerpo del mensaje Sync · confirmación. */
export interface SyncConfirmationBody {
  /** Último id recibido y guardado por la app. */
  readonly ultimoId: number;
}

/** Cuerpo del mensaje Configuración · estado. */
export interface ConfigStatusBody {
  readonly aceptada: boolean;
  readonly motivo: ConfigWriteReason | null;
  readonly configId: number;
  readonly cultivo: string | null;
  readonly lote: string | null;
  readonly profundidadCm: number | null;
}

/** Cuerpo del mensaje Resumen · escritura (cifrado). */
export interface SummaryBody {
  /** Hasta dos líneas para la OLED. */
  readonly lineas: readonly string[];
}

/** Cuerpo del mensaje Control · escritura (cifrado). */
export interface ControlBody {
  /** Qué pide la app: `capturar` o `fijar-hora`. */
  readonly accion: 'capturar' | 'fijar-hora';
  /** Hora UTC a fijar, en ISO 8601; solo para `fijar-hora`. */
  readonly horaUtc?: string;
}

/** Cuerpo del mensaje Estado. */
export interface StatusBody {
  readonly batteryPct: number;
  readonly lowBattery: boolean;
  readonly microSd: MicroSdStatus;
  readonly sats: number | null;
  readonly hdop: number | null;
  readonly fix: boolean;
  readonly firmwareVersion: string;
  readonly protocolVersion: number;
  readonly utcTime: string;
  readonly recordCount: number;
  readonly pendingCount: number;
  readonly configId: number;
}

/** Eventos que emite el bastón hacia el transporte. */
export type SimulatedStickDeviceEvent =
  | {
      readonly type: 'notify';
      readonly characteristic: BleCharacteristicKey;
      readonly bytes: Uint8Array;
    }
  | { readonly type: 'disconnected'; readonly reason: string }
  | { readonly type: 'error'; readonly error: Error };

/** Suscriptor de los eventos del bastón. */
export type SimulatedStickDeviceListener = (event: SimulatedStickDeviceEvent) => void;

/**
 * Cifrado de la carga útil del bastón.
 *
 * Es el mismo del dominio (`src/domain/protocol/encryption.ts`): XChaCha20-
 * Poly1305 con la clave derivada del PIN y la sal de emparejamiento. El
 * simulador solo decide con qué clave y con qué fuente de bytes aleatorios
 * trabaja, para que sus pruebas sean deterministas.
 */
export type StickPayloadCipher = PayloadEncryptor;

/** Opciones de construcción del bastón simulado. */
export interface SimulatedStickDeviceOptions {
  /** Identificador del bastón; es el `device_id` de los registros. */
  readonly deviceId?: string;
  /** Nombre que anuncia por BLE. */
  readonly name?: string;
  /** Intensidad de señal simulada. */
  readonly rssi?: number;
  /** Versión del firmware que declara el bastón. */
  readonly firmwareVersion?: string;
  /** Versión mayor del protocolo que habla el bastón. */
  readonly protocolVersion?: number;
  /** Batería inicial, en porcentaje. */
  readonly batteryPct?: number;
  /** MTU inicial. */
  readonly mtu?: number;
  /** MTU máxima que el bastón acepta negociar. */
  readonly maxMtu?: number;
  /** PIN con el que se deriva la clave de la carga útil. */
  readonly pin?: string;
  /** Sal con la que se deriva la clave. */
  readonly salt?: Uint8Array;
  /** Fuente de bytes aleatorios para los nonces del sobre cifrado. */
  readonly random?: RandomBytes;
  /** Cifrado de la carga útil; por defecto el del dominio. */
  readonly cipher?: StickPayloadCipher;
  /** Estado inicial de la microSD. */
  readonly microSd?: MicroSdStatus;
  /** Señal inicial del GPS. */
  readonly gps?: Partial<StickGpsStatus>;
  /** Hora UTC inicial del bastón. */
  readonly utcTime?: string;
  /** Lecturas iniciales de los sensores. */
  readonly sensors?: Partial<StickSensors>;
  /** Si el bastón aparece en el escaneo. */
  readonly visible?: boolean;
}

/** Lecturas por defecto: las del corte 0, para no cambiar lo que ya se probó. */
const DEFAULT_SENSORS: StickSensors = {
  latitude: 4.5339,
  longitude: -75.6811,
  altitudeM: 1550,
  speedKmh: 0.4,
  fixAgeS: 1.2,
  depthCm: 20,
  humidityPct: 38,
  temperatureC: 21.5,
  ph: 5.4,
  ecUsCm: 120,
  nMgKg: 12,
  pMgKg: 18,
  kMgKg: 95,
};

/** Configuración vacía: el bastón arranca sin configurar. */
const EMPTY_CONFIG_STATUS: StickConfigStatus = {
  aceptada: false,
  motivo: null,
  configId: 0,
  config: null,
};

/**
 * Claves ya derivadas, por PIN y sal.
 *
 * Derivar la clave cuesta 100.000 iteraciones de PBKDF2 y las pruebas crean
 * muchos bastones: la caché los mantiene rápidas sin cambiar el resultado.
 */
const clavesDerivadas = new Map<string, Uint8Array>();

/**
 * Bastón simulado: microSD, GPS, batería, configuración persistida y un
 * transporte de eventos para el transporte falso.
 */
export class SimulatedStickDevice {
  /** Identificador del bastón. */
  readonly deviceId: string;

  /** Nombre que anuncia por BLE. */
  readonly name: string;

  /** Intensidad de señal simulada. */
  readonly rssi: number;

  private firmwareVersion: string;

  private protocolVersion: number;

  private battery: number;

  private microSdState: MicroSdStatus;

  private gpsState: StickGpsStatus;

  private utcTime: string;

  private sensors: StickSensors;

  private mtu: number;

  private readonly maxMtu: number;

  private readonly cipherValue: StickPayloadCipher;

  private visible: boolean;

  /** microSD: los registros que el bastón tiene guardados. */
  private readonly records: StickRecord[] = [];

  /** Último id confirmado por la app; lo confirmado ya se borró. */
  private confirmedId = 0;

  /** Memoria no volátil simulada: la configuración de sesión. */
  private activeConfigValue: SessionConfig | null = null;

  /** Resultado de la última escritura de configuración. */
  private configState: StickConfigStatus = EMPTY_CONFIG_STATUS;

  /** Resumen que el bastón muestra en la OLED. */
  private summary: string[] = [];

  /** El próximo bloque de sincronización sale con el CRC alterado. */
  private invalidCrcOnNextBlock = false;

  /** La próxima sincronización se corta a mitad de la transferencia. */
  private disconnectOnNextSync = false;

  private readonly listeners = new Set<SimulatedStickDeviceListener>();

  constructor(options: SimulatedStickDeviceOptions = {}) {
    this.deviceId = options.deviceId ?? 'simulated-stick';
    this.name = options.name ?? 'Bastón simulado';
    this.rssi = options.rssi ?? -55;
    this.firmwareVersion = options.firmwareVersion ?? '0.1.0';
    this.protocolVersion = options.protocolVersion ?? PROTOCOL_VERSION;
    this.battery = options.batteryPct ?? 82;
    this.microSdState = options.microSd ?? 'ok';
    this.gpsState = {
      sats: options.gps?.sats ?? 9,
      hdop: options.gps?.hdop ?? 0.9,
      fix: options.gps?.fix ?? true,
    };
    this.utcTime = options.utcTime ?? DEFAULT_SIMULATED_UTC;
    this.sensors = { ...DEFAULT_SENSORS, ...options.sensors };
    this.maxMtu = options.maxMtu ?? MAX_MTU;
    this.mtu = clampMtu(options.mtu ?? DEFAULT_MTU, MIN_MTU, this.maxMtu);
    this.visible = options.visible ?? true;
    this.cipherValue =
      options.cipher ??
      createStickCipher(
        options.pin ?? DEFAULT_SIMULATED_PIN,
        options.salt ?? DEFAULT_SIMULATED_SALT,
        options.random ?? deterministicRandomBytes(),
      );
  }

  // ---------------------------------------------------------------- estado

  /** Estado completo del bastón. */
  status(): StickDeviceStatus {
    return {
      batteryPct: this.battery,
      lowBattery: this.battery < LOW_BATTERY_PCT,
      microSd: this.microSdState,
      gps: this.gpsState,
      firmwareVersion: this.firmwareVersion,
      protocolVersion: this.protocolVersion,
      utcTime: this.utcTime,
      recordCount: this.records.length,
      pendingCount: this.pendingRecords().length,
      configId: this.activeConfigValue?.configId ?? 0,
    };
  }

  /** Cambia la batería del bastón. */
  setBatteryPct(value: number): void {
    this.battery = value;
  }

  /** Cambia la versión de firmware que declara el bastón. */
  setFirmwareVersion(value: string): void {
    this.firmwareVersion = value;
  }

  /** Cambia el estado de la microSD (por ejemplo, a `full`). */
  setMicroSdStatus(value: MicroSdStatus): void {
    this.microSdState = value;
  }

  /** Cambia la señal del GPS simulada. */
  setGpsStatus(value: Partial<StickGpsStatus>): void {
    this.gpsState = { ...this.gpsState, ...value };
  }

  /**
   * Cambia la versión del protocolo que declara el bastón.
   *
   * Con una versión mayor que la de la app, el bastón rechaza el enlace.
   */
  setProtocolVersion(value: number): void {
    this.protocolVersion = value;
  }

  /** Muestra u oculta el bastón en el escaneo. */
  setVisible(value: boolean): void {
    this.visible = value;
  }

  /** Si el bastón aparece en el escaneo. */
  isVisible(): boolean {
    return this.visible;
  }

  /** Hora UTC del bastón. */
  getTime(): string {
    return this.utcTime;
  }

  /** Fija la hora UTC del bastón. */
  setTime(value: string): void {
    this.utcTime = value;
  }

  /** MTU negociada con la app. */
  negotiatedMtu(): number {
    return this.mtu;
  }

  /**
   * Negocia la MTU: el bastón acepta la que pide la app, sin pasarse de su
   * máximo, y devuelve la efectiva.
   */
  negotiateMtu(requested: number): number {
    this.mtu = clampMtu(requested, MIN_MTU, this.maxMtu);
    return this.mtu;
  }

  // -------------------------------------------------------------- microSD

  /**
   * Siembra registros de prueba en la microSD.
   *
   * Los ids se renumeran consecutivamente desde 1, como en el archivo real
   * del bastón. Devuelve los registros ya guardados.
   */
  seedRecords(records: readonly StickRecord[]): StickRecord[] {
    this.records.length = 0;
    records.forEach((record, index) => {
      this.records.push({ ...record, idRegistro: index + 1 });
    });
    return this.records.map((record) => ({ ...record }));
  }

  /**
   * Siembra la microSD con el contenido de un CSV del contrato (con
   * encabezado). Los ids se renumeran consecutivamente desde 1.
   */
  seedCsv(contents: string): StickRecord[] {
    return this.seedRecords(parseRecordHeader(contents));
  }

  /** Registros que la app todavía no ha confirmado. */
  pendingRecords(): StickRecord[] {
    return this.records
      .filter((record) => (record.idRegistro ?? 0) > this.confirmedId)
      .map((record) => ({ ...record }));
  }

  /** Todos los registros que hay en la microSD. */
  allRecords(): StickRecord[] {
    return this.records.map((record) => ({ ...record }));
  }

  /** Número de registros guardados en la microSD. */
  recordCount(): number {
    return this.records.length;
  }

  /** El archivo de la microSD tal como queda: encabezado y líneas del contrato. */
  microSdCsv(): string {
    const lines = this.records.map((record) => encodeRecord(record));
    return [RECORD_HEADERS.join(','), ...lines].join('\n');
  }

  /** Último id confirmado por la app. */
  lastConfirmedSequence(): number {
    return this.confirmedId;
  }

  /**
   * Confirma el último id recibido y guardado: recién entonces el bastón
   * borra los registros que ya no necesita.
   */
  confirm(lastId: number): void {
    if (!Number.isFinite(lastId) || lastId <= this.confirmedId) {
      return;
    }

    this.confirmedId = Math.trunc(lastId);
    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      const id = this.records[index]?.idRegistro ?? 0;
      if (id <= this.confirmedId) {
        this.records.splice(index, 1);
      }
    }
  }

  // -------------------------------------------------------------- captura

  /**
   * Toma una captura: arma el registro con las lecturas del momento y la
   * configuración activa, lo guarda en la microSD y lo anuncia en la
   * característica Captura.
   */
  captureNow(): StickRecord {
    if (this.microSdState === 'full') {
      throw new Error('La microSD del bastón está llena: no se puede guardar el registro.');
    }

    if (this.microSdState === 'error') {
      throw new Error('La microSD del bastón no responde: no se puede guardar el registro.');
    }

    const config = this.activeConfigValue;
    const id = this.nextRecordId();
    const flags: CaptureFlags = {
      positionValid: this.gpsState.fix,
      recentFix: this.gpsState.fix,
      probeOk: true,
      ecOverThreshold: false,
      timeValid: true,
      simulated: true,
    };

    const record: StickRecord = {
      idRegistro: id,
      deviceId: this.deviceId,
      fecha: fechaUtc(this.utcTime),
      horaUtc: horaUtc(this.utcTime),
      lat: this.sensors.latitude,
      lon: this.sensors.longitude,
      altM: this.sensors.altitudeM,
      velKmh: this.sensors.speedKmh,
      sats: this.gpsState.sats,
      hdop: this.gpsState.hdop,
      edadFixS: this.sensors.fixAgeS,
      profCm: config?.depthCm ?? this.sensors.depthCm,
      configId: config?.configId ?? 0,
      cultivo: config?.cropPrimary ?? null,
      loteId: config?.plotId ?? null,
      fertFecha: config?.lastFertilizationDate ?? null,
      humedadPct: this.sensors.humidityPct,
      tempC: this.sensors.temperatureC,
      ph: this.sensors.ph,
      ceUsCm: this.sensors.ecUsCm,
      nMgKg: this.sensors.nMgKg,
      pMgKg: this.sensors.pMgKg,
      kMgKg: this.sensors.kMgKg,
      banderas: bitsFromFlags(flags),
      batPct: this.battery,
      fwVer: this.firmwareVersion,
    };

    this.records.push(record);
    this.emitNotify('captura', encodeFrame(Opcode.Captura, encodeUtf8(encodeRecord(record))));

    return { ...record };
  }

  // -------------------------------------------------------- configuración

  /** Configuración activa del bastón. */
  activeConfig(): SessionConfig | null {
    return this.activeConfigValue ? { ...this.activeConfigValue } : null;
  }

  /** Resultado de la última escritura de configuración. */
  configStatus(): StickConfigStatus {
    return { ...this.configState };
  }

  /**
   * Guarda la configuración de sesión en la memoria no volátil simulada.
   *
   * Es el camino directo (sin cifrar) que usa el gateway del corte 0; por el
   * BLE la configuración llega cifrada en `handleWrite`.
   */
  writeSessionConfig(config: SessionConfig): StickConfigStatus {
    const motivo = validateSessionConfig(config);

    if (motivo !== null) {
      this.configState = {
        aceptada: false,
        motivo,
        configId: this.activeConfigValue?.configId ?? 0,
        config: this.activeConfigValue,
      };
      return this.configStatus();
    }

    this.activeConfigValue = { ...config };
    this.configState = {
      aceptada: true,
      motivo: null,
      configId: config.configId,
      config: { ...config },
    };

    return this.configStatus();
  }

  // -------------------------------------------------------------- control

  /** Resumen que el bastón muestra en la OLED. */
  oledSummary(): string[] {
    return [...this.summary];
  }

  /** Fija el resumen de la OLED. */
  setOledSummary(lines: readonly string[]): void {
    this.summary = lines.slice(0, 2).map((line) => line);
  }

  // --------------------------------------------------------- sincronización

  /**
   * Bloques de sincronización que el bastón enviaría desde `desde`.
   *
   * Cada bloque cabe en la MTU negociada; si un registro no cabe entero, se
   * fragmenta y cada fragmento lleva su propio CRC.
   */
  buildSyncBlocks(desde: number): StickSyncBlock[] {
    const maxBody = Math.max(1, this.mtu - FRAME_HEADER_BYTES);
    const pendientes = this.pendingRecords().filter((record) => (record.idRegistro ?? 0) >= desde);
    const bloques: StickSyncBlock[] = [];

    let lineas: string[] = [];
    let primero = 0;
    let ultimo = 0;

    const cerrar = (): void => {
      if (lineas.length === 0) {
        return;
      }

      bloques.push({
        desde: primero,
        hasta: ultimo,
        fragmento: 1,
        fragmentos: 1,
        texto: lineas.join('\n'),
      });
      lineas = [];
    };

    for (const record of pendientes) {
      const id = record.idRegistro ?? 0;
      const linea = encodeRecord(record);
      const candidatas = [...lineas, linea];

      if (this.syncBodySize(candidatas.join('\n'), primero || id, id) <= maxBody) {
        if (lineas.length === 0) {
          primero = id;
        }

        lineas = candidatas;
        ultimo = id;
        continue;
      }

      cerrar();

      if (this.syncBodySize(linea, id, id) <= maxBody) {
        primero = id;
        ultimo = id;
        lineas = [linea];
        continue;
      }

      bloques.push(...this.fragmentar(id, id, linea, maxBody));
    }

    cerrar();

    return bloques;
  }

  // --------------------------------------------------------------- fallos

  /** El próximo bloque de sincronización sale con el CRC alterado. */
  injectInvalidCrcOnNextSyncBlock(): void {
    this.invalidCrcOnNextBlock = true;
  }

  /** La próxima sincronización se corta a mitad de la transferencia. */
  injectDisconnectOnNextSync(): void {
    this.disconnectOnNextSync = true;
  }

  // ------------------------------------------------------------- reinicio

  /**
   * Reinicia el bastón.
   *
   * La microSD y la configuración de sesión sobreviven (están en la memoria no
   * volátil simulada); el estado volátil se reinicia.
   */
  restart(): void {
    this.invalidCrcOnNextBlock = false;
    this.disconnectOnNextSync = false;
    this.configState = this.activeConfigValue
      ? {
          aceptada: true,
          motivo: null,
          configId: this.activeConfigValue.configId,
          config: { ...this.activeConfigValue },
        }
      : EMPTY_CONFIG_STATUS;
  }

  // -------------------------------------------------------------- eventos

  /** Se suscribe a los eventos del bastón. */
  onEvent(listener: SimulatedStickDeviceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Cifrado de la carga útil que usa el bastón. */
  cipher(): StickPayloadCipher {
    return this.cipherValue;
  }

  /** Cifra un cuerpo con la clave del bastón, como lo haría la app. */
  encryptPayload(body: Uint8Array): Uint8Array {
    return this.cipherValue.encrypt(body);
  }

  // ------------------------------------------------------- camino por BLE

  /**
   * Recibe una escritura BLE y responde en la característica que toque.
   *
   * Nunca lanza: un mensaje corrupto o una versión incompatible se reportan
   * como error y el bastón sigue funcionando.
   */
  handleWrite(key: string, bytes: Uint8Array): void {
    if (!isBleCharacteristicKey(key)) {
      this.emitError(new Error(`Característica desconocida del contrato: ${key}.`));
      return;
    }

    const incompatible = this.protocolIncompatibility();
    if (incompatible !== null) {
      if (key === 'configEscritura') {
        this.setConfigRejected('version_incompatible');
      }

      this.emitError(incompatible);
      return;
    }

    switch (key) {
      case 'configEscritura':
        this.handleConfigWrite(bytes);
        return;
      case 'syncSolicitud':
        this.handleSyncRequest(bytes);
        return;
      case 'syncConfirmacion':
        this.handleSyncConfirmation(bytes);
        return;
      case 'resumenEscritura':
        this.handleSummaryWrite(bytes);
        return;
      case 'controlEscritura':
        this.handleControlWrite(bytes);
        return;
      default:
        this.emitError(new Error(`La característica ${key} no admite escritura.`));
    }
  }

  /** Anuncia el estado del bastón en la característica Estado. */
  notifyStatus(): void {
    const status = this.status();
    const body: StatusBody = {
      batteryPct: status.batteryPct,
      lowBattery: status.lowBattery,
      microSd: status.microSd,
      sats: status.gps.sats,
      hdop: status.gps.hdop,
      fix: status.gps.fix,
      firmwareVersion: status.firmwareVersion,
      protocolVersion: status.protocolVersion,
      utcTime: status.utcTime,
      recordCount: status.recordCount,
      pendingCount: status.pendingCount,
      configId: status.configId,
    };

    this.emitNotify(
      'estado',
      encodeFrameWithVersion(Opcode.Estado, encodeUtf8(JSON.stringify(body)), this.protocolVersion),
    );
  }

  /**
   * Comprueba la versión del protocolo.
   *
   * Un cambio mayor de versión bloquea el enlace (RF-APP-006).
   */
  assertProtocolCompatible(): void {
    const incompatible = this.protocolIncompatibility();
    if (incompatible !== null) {
      throw incompatible;
    }
  }

  // ------------------------------------------------------------- internos

  private protocolIncompatibility(): Error | null {
    if (this.protocolVersion === PROTOCOL_VERSION) {
      return null;
    }

    return new Error(
      `Versión de protocolo incompatible: el bastón habla la versión ${this.protocolVersion} y la app la versión ${PROTOCOL_VERSION}.`,
    );
  }

  private handleConfigWrite(bytes: Uint8Array): void {
    let body: Uint8Array;

    try {
      body = decodeFrame(bytes).body;
    } catch (error) {
      this.setConfigRejected('crc_invalido');
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    let plain: Uint8Array;

    try {
      plain = this.cipherValue.decrypt(body);
    } catch (error) {
      this.setConfigRejected('clave_incorrecta');
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    let config: SessionConfig;

    try {
      config = readSessionConfig(decodeUtf8(plain));
    } catch (error) {
      this.setConfigRejected('formato_invalido');
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const status = this.writeSessionConfig(config);
    this.notifyConfigStatus(status);
  }

  private handleSyncRequest(bytes: Uint8Array): void {
    let body: Uint8Array;

    try {
      body = decodeFrame(bytes).body;
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    let request: SyncRequestBody;

    try {
      request = readSyncRequest(decodeUtf8(body));
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const bloques = this.buildSyncBlocks(request.desde);
    const cortar = this.disconnectOnNextSync;
    this.disconnectOnNextSync = false;

    bloques.forEach((block, index) => {
      const payload = this.syncBodyBytes(
        block.texto,
        block.desde,
        block.hasta,
        block.fragmento,
        block.fragmentos,
      );
      const frame = encodeFrameWithVersion(Opcode.SyncDatos, payload, this.protocolVersion);

      if (index === 0 && this.invalidCrcOnNextBlock) {
        this.invalidCrcOnNextBlock = false;
        frame[4] = (frame[4] ?? 0) ^ 0xff;
      }

      this.emitNotify('syncDatos', frame);

      if (cortar && index === 0 && bloques.length > 1) {
        this.emitDisconnected('Se cortó la conexión en mitad de la transferencia.');
      }
    });
  }

  private handleSyncConfirmation(bytes: Uint8Array): void {
    let body: Uint8Array;

    try {
      body = decodeFrame(bytes).body;
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    try {
      const confirmation = readSyncConfirmation(decodeUtf8(body));
      this.confirm(confirmation.ultimoId);
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleSummaryWrite(bytes: Uint8Array): void {
    let body: Uint8Array;

    try {
      body = decodeFrame(bytes).body;
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    try {
      const summary = readSummary(decodeUtf8(this.cipherValue.decrypt(body)));
      this.setOledSummary(summary.lineas);
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleControlWrite(bytes: Uint8Array): void {
    let body: Uint8Array;

    try {
      body = decodeFrame(bytes).body;
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    let control: ControlBody;

    try {
      control = readControl(decodeUtf8(this.cipherValue.decrypt(body)));
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    if (control.accion === 'fijar-hora') {
      if (control.horaUtc !== undefined) {
        this.setTime(control.horaUtc);
      }

      this.notifyStatus();
      return;
    }

    try {
      this.captureNow();
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private setConfigRejected(motivo: ConfigWriteReason): void {
    this.configState = {
      aceptada: false,
      motivo,
      configId: this.activeConfigValue?.configId ?? 0,
      config: this.activeConfigValue,
    };
    this.notifyConfigStatus(this.configState);
  }

  private notifyConfigStatus(status: StickConfigStatus): void {
    const body: ConfigStatusBody = {
      aceptada: status.aceptada,
      motivo: status.motivo,
      configId: status.configId,
      cultivo: status.config?.cropPrimary ?? null,
      lote: status.config?.plotId ?? null,
      profundidadCm: status.config?.depthCm ?? null,
    };

    this.emitNotify(
      'configEstado',
      encodeFrameWithVersion(
        Opcode.ConfigEstado,
        encodeUtf8(JSON.stringify(body)),
        this.protocolVersion,
      ),
    );
  }

  private nextRecordId(): number {
    const last = this.records.reduce((max, record) => Math.max(max, record.idRegistro ?? 0), 0);
    return last + 1;
  }

  private syncBodySize(texto: string, desde: number, hasta: number): number {
    return this.syncBodyBytes(texto, desde, hasta, 1, 1).length;
  }

  private syncBodyBytes(
    texto: string,
    desde: number,
    hasta: number,
    fragmento: number,
    fragmentos: number,
  ): Uint8Array {
    const body: SyncDataBody = { desde, hasta, fragmento, fragmentos, texto };
    return encodeUtf8(JSON.stringify(body));
  }

  private fragmentar(
    desde: number,
    hasta: number,
    texto: string,
    maxBody: number,
  ): StickSyncBlock[] {
    let tamano = Math.max(1, maxBody);

    for (let intento = 0; intento < 64; intento += 1) {
      const trozos = dividir(texto, tamano);
      const cuerpos = trozos.map((trozo, index) =>
        this.syncBodyBytes(trozo, desde, hasta, index + 1, trozos.length),
      );

      if (cuerpos.every((cuerpo) => cuerpo.length <= maxBody)) {
        return trozos.map((trozo, index) => ({
          desde,
          hasta,
          fragmento: index + 1,
          fragmentos: trozos.length,
          texto: trozo,
        }));
      }

      tamano = Math.max(1, Math.floor(tamano * 0.85));
    }

    // Con una MTU minúscula no entra ni un carácter: se envía igual y el CRC
    // del receptor avisa de que el bloque está incompleto.
    const trozos = dividir(texto, 1);
    return trozos.map((trozo, index) => ({
      desde,
      hasta,
      fragmento: index + 1,
      fragmentos: trozos.length,
      texto: trozo,
    }));
  }

  private emitNotify(characteristic: BleCharacteristicKey, bytes: Uint8Array): void {
    this.listeners.forEach((listener) => {
      listener({ type: 'notify', characteristic, bytes });
    });
  }

  private emitDisconnected(reason: string): void {
    this.listeners.forEach((listener) => {
      listener({ type: 'disconnected', reason });
    });
  }

  private emitError(error: Error): void {
    this.listeners.forEach((listener) => {
      listener({ type: 'error', error });
    });
  }
}

/**
 * Bytes aleatorios deterministas para el simulador.
 *
 * El bastón real sortea el nonce del sobre cifrado; el simulado usa una
 * fuente determinista para que sus pruebas no dependan del sistema y se
 * puedan repetir.
 */
export function deterministicRandomBytes(seed = 1): RandomBytes {
  let estado = seed >>> 0;

  return {
    bytes(length: number): Uint8Array {
      const bytes = new Uint8Array(length);

      for (let index = 0; index < length; index += 1) {
        estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
        bytes[index] = (estado >>> 24) & 0xff;
      }

      return bytes;
    },
  };
}

/**
 * Deriva la clave de la carga útil del bastón.
 *
 * Usa la derivación del dominio (PBKDF2-HMAC-SHA256 sobre el PIN y la sal).
 * La clave derivada se guarda en caché: derivarla cuesta 100.000 iteraciones
 * y el simulador crea muchos bastones en las pruebas.
 */
export function simulatedKey(pin: string, salt: Uint8Array): Uint8Array {
  const identificador = `${pin}|${Array.from(salt)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
  const guardada = clavesDerivadas.get(identificador);

  if (guardada !== undefined) {
    return guardada;
  }

  const derivada = deriveKey(pin, salt);
  clavesDerivadas.set(identificador, derivada);

  return derivada;
}

/** Cifrador de la carga útil del bastón, con la clave del PIN y la sal. */
export function createStickCipher(
  pin: string,
  salt: Uint8Array,
  random: RandomBytes = deterministicRandomBytes(),
): StickPayloadCipher {
  return createEncryptor(simulatedKey(pin, salt), random);
}

/** Arma una trama con una versión de protocolo cualquiera. */
function encodeFrameWithVersion(opcode: Opcode, body: Uint8Array, version: number): Uint8Array {
  const frame = new Uint8Array(FRAME_HEADER_BYTES + body.length);
  frame[0] = opcode;
  frame[1] = version;
  frame[2] = body.length & 0xff;
  frame[3] = (body.length >>> 8) & 0xff;

  const crc = crc16(body);
  frame[4] = crc & 0xff;
  frame[5] = (crc >>> 8) & 0xff;

  frame.set(body, FRAME_HEADER_BYTES);

  return frame;
}

/** Divide un texto en trozos de tamaño máximo, sin partir surrogate pairs. */
function dividir(texto: string, tamano: number): string[] {
  if (texto.length === 0) {
    return [''];
  }

  const trozos: string[] = [];
  let indice = 0;

  while (indice < texto.length) {
    let fin = Math.min(texto.length, indice + tamano);
    const codigo = texto.charCodeAt(fin - 1);
    if (fin < texto.length && codigo >= 0xd800 && codigo <= 0xdbff) {
      fin -= 1;
    }

    trozos.push(texto.slice(indice, fin));
    indice = fin;
  }

  return trozos;
}

/** Codifica un texto en UTF-8 sin depender de `TextEncoder`. */
export function encodeUtf8(text: string): Uint8Array {
  const bytes: number[] = [];

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }

  return Uint8Array.from(bytes);
}

/** Decodifica bytes UTF-8 en texto, sin depender de `TextDecoder`. */
export function decodeUtf8(bytes: Uint8Array): string {
  let text = '';
  let index = 0;

  while (index < bytes.length) {
    const byte = bytes[index] ?? 0;

    if (byte < 0x80) {
      text += String.fromCharCode(byte);
      index += 1;
      continue;
    }

    if ((byte & 0xe0) === 0xc0) {
      const segundo = bytes[index + 1] ?? 0;
      text += String.fromCharCode(((byte & 0x1f) << 6) | (segundo & 0x3f));
      index += 2;
      continue;
    }

    if ((byte & 0xf0) === 0xe0) {
      const segundo = bytes[index + 1] ?? 0;
      const tercero = bytes[index + 2] ?? 0;
      text += String.fromCharCode(
        ((byte & 0x0f) << 12) | ((segundo & 0x3f) << 6) | (tercero & 0x3f),
      );
      index += 3;
      continue;
    }

    const segundo = bytes[index + 1] ?? 0;
    const tercero = bytes[index + 2] ?? 0;
    const cuarto = bytes[index + 3] ?? 0;
    const code =
      ((byte & 0x07) << 18) | ((segundo & 0x3f) << 12) | ((tercero & 0x3f) << 6) | (cuarto & 0x3f);
    const offset = code - 0x10000;
    text += String.fromCharCode(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    index += 4;
  }

  return text;
}

/** Fecha en UTC (AAAA-MM-DD) de una hora ISO 8601. */
function fechaUtc(iso: string): string {
  return iso.slice(0, 10);
}

/** Hora en UTC (HH:MM:SS) de una hora ISO 8601. */
function horaUtc(iso: string): string {
  return iso.slice(11, 19);
}

/** Ajusta una MTU al rango que el bastón acepta. */
function clampMtu(valor: number, minimo: number, maximo: number): number {
  if (!Number.isFinite(valor)) {
    return minimo;
  }

  return Math.min(Math.max(Math.trunc(valor), minimo), maximo);
}

/** Valida una configuración de sesión; devuelve el motivo si no sirve. */
function validateSessionConfig(config: SessionConfig): ConfigWriteReason | null {
  if (!Number.isInteger(config.configId) || config.configId <= 0) {
    return 'formato_invalido';
  }

  if (config.plotId.trim() === '') {
    return 'formato_invalido';
  }

  if (config.cropPrimary.trim() === '') {
    return 'formato_invalido';
  }

  if (!Number.isFinite(config.depthCm) || config.depthCm <= 0) {
    return 'formato_invalido';
  }

  return null;
}

/** Lee la configuración de sesión del cuerpo descifrado. */
function readSessionConfig(text: string): SessionConfig {
  const value: unknown = JSON.parse(text);
  const objeto = asObject(value, 'La configuración de sesión');

  const cropSecondary = objeto.crop_secondary;
  const lastFertilizationDate = objeto.last_fertilization_date;

  return {
    configId: readNumber(objeto.config_id, 'config_id'),
    plotId: readString(objeto.plot_id, 'plot_id'),
    cropPrimary: readString(objeto.crop_primary, 'crop_primary'),
    cropSecondary:
      cropSecondary === null || cropSecondary === undefined
        ? null
        : readString(cropSecondary, 'crop_secondary'),
    depthCm: readNumber(objeto.depth_cm, 'depth_cm'),
    cartographicUnit: readString(objeto.cartographic_unit, 'cartographic_unit'),
    lastFertilizationDate:
      lastFertilizationDate === null || lastFertilizationDate === undefined
        ? null
        : readString(lastFertilizationDate, 'last_fertilization_date'),
    thresholdsVersion: readString(objeto.thresholds_version, 'thresholds_version'),
    createdAtUtc: readString(objeto.created_at_utc, 'created_at_utc'),
  };
}

/** Lee el cuerpo de la solicitud de sincronización. */
function readSyncRequest(text: string): SyncRequestBody {
  const value: unknown = JSON.parse(text);
  const objeto = asObject(value, 'La solicitud de sincronización');
  const desde = readNumber(objeto.desde, 'desde');

  if (!Number.isInteger(desde) || desde < 0) {
    throw new Error('La solicitud de sincronización no trae un id válido.');
  }

  return { desde };
}

/** Lee el cuerpo de la confirmación de sincronización. */
function readSyncConfirmation(text: string): SyncConfirmationBody {
  const value: unknown = JSON.parse(text);
  const objeto = asObject(value, 'La confirmación de sincronización');
  const ultimoId = readNumber(objeto.ultimo_id, 'ultimo_id');

  if (!Number.isInteger(ultimoId) || ultimoId < 0) {
    throw new Error('La confirmación de sincronización no trae un id válido.');
  }

  return { ultimoId };
}

/** Lee el cuerpo del resumen para la OLED. */
function readSummary(text: string): SummaryBody {
  const value: unknown = JSON.parse(text);
  const objeto = asObject(value, 'El resumen para la OLED');
  const lineas = objeto.lineas;

  if (!Array.isArray(lineas)) {
    throw new Error('El resumen para la OLED no trae líneas de texto.');
  }

  return {
    lineas: lineas.map((linea) => (typeof linea === 'string' ? linea : String(linea))),
  };
}

/** Lee el cuerpo del mensaje de control. */
function readControl(text: string): ControlBody {
  const value: unknown = JSON.parse(text);
  const objeto = asObject(value, 'El mensaje de control');
  const accion = readString(objeto.accion, 'accion');

  if (accion !== 'capturar' && accion !== 'fijar-hora') {
    throw new Error(`Acción de control desconocida: ${accion}.`);
  }

  const horaUtc = objeto.hora_utc;

  return {
    accion,
    horaUtc:
      horaUtc === null || horaUtc === undefined ? undefined : readString(horaUtc, 'hora_utc'),
  };
}

/** Exige que el valor sea un objeto. */
function asObject(value: unknown, que: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${que} no es un objeto válido.`);
  }

  return value as Record<string, unknown>;
}

/** Lee un número de un cuerpo de mensaje. */
function readNumber(value: unknown, campo: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`El campo "${campo}" no es un número válido.`);
  }

  return value;
}

/** Lee un texto de un cuerpo de mensaje. */
function readString(value: unknown, campo: string): string {
  if (typeof value !== 'string') {
    throw new Error(`El campo "${campo}" no es un texto válido.`);
  }

  return value;
}
