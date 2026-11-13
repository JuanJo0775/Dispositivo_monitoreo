/**
 * Gateway BLE del bastón: el camino real de la app hacia el dispositivo.
 *
 * Implementa los puertos `StickGateway` (estado, captura en vivo, configuración
 * y confirmación) y `StickSync` (sincronización por bloques de la microSD)
 * sobre el puerto de transporte `BleTransport`. Así la app habla con el bastón
 * real y con el bastón simulado por el mismo código.
 *
 * La máquina de estados es explícita y la UI la muestra:
 *
 * ```
 * idle → scanning → connecting → discovering → ready
 * ready → configuring → ready
 * ready → capturing → ready
 * ready → syncing → ready
 * ready → reconnecting → ready | error
 * error → idle (acción manual)
 * ```
 *
 * Reglas del contrato que este módulo respeta:
 *
 * - La versión mayor del protocolo se verifica al conectar: si no cuadra, la
 *   conexión se bloquea con un mensaje claro (RF-APP-006).
 * - Las escrituras van en una cola serial: una a la vez y en orden, para no
 *   perder el orden de los mensajes.
 * - Un bloque de sincronización con CRC inválido no se entrega: se descarta y
 *   la sincronización se reanuda desde el último id confirmado.
 */

import { PROTOCOL_VERSION } from '@/domain/protocol/ble-profile';
import { decodeFrame, encodeFrame, Opcode, type DecodedFrame } from '@/domain/protocol/frame';
import { decodeRecord, flagsFromBits, type StickRecord } from '@/domain/protocol/record-codec';
import { createEncryptor, deriveKey, type PayloadEncryptor } from '@/domain/protocol/encryption';
import type { CapturePayload, RawCapture } from '@/domain/capture/types';
import type { SessionConfig } from '@/domain/session/types';
import type { BleTransport } from '@/ports/ble-transport';
import type { RandomBytes } from '@/ports/random-bytes';
import type {
  StickGateway,
  StickGatewayState,
  StickStatus,
  Unsubscribe,
} from '@/ports/stick-gateway';
import type { StickSync, SyncChunk } from '@/ports/stick-sync';

/** Tiempo del escaneo, en milisegundos. */
const DEFAULT_SCAN_TIMEOUT_MS = 4000;

/** Espera máxima por el estado del bastón, en milisegundos. */
const DEFAULT_STATUS_TIMEOUT_MS = 3000;

/** Espera máxima por el resultado de la configuración, en milisegundos. */
const DEFAULT_CONFIG_TIMEOUT_MS = 5000;

/** MTU que se le pide al bastón (la que negocia Android por defecto). */
const DEFAULT_MTU = 185;

/** Intentos de reconexión antes de pedir la acción manual. */
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 3;

/** Espera inicial de la reconexión, en milisegundos. */
const DEFAULT_RECONNECT_DELAY_MS = 500;

/** Espera máxima de la reconexión, en milisegundos. */
const DEFAULT_MAX_RECONNECT_DELAY_MS = 8000;

/** Silencio sin bloques que da por terminada una sincronización. */
const DEFAULT_SYNC_IDLE_MS = 400;

/** Estado de un bastón que todavía no está conectado. */
const DISCONNECTED_STATUS: StickStatus = {
  connected: false,
  deviceId: null,
  batteryPct: null,
  firmwareVersion: null,
  protocolVersion: null,
  microSdOk: false,
  satellites: null,
  hdop: null,
  recordCount: null,
  pendingCount: null,
  deviceTimeUtc: null,
  state: 'idle',
};

/** Cuerpo del mensaje Estado. */
interface StickStatusBody {
  readonly batteryPct: number | null;
  readonly lowBattery: boolean;
  readonly microSd: string;
  readonly sats: number | null;
  readonly hdop: number | null;
  readonly fix: boolean;
  readonly firmwareVersion: string | null;
  readonly protocolVersion: number | null;
  readonly utcTime: string | null;
  readonly recordCount: number | null;
  readonly pendingCount: number | null;
  readonly configId: number | null;
}

/** Cuerpo del mensaje Configuración · estado. */
interface ConfigStatusBody {
  readonly aceptada: boolean;
  readonly motivo: string | null;
  readonly configId: number | null;
}

/** Cuerpo del mensaje Sync · datos. */
interface SyncBlockBody {
  readonly desde: number;
  readonly hasta: number;
  readonly fragmento: number;
  readonly fragmentos: number;
  readonly texto: string;
}

/** Sincronización en curso: quién recibe los bloques. */
interface PendingSync {
  readonly deviceId: string;
  readonly onChunk: (chunk: SyncChunk) => Promise<void>;
}

