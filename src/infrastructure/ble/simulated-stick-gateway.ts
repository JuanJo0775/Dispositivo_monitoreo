import type { CapturePayload, RawCapture } from '@/domain/capture/types';
import { flagsFromBits, type StickRecord } from '@/domain/protocol/record-codec';
import type { SessionConfig } from '@/domain/session/types';
import type { StickGateway, StickStatus, Unsubscribe } from '@/ports/stick-gateway';
import {
  SimulatedStickDevice,
  type StickSensors,
} from '@/infrastructure/ble/simulated-stick-device';

export interface SimulatedStickGatewayOptions {
  /** Identificador del bastón simulado. Se usa si `connect` no lo recibe. */
  deviceId?: string;
  /** Sobrescribe valores del payload para probar casos concretos. */
  capture?: Partial<CapturePayload>;
  /** Fuerza un fallo de conexión, como un bastón apagado. */
  failOnConnect?: boolean;
  /** Bastón simulado sobre el que se construye el gateway. */
  device?: SimulatedStickDevice;
}

const DISCONNECTED: StickStatus = {
  connected: false,
  deviceId: null,
  batteryPct: null,
  firmwareVersion: null,
  protocolVersion: null,
};

/**
 * Bastón simulado que implementa el mismo puerto que el BLE real.
 *
 * Se construye sobre `SimulatedStickDevice`, el bastón que habla el contrato:
 * microSD, configuración en memoria no volátil, CRC, MTU y cortes de
 * conexión. Así la app usa hoy el mismo camino de código que usará con el
 * bastón real. Toda captura se marca `simulated: true` para que el motor no
 * la trate como dato de campo.
 */
export class SimulatedStickGateway implements StickGateway {
  private readonly device: SimulatedStickDevice;
  private readonly options: SimulatedStickGatewayOptions;
  private currentStatus: StickStatus = DISCONNECTED;
  private connected = false;
  private readonly captureListeners = new Set<(capture: RawCapture) => void>();
  private readonly statusListeners = new Set<(status: StickStatus) => void>();

  constructor(options: SimulatedStickGatewayOptions = {}) {
    this.options = options;
    this.device =
      options.device ??
      new SimulatedStickDevice({
        deviceId: options.deviceId ?? 'simulated-stick',
        sensors: sensorsFrom(options.capture),
      });

    const battery = options.capture?.batteryPct;
    if (typeof battery === 'number') {
      this.device.setBatteryPct(battery);
    }

    const firmware = options.capture?.firmwareVersion;
    if (typeof firmware === 'string') {
      this.device.setFirmwareVersion(firmware);
    }
  }

  /** Bastón simulado sobre el que está construido el gateway. */
  simulatedDevice(): SimulatedStickDevice {
    return this.device;
  }

  async connect(deviceId: string): Promise<void> {
    if (this.options.failOnConnect) {
      throw new Error('El bastón simulado no disponible');
    }

    this.connected = true;

    const status = this.device.status();
    this.updateStatus({
      connected: true,
      deviceId: deviceId || this.device.deviceId,
      batteryPct: status.batteryPct,
      firmwareVersion: status.firmwareVersion,
      protocolVersion: '0.1',
    });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.updateStatus(DISCONNECTED);
  }

  status(): StickStatus {
    return this.currentStatus;
  }