/** Fragmentos de un bloque que todavía está incompleto. */
interface SyncBlockBuffer {
  readonly total: number;
  readonly textos: (string | undefined)[];
}

/** Opciones de construcción del gateway. */
export interface BleStickGatewayOptions {
  /** PIN de emparejamiento de seis dígitos. */
  readonly pin?: string;
  /** Sal de emparejamiento con la que se deriva la clave de la carga útil. */
  readonly salt?: Uint8Array;
  /** Bytes aleatorios para los nonces del cifrado. */
  readonly random?: RandomBytes;
  /** Tiempo del escaneo, en milisegundos. */
  readonly scanTimeoutMs?: number;
  /** Espera máxima por el estado del bastón, en milisegundos. */
  readonly statusTimeoutMs?: number;
  /** Espera máxima por el resultado de la configuración, en milisegundos. */
  readonly configTimeoutMs?: number;
  /** MTU que se le pide al bastón. */
  readonly mtu?: number;
  /** Intentos de reconexión antes de pedir la acción manual. */
  readonly maxReconnectAttempts?: number;
  /** Espera inicial de la reconexión, en milisegundos. */
  readonly reconnectDelayMs?: number;
  /** Espera máxima de la reconexión, en milisegundos. */
  readonly maxReconnectDelayMs?: number;
  /** Silencio sin bloques que da por terminada una sincronización. */
  readonly syncIdleMs?: number;
  /** Reloj de la app, para la hora de recepción de una captura. */
  readonly clock?: () => string;
  /** Espera de la reconexión; se inyecta para que las pruebas no dependan del reloj. */
  readonly delay?: (ms: number) => Promise<void>;
}

/**
 * Gateway BLE del bastón.
 *
 * Habla el contrato v0.1: tramas con CRC-16, líneas CSV del registro,
 * cifrado de la carga útil con la clave derivada del PIN y sal de
 * emparejamiento, y sincronización por bloques.
 */
export class BleStickGateway implements StickGateway, StickSync {
  private readonly transport: BleTransport;

  private readonly options: Required<
    Pick<
      BleStickGatewayOptions,
      | 'scanTimeoutMs'
      | 'statusTimeoutMs'
      | 'configTimeoutMs'
      | 'mtu'
      | 'maxReconnectAttempts'
      | 'reconnectDelayMs'
      | 'maxReconnectDelayMs'
      | 'syncIdleMs'
    >
  >;

  private readonly clock: () => string;

  private readonly delay: (ms: number) => Promise<void>;

  private readonly random: RandomBytes;

  private currentState: StickGatewayState = 'idle';

  private currentStatus: StickStatus = DISCONNECTED_STATUS;

  private connectedDeviceId: string | null = null;

  private lastErrorValue: Error | null = null;

  private encryptor: PayloadEncryptor | null = null;

  private readonly captureListeners = new Set<(capture: RawCapture) => void>();

  private readonly statusListeners = new Set<(status: StickStatus) => void>();

  private readonly statusWaiters = new Set<(body: StickStatusBody) => void>();

  private readonly configWaiters = new Set<(body: ConfigStatusBody) => void>();

  private readonly subscribedKeys = new Set<string>();

  /** Cola serial de escrituras: una a la vez y en orden. */
  private writeChain: Promise<unknown> = Promise.resolve();

  /** Cadena de entrega de los bloques de sincronización, en orden. */
  private syncChain: Promise<void> = Promise.resolve();

  private pendingSync: PendingSync | null = null;

  private syncError: Error | null = null;

  private syncBuffers = new Map<string, SyncBlockBuffer>();

  private lastSyncBlockAt = 0;

  private lastStatusBody: StickStatusBody | null = null;

  private lastSyncDeviceId: string | null = null;

  /** Sal del emparejamiento: se fija al construir o al emparejar con PIN. */
  private pairingSalt: Uint8Array | undefined;

  constructor(transport: BleTransport, options: BleStickGatewayOptions = {}) {
    this.transport = transport;
    this.options = {
      scanTimeoutMs: options.scanTimeoutMs ?? DEFAULT_SCAN_TIMEOUT_MS,
      statusTimeoutMs: options.statusTimeoutMs ?? DEFAULT_STATUS_TIMEOUT_MS,
      configTimeoutMs: options.configTimeoutMs ?? DEFAULT_CONFIG_TIMEOUT_MS,
      mtu: options.mtu ?? DEFAULT_MTU,
      maxReconnectAttempts: options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
      reconnectDelayMs: options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS,
      maxReconnectDelayMs: options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS,
      syncIdleMs: options.syncIdleMs ?? DEFAULT_SYNC_IDLE_MS,
    };
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.delay = options.delay ?? sleep;
    this.random = options.random ?? defaultRandomBytes();
    this.pairingSalt = options.salt;

    if (options.pin !== undefined && options.salt !== undefined) {
      this.pair(options.pin, options.salt);
    }

    this.transport.onDisconnected(this.handleTransportDisconnected);
    this.transport.onError(this.handleTransportError);
  }