  /**
   * Guarda el PIN del emparejamiento.
   *
   * El gateway simulado habla directamente con el dispositivo simulado, así
   * que no hay sobre cifrado que abrir; pero el PIN se valida igual para que
   * la app no acepte uno que el bastón real rechazaría.
   */
  pair(pin: string): void {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('El PIN debe tener 6 dígitos.');
    }
  }

  onCapture(listener: (capture: RawCapture) => void): Unsubscribe {
    this.captureListeners.add(listener);
    return () => this.captureListeners.delete(listener);
  }

  onStatus(listener: (status: StickStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  async requestCapture(): Promise<void> {
    if (!this.connected) {
      throw new Error('El bastón no conectado');
    }

    const record = this.device.captureNow();
    const capture = toRawCapture(record, this.device.deviceId, this.options.capture);

    this.captureListeners.forEach((listener) => listener(capture));
  }

  /**
   * Escribe al bastón el bloque de configuración de la sesión.
   *
   * A partir de esta escritura el bastón devuelve el `configId` en cada
   * captura y la puede relacionar con un lote y un cultivo. Si el bastón
   * rechaza la configuración, la escritura falla con el motivo del rechazo.
   */
  async writeConfig(config: SessionConfig): Promise<void> {
    const status = this.device.writeSessionConfig(config);

    if (!status.aceptada) {
      throw new Error(
        `El bastón no aceptó la configuración: ${status.motivo ?? 'motivo desconocido'}.`,
      );
    }
  }

  async confirm(sequence: number): Promise<void> {
    this.device.confirm(sequence);
  }

  /** Última secuencia confirmada; el BLE real la persiste en `sync_state`. */
  lastConfirmedSequence(): number {
    return this.device.lastConfirmedSequence();
  }

  private updateStatus(next: StickStatus): void {
    this.currentStatus = next;
    this.statusListeners.forEach((listener) => listener(next));
  }
}

/**
 * Convierte un registro de la microSD en la captura que maneja la app.
 *
 * El registro es la fuente: la app nunca inventa un dato que el bastón no
 * reportó. Los `overrides` solo sirven para las pruebas del simulador.
 */
export function toRawCapture(
  record: StickRecord,
  deviceId: string,
  overrides: Partial<CapturePayload> = {},
): RawCapture {
  const payload: CapturePayload = {
    latitude: record.lat,
    longitude: record.lon,
    altitudeM: record.altM,
    speedKmh: record.velKmh,
    satellites: record.sats,
    hdop: record.hdop,
    fixAgeS: record.edadFixS,
    depthCm: record.profCm,
    cropCode: overrides.cropCode ?? record.cultivo ?? 'cafe',
    plotCode: overrides.plotCode ?? record.loteId ?? null,
    lastFertilizationDate: overrides.lastFertilizationDate ?? record.fertFecha ?? null,
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

  return {
    deviceId: record.deviceId ?? deviceId,
    sequence: record.idRegistro ?? 0,
    payload,
    capturedAtUtc: `${record.fecha ?? '1970-01-01'}T${record.horaUtc ?? '00:00:00'}Z`,
    receivedAtUtc: new Date().toISOString(),
    origin: 'stick',
    flags: flagsFromBits(record.banderas ?? 0),
    configId: record.configId ?? 0,
    plotId: record.loteId ?? null,
  };
}

/** Traduce los overrides del payload a las lecturas del bastón. */
function sensorsFrom(overrides: Partial<CapturePayload> | undefined): Partial<StickSensors> {
  if (overrides === undefined) {
    return {};
  }

  const sensors: Partial<StickSensors> = {};

  const copy = (value: number | null | undefined, key: keyof StickSensors): void => {
    if (typeof value === 'number') {
      Object.assign(sensors, { [key]: value });
    }
  };

  copy(overrides.latitude, 'latitude');
  copy(overrides.longitude, 'longitude');
  copy(overrides.altitudeM, 'altitudeM');
  copy(overrides.speedKmh, 'speedKmh');
  copy(overrides.fixAgeS, 'fixAgeS');
  copy(overrides.depthCm, 'depthCm');
  copy(overrides.humidityPct, 'humidityPct');
  copy(overrides.temperatureC, 'temperatureC');
  copy(overrides.ph, 'ph');
  copy(overrides.ecUsCm, 'ecUsCm');
  copy(overrides.nMgKg, 'nMgKg');
  copy(overrides.pMgKg, 'pMgKg');
  copy(overrides.kMgKg, 'kMgKg');

  return sensors;
}