  // ------------------------------------------------------------- conexión

  /**
   * Conecta con el bastón: escanea, conecta, descubre las características y
   * lee el estado.
   *
   * Si el bastón habla otra versión del protocolo, la conexión se bloquea con
   * un mensaje claro y el gateway queda en `error`.
   */
  async connect(deviceId: string): Promise<void> {
    this.lastErrorValue = null;
    this.connectedDeviceId = null;

    try {
      this.setState('scanning');
      const results = await this.transport.scan({ timeoutMs: this.options.scanTimeoutMs });

      if (!results.some((result) => result.deviceId === deviceId)) {
        throw new Error(`No se encontró el bastón ${deviceId} en el escaneo.`);
      }

      this.setState('connecting');
      await this.transport.connect(deviceId);
      this.connectedDeviceId = deviceId;

      this.setState('discovering');
      const characteristics = await this.transport.discoverCharacteristics();
      this.assertContractCharacteristics(characteristics);

      await this.transport.requestMtu(deviceId, this.options.mtu);
      await this.subscribeCharacteristics();

      const body = await this.readStatus();
      this.assertProtocolVersion(body.protocolVersion);

      this.setState('ready');
    } catch (error) {
      this.fail(error);
      await this.closeQuietly();
      throw error;
    }
  }

  /** Cierra la conexión con el bastón. */
  async disconnect(): Promise<void> {
    try {
      await this.transport.disconnect();
    } finally {
      this.connectedDeviceId = null;
      this.lastStatusBody = null;
      this.currentStatus = { ...DISCONNECTED_STATUS };
      this.setState('idle');
    }
  }

  /**
   * Vuelve a `idle` desde `error`.
   *
   * Es la acción manual: el gateway no se recovers solo de un error de
   * protocolo o de una reconexión agotada.
   */
  reset(): void {
    this.lastErrorValue = null;
    this.connectedDeviceId = null;
    this.lastStatusBody = null;
    this.currentStatus = { ...DISCONNECTED_STATUS };
    this.setState('idle');
  }

  /** Estado de la máquina del gateway, para la UI. */
  state(): StickGatewayState {
    return this.currentState;
  }

  /** Estado observable del bastón. */
  status(): StickStatus {
    return this.currentStatus;
  }

  /** Último error que encontró el gateway, si hay alguno. */
  lastError(): Error | null {
    return this.lastErrorValue;
  }

  /**
   * Empareja el bastón: deriva la clave de la carga útil con el PIN y la sal.
   *
   * La clave nunca se inventa: sale de `deriveKey` con el PIN de seis dígitos
   * y la sal que se intercambió al emparejar. Si se llama sin sal, se usa la
   * que quedó fijada al construir el gateway; sin ninguna de las dos no hay
   * forma segura de derivar la clave y se avisa.
   */
  pair(pin: string, salt?: Uint8Array): void {
    const sal = salt ?? this.pairingSalt;

    if (sal === undefined) {
      throw new Error(
        'Falta la sal de emparejamiento: el intercambio de sal con el bastón todavía no está implementado.',
      );
    }

    this.pairingSalt = sal;

    const key = deriveKey(pin, sal);
    this.encryptor = createEncryptor(key, this.random);
  }

  // -------------------------------------------------------------- captura

  /**
   * Escucha las capturas en vivo.
   *
   * Se suscribe a la característica Captura y entrega el registro ya
   * decodificado, con su `configId` y sus banderas.
   */
  onCapture(listener: (capture: RawCapture) => void): Unsubscribe {
    this.captureListeners.add(listener);
    void this.ensureSubscribed('captura').catch((error: unknown) => {
      this.reportError(error);
    });

    return () => {
      this.captureListeners.delete(listener);
    };
  }

  /** Escucha los cambios del estado del bastón. */
  onStatus(listener: (status: StickStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Pide al bastón una captura ahora: escribe el control «capturar». */
  async requestCapture(): Promise<void> {
    this.requireConnected();
    const encryptor = this.requireEncryptor();
    this.setState('capturing');

    try {
      const body = encodeUtf8(JSON.stringify({ accion: 'capturar' }));
      const frame = encodeFrame(Opcode.ControlEscritura, encryptor.encrypt(body));
      await this.enqueueWrite(() => this.transport.write('controlEscritura', frame, true));
    } finally {
      if (this.currentState === 'capturing') {
        this.setState('ready');
      }
    }
  }

  // -------------------------------------------------------- configuración

  /**
   * Escribe al bastón la configuración de la sesión, cifrada.
   *
   * Espera el resultado en la característica Configuración · estado: si el
   * bastón no la acepta, la promesa se rechaza con el motivo en español.
   */
  async writeConfig(config: SessionConfig): Promise<void> {
    this.requireConnected();
    const encryptor = this.requireEncryptor();
    this.setState('configuring');

    const waiter = this.createConfigWaiter();

    try {
      const body = encodeUtf8(JSON.stringify(configBodyOf(config)));
      const frame = encodeFrame(Opcode.ConfigEscritura, encryptor.encrypt(body));

      await this.enqueueWrite(() => this.transport.write('configEscritura', frame, true));

      const status = await waiter.promise;

      if (status === null) {
        throw new Error('El bastón no respondió el resultado de la configuración.');
      }

      if (!status.aceptada) {
        throw new Error(`El bastón no aceptó la configuración: ${configMotivo(status.motivo)}.`);
      }
    } finally {
      waiter.cancel();
      if (this.currentState === 'configuring') {
        this.setState('ready');
      }
    }
  }

  // -------------------------------------------------------- sincronización

  /**
   * Pide al bastón los registros desde `fromSequence` y los entrega por
   * bloques, ya validados.
   *
   * Un bloque con CRC inválido no se entrega: la sincronización se interrumpe
   * con un error y la app la reanuda desde el último id confirmado.
   */
  async syncFrom(
    deviceId: string,
    fromSequence: number,
    onChunk: (chunk: SyncChunk) => Promise<void>,
  ): Promise<void> {
    this.requireConnected();
    this.lastSyncDeviceId = deviceId;
    this.syncError = null;
    this.syncBuffers = new Map<string, SyncBlockBuffer>();
    this.lastSyncBlockAt = Date.now();
    this.pendingSync = { deviceId, onChunk };
    this.setState('syncing');

    try {
      const frame = encodeFrame(
        Opcode.SyncSolicitud,
        encodeUtf8(JSON.stringify({ desde: fromSequence })),
      );

      await this.enqueueWrite(() => this.transport.write('syncSolicitud', frame, true));

      await this.waitForSyncIdle();
      await this.syncChain;

      if (this.syncError !== null) {
        throw this.syncError;
      }
    } finally {
      this.pendingSync = null;
      this.syncBuffers = new Map<string, SyncBlockBuffer>();

      if (this.currentState === 'syncing') {
        this.setState('ready');
      }
    }
  }

  /** Confirma al bastón el último id recibido y guardado. */
  async confirmRecords(deviceId: string, lastSequence: number): Promise<void> {
    this.lastSyncDeviceId = deviceId;
    await this.writeConfirmation(lastSequence);
  }

  /**
   * Confirma al bastón que una captura quedó guardada.
   *
   * El bastón no borra de la microSD antes de esta confirmación.
   */
  async confirm(sequence: number): Promise<void> {
    await this.writeConfirmation(sequence);
  }

  /** Bastón con el que se está sincronizando, si hay alguno. */
  syncDeviceId(): string | null {
    return this.lastSyncDeviceId;
  }

  // -------------------------------------------------------------- internos

  /** Escribe la confirmación del último id en la característica del contrato. */
  private async writeConfirmation(lastSequence: number): Promise<void> {
    const frame = encodeFrame(
      Opcode.SyncConfirmacion,
      encodeUtf8(JSON.stringify({ ultimo_id: lastSequence })),
    );

    await this.enqueueWrite(() => this.transport.write('syncConfirmacion', frame, true));
  }

  /**
   * Encola una escritura: una a la vez y en orden.
   *
   * Un fallo no rompe la cola: la siguiente escritura sigue su curso.
   */
  private enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeChain.then(operation, operation);
    this.writeChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Exige que haya un bastón conectado. */
  private requireConnected(): void {
    if (this.connectedDeviceId === null) {
      throw new Error('El bastón no está conectado.');
    }
  }

  /** Exige que el bastón esté emparejado: sin PIN y sal no hay cifrado. */
  private requireEncryptor(): PayloadEncryptor {
    if (this.encryptor === null) {
      throw new Error(
        'El bastón no está emparejado: falta el PIN y la sal del emparejamiento para cifrar.',
      );
    }
    return this.encryptor;
  }

  /** Comprueba que el bastón tenga las características del contrato. */
  private assertContractCharacteristics(characteristics: readonly { key: string }[]): void {
    const required = [
      'captura',
      'estado',
      'syncSolicitud',
      'syncDatos',
      'syncConfirmacion',
      'configEscritura',
      'configEstado',
      'controlEscritura',
    ];

    for (const key of required) {
      if (!characteristics.some((characteristic) => characteristic.key === key)) {
        throw new Error(`El bastón no tiene la característica "${key}" del contrato.`);
      }
    }
  }

  /** Se suscribe a las características que el gateway necesita siempre. */
  private async subscribeCharacteristics(): Promise<void> {
    await this.ensureSubscribed('captura');
    await this.ensureSubscribed('configEstado');
    await this.ensureSubscribed('syncDatos');
  }

  /** Se suscribe a una característica, una sola vez. */
  private async ensureSubscribed(key: string): Promise<void> {
    if (this.subscribedKeys.has(key)) {
      return;
    }

    const handler = this.handlerFor(key);

    if (handler === undefined) {
      return;
    }

    this.subscribedKeys.add(key);

    try {
      await this.transport.subscribe(key, handler);
    } catch (error) {
      this.subscribedKeys.delete(key);
      throw error;
    }
  }

  /** El manejador de notificaciones de una característica. */
  private handlerFor(key: string): ((bytes: Uint8Array) => void) | undefined {
    switch (key) {
      case 'captura':
        return this.handleCaptureNotification;
      case 'estado':
        return this.handleStatusNotification;
      case 'configEstado':
        return this.handleConfigStatusNotification;
      case 'syncDatos':
        return this.handleSyncDataNotification;
      default:
        return undefined;
    }
  }

  /** Lee el estado del bastón y espera su notificación. */
  private async readStatus(): Promise<StickStatusBody> {
    let settle!: (body: StickStatusBody | null) => void;
    const promise = new Promise<StickStatusBody | null>((resolve) => {
      settle = resolve;
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const waiter = (body: StickStatusBody): void => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      this.statusWaiters.delete(waiter);
      settle(body);
    };

    timer = setTimeout(() => {
      this.statusWaiters.delete(waiter);
      settle(null);
    }, this.options.statusTimeoutMs);

    this.statusWaiters.add(waiter);

    try {
      await this.transport.subscribe('estado', this.handleStatusNotification);
    } catch (error) {
      if (timer !== null) {
        clearTimeout(timer);
      }
      this.statusWaiters.delete(waiter);
      settle(null);
      throw error;
    }

    const body = await promise;

    if (body === null) {
      throw new Error('El bastón no respondió el estado a tiempo.');
    }

    return body;
  }

  /** Prepara la espera del resultado de la configuración. */
  private createConfigWaiter(): {
    promise: Promise<ConfigStatusBody | null>;
    cancel: () => void;
  } {
    let settle!: (body: ConfigStatusBody | null) => void;
    const promise = new Promise<ConfigStatusBody | null>((resolve) => {
      settle = resolve;
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const waiter = (body: ConfigStatusBody): void => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      this.configWaiters.delete(waiter);
      settle(body);
    };

    timer = setTimeout(() => {
      this.configWaiters.delete(waiter);
      settle(null);
    }, this.options.configTimeoutMs);

    this.configWaiters.add(waiter);

    return {
      promise,
      cancel: () => {
        if (timer !== null) {
          clearTimeout(timer);
        }
        this.configWaiters.delete(waiter);
      },
    };
  }

  /** Exige que la versión del bastón sea la que habla la app. */
  private assertProtocolVersion(version: number | null): void {
    if (version === null || version === PROTOCOL_VERSION) {
      return;
    }

    throw new Error(this.incompatibleVersionMessage(version));
  }

  /** Mensaje claro de versión incompatible, en español. */
  private incompatibleVersionMessage(version: number): string {
    return (
      `Versión de protocolo incompatible: el bastón habla la versión ${version} ` +
      `y la app la versión ${PROTOCOL_VERSION}. ` +
      `Actualiza la app o usa un bastón con la versión ${PROTOCOL_VERSION}.`
    );
  }

  /**
   * Decodifica una trama y verifica la versión del protocolo.
   *
   * La versión viaja en la cabecera: si no es la de la app, el mensaje es
   * incompatible y se dice con el número exacto.
   */
  private decodeFrameChecked(bytes: Uint8Array): DecodedFrame {
    const version = bytes[1];

    if (version !== undefined && version !== PROTOCOL_VERSION) {
      throw new Error(this.incompatibleVersionMessage(version));
    }

    return decodeFrame(bytes);
  }

  // --------------------------------------------------------- notificaciones

  private handleCaptureNotification = (bytes: Uint8Array): void => {
    try {
      const frame = this.decodeFrameChecked(bytes);

      if (frame.opcode !== Opcode.Captura) {
        return;
      }

      const record = decodeRecord(decodeUtf8(frame.body));
      const capture = this.toRawCapture(record);

      this.captureListeners.forEach((listener) => listener(capture));
    } catch (error) {
      this.reportError(error);
    }
  };

  private handleStatusNotification = (bytes: Uint8Array): void => {
    try {
      const frame = this.decodeFrameChecked(bytes);

      if (frame.opcode !== Opcode.Estado) {
        return;
      }

      const body = readStatusBody(decodeUtf8(frame.body));
      this.lastStatusBody = body;
      this.applyStatus(body);
      this.statusWaiters.forEach((waiter) => waiter(body));
    } catch (error) {
      this.reportError(error);
    }
  };

  private handleConfigStatusNotification = (bytes: Uint8Array): void => {
    try {
      const frame = this.decodeFrameChecked(bytes);

      if (frame.opcode !== Opcode.ConfigEstado) {
        return;
      }

      const body = readConfigStatusBody(decodeUtf8(frame.body));
      this.configWaiters.forEach((waiter) => waiter(body));
    } catch (error) {
      this.reportError(error);
    }
  };

  private handleSyncDataNotification = (bytes: Uint8Array): void => {
    this.lastSyncBlockAt = Date.now();

    try {
      const frame = this.decodeFrameChecked(bytes);

      if (frame.opcode !== Opcode.SyncDatos) {
        return;
      }

      this.enqueueBlock(readSyncBlockBody(decodeUtf8(frame.body)));
    } catch (error) {
      this.syncError = new Error(
        `El bastón envió un bloque que no se pudo validar: ${toError(error).message}`,
      );
    }
  };

  private handleTransportDisconnected = (): void => {
    if (this.currentState === 'idle' || this.currentState === 'reconnecting') {
      return;
    }

    void this.reconnect();
  };

  private handleTransportError = (error: Error): void => {
    this.reportError(error);
  };

  // ------------------------------------------------------------- sincronía

  /**
   * Arma un bloque con sus fragmentos y lo entrega cuando está completo.
   *
   * Un bloque fragmentado llega en varias tramas: se juntan los textos y solo
   * se entrega el bloque entero.
   */
  private enqueueBlock(block: SyncBlockBody): void {
    const key = `${block.desde}|${block.hasta}|${block.fragmentos}`;
    const buffer = this.syncBuffers.get(key) ?? { total: block.fragmentos, textos: [] };

    buffer.textos[block.fragmento - 1] = block.texto;
    this.syncBuffers.set(key, buffer);

    const completos = buffer.textos.filter((texto) => texto !== undefined).length;

    if (completos < buffer.total) {
      return;
    }

    this.syncBuffers.delete(key);

    const lines = buffer.textos
      .join('')
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea !== '');

    const chunk: SyncChunk = {
      records: lines,
      lastSequence: lastIdOf(lines) ?? block.hasta,
    };

    this.deliverChunk(chunk);
  }

  /** Entrega un bloque, en orden y sin saltarse la confirmación de la app. */
  private deliverChunk(chunk: SyncChunk): void {
    const pending = this.pendingSync;

    if (pending === null) {
      return;
    }

    this.syncChain = this.syncChain
      .then(async () => {
        if (this.syncError !== null) {
          return;
        }
        await pending.onChunk(chunk);
      })
      .catch((error: unknown) => {
        this.syncError = toError(error);
      });
  }

  /** Espera a que el bastón deje de mandar bloques. */
  private async waitForSyncIdle(): Promise<void> {
    for (;;) {
      const mark = this.lastSyncBlockAt;
      await sleep(this.options.syncIdleMs);
      await this.syncChain;

      if (this.lastSyncBlockAt === mark) {
        return;
      }
    }
  }

  // ------------------------------------------------------------ reconexión

  /**
   * Reconecta con el bastón: espera creciente y un límite de intentos.
   *
   * Si se agotan los intentos, el gateway queda en `error` y espera la acción
   * manual del usuario.
   */
  private async reconnect(): Promise<void> {
    const deviceId = this.connectedDeviceId;

    if (deviceId === null) {
      this.setState('error');
      return;
    }

    this.setState('reconnecting');
    let wait = this.options.reconnectDelayMs;

    for (let attempt = 1; attempt <= this.options.maxReconnectAttempts; attempt += 1) {
      await this.delay(wait);
      wait = Math.min(wait * 2, this.options.maxReconnectDelayMs);

      try {
        await this.transport.connect(deviceId);
        await this.transport.discoverCharacteristics();
        await this.transport.requestMtu(deviceId, this.options.mtu);

        this.subscribedKeys.clear();
        await this.subscribeCharacteristics();

        const body = await this.readStatus();
        this.assertProtocolVersion(body.protocolVersion);

        this.setState('ready');
        return;
      } catch (error) {
        this.lastErrorValue = toError(error);
      }
    }

    this.setState('error');
  }

  // ------------------------------------------------------------- estado UI

  /** Cambia el estado de la máquina y lo refleja en el estado del bastón. */
  private setState(next: StickGatewayState): void {
    this.currentState = next;
    this.currentStatus = { ...this.currentStatus, state: next };
    this.statusListeners.forEach((listener) => listener(this.currentStatus));
  }

  /** Aplica el estado que reportó el bastón. */
  private applyStatus(body: StickStatusBody): void {
    this.currentStatus = {
      connected: this.connectedDeviceId !== null,
      deviceId: this.connectedDeviceId,
      batteryPct: body.batteryPct,
      firmwareVersion: body.firmwareVersion,
      protocolVersion: body.protocolVersion === null ? null : String(body.protocolVersion),
      microSdOk: body.microSd === 'ok',
      satellites: body.sats,
      hdop: body.hdop,
      recordCount: body.recordCount,
      pendingCount: body.pendingCount,
      deviceTimeUtc: body.utcTime,
      state: this.currentState,
    };

    this.statusListeners.forEach((listener) => listener(this.currentStatus));
  }

  /** Deja el gateway en `error` con el motivo a la vista. */
  private fail(error: unknown): void {
    this.lastErrorValue = toError(error);
    this.setState('error');
  }

  /** Guarda el último error sin tumbar la conexión. */
  private reportError(error: unknown): void {
    this.lastErrorValue = toError(error);
  }

  /** Cierra el transporte sin tapar el error que ya hubo. */
  private async closeQuietly(): Promise<void> {
    try {
      await this.transport.disconnect();
    } catch {
      // Si el cierre falla, manda el error original.
    }
  }

  /** Convierte un registro del bastón en la captura que maneja la app. */
  private toRawCapture(record: StickRecord): RawCapture {
    const receivedAtUtc = this.clock();

    return {
      deviceId: record.deviceId ?? this.connectedDeviceId ?? '',
      sequence: record.idRegistro ?? 0,
      payload: toPayload(record),
      capturedAtUtc: toCapturedAtUtc(record, receivedAtUtc),
      receivedAtUtc,
      origin: 'stick',
      flags: flagsFromBits(record.banderas ?? 0),
      configId: record.configId ?? 0,
      plotId: record.loteId ?? null,
    };
  }
}

/** Cuerpo cifrado de la configuración de sesión, con las claves del contrato. */
function configBodyOf(config: SessionConfig): Record<string, unknown> {
  return {
    config_id: config.configId,
    plot_id: config.plotId,
    crop_primary: config.cropPrimary,
    crop_secondary: config.cropSecondary,
    depth_cm: config.depthCm,
    cartographic_unit: config.cartographicUnit,
    last_fertilization_date: config.lastFertilizationDate,
    thresholds_version: config.thresholdsVersion,
    created_at_utc: config.createdAtUtc,
  };
}

/** Traduce el motivo del bastón a un mensaje en español. */
function configMotivo(motivo: string | null): string {
  switch (motivo) {
    case 'crc_invalido':
      return 'el CRC de la trama no cuadra';
    case 'clave_incorrecta':
      return 'la clave de cifrado no coincide: el bastón no está emparejado o el PIN es otro';
    case 'formato_invalido':
      return 'el formato de la configuración no es válido';
    case 'version_incompatible':
      return 'la versión de protocolo del bastón no es compatible con la app';
    case 'no_emparejado':
      return 'el bastón no está emparejado';
    default:
      return 'el bastón no dijo por qué';
  }
}

/** Arma el payload de la captura con las columnas del contrato. */
function toPayload(record: StickRecord): CapturePayload {
  return {
    latitude: record.lat,
    longitude: record.lon,
    altitudeM: record.altM,
    speedKmh: record.velKmh,
    satellites: record.sats,
    hdop: record.hdop,
    fixAgeS: record.edadFixS,
    depthCm: record.profCm,
    cropCode: record.cultivo,
    plotCode: record.loteId,
    lastFertilizationDate: record.fertFecha,
    humidityPct: record.humedadPct,
    temperatureC: record.tempC,
    ph: record.ph,
    ecUsCm: record.ceUsCm,
    nMgKg: record.nMgKg,
    pMgKg: record.pMgKg,
    kMgKg: record.kMgKg,
    batteryPct: record.batPct,
    firmwareVersion: record.fwVer,
  };
}

/**
 * Instante de captura, en UTC.
 *
 * Con la fecha y la hora del bastón se arma el ISO; si falta la fecha se toma
 * el momento en que llegó el registro.
 */
function toCapturedAtUtc(record: StickRecord, fallback: string): string {
  if (record.fecha === null) {
    return fallback;
  }

  const hora = record.horaUtc ?? '00:00:00';

  return `${record.fecha}T${hora}Z`;
}

/** Último `id_registro` de un bloque de líneas CSV. */
function lastIdOf(lines: readonly string[]): number | null {
  const last = lines[lines.length - 1];

  if (last === undefined) {
    return null;
  }

  const id = Number(last.split(',')[0]);

  return Number.isFinite(id) ? id : null;
}

/** Lee el cuerpo del mensaje Estado. */
function readStatusBody(text: string): StickStatusBody {
  const value: unknown = JSON.parse(text);
  const objeto = asObject(value, 'El estado del bastón');

  return {
    batteryPct: readNumber(objeto.batteryPct),
    lowBattery: readBoolean(objeto.lowBattery) ?? false,
    microSd: readString(objeto.microSd) ?? 'desconocido',
    sats: readNumber(objeto.sats),
    hdop: readNumber(objeto.hdop),
    fix: readBoolean(objeto.fix) ?? false,
    firmwareVersion: readString(objeto.firmwareVersion),
    protocolVersion: readNumber(objeto.protocolVersion),
    utcTime: readString(objeto.utcTime),
    recordCount: readNumber(objeto.recordCount),
    pendingCount: readNumber(objeto.pendingCount),
    configId: readNumber(objeto.configId),
  };
}

/** Lee el cuerpo del mensaje Configuración · estado. */
function readConfigStatusBody(text: string): ConfigStatusBody {
  const value: unknown = JSON.parse(text);
  const objeto = asObject(value, 'El estado de la configuración');

  return {
    aceptada: readBoolean(objeto.aceptada) ?? false,
    motivo: readString(objeto.motivo),
    configId: readNumber(objeto.configId),
  };
}

/** Lee el cuerpo del mensaje Sync · datos. */
function readSyncBlockBody(text: string): SyncBlockBody {
  const value: unknown = JSON.parse(text);
  const objeto = asObject(value, 'El bloque de sincronización');

  const desde = readNumber(objeto.desde) ?? 0;
  const hasta = readNumber(objeto.hasta) ?? desde;
  const fragmento = readNumber(objeto.fragmento) ?? 1;
  const fragmentos = readNumber(objeto.fragmentos) ?? 1;

  return {
    desde,
    hasta,
    fragmento,
    fragmentos,
    texto: readString(objeto.texto) ?? '',
  };
}

/** Exige que el valor sea un objeto. */
function asObject(value: unknown, que: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${que} no es un objeto válido.`);
  }

  return value as Record<string, unknown>;
}

/** Lee un número de un cuerpo de mensaje; si no está, `null`. */
function readNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

/** Lee un texto de un cuerpo de mensaje; si no está, `null`. */
function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return value;
}

/** Lee un booleano de un cuerpo de mensaje; si no está, `null`. */
function readBoolean(value: unknown): boolean | null {
  if (typeof value !== 'boolean') {
    return null;
  }

  return value;
}

/** Convierte cualquier error en un `Error`. */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

/** Espera un tiempo, en milisegundos. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Bytes aleatorios del entorno, con una reserva simple si no hay crypto. */
function defaultRandomBytes(): RandomBytes {
  return {
    bytes(length: number): Uint8Array {
      const bytes = new Uint8Array(length);
      const cryptoApi = (
        globalThis as {
          crypto?: { getRandomValues?: (array: Uint8Array) => void };
        }
      ).crypto;

      if (cryptoApi?.getRandomValues === undefined) {
        throw new Error(
          'No hay un generador de bytes aleatorios seguro: en el teléfono, pásale a la app ' +
            'la fuente de expo-crypto; fuera de él, inyecta uno en las pruebas.',
        );
      }

      cryptoApi.getRandomValues(bytes);

      return bytes;
    },
  };
}

/** Codifica un texto en UTF-8 sin depender de `TextEncoder`. */
function encodeUtf8(text: string): Uint8Array {
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
function decodeUtf8(bytes: Uint8Array): string {
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
