import type { CapturePayload, RawCapture } from '@/domain/types';
import type { StickGateway, StickStatus, Unsubscribe } from '@/ports/stick-gateway';

export interface SimulatedStickGatewayOptions {
  /** Identificador del bastón simulado. Se usa si `connect` no lo recibe. */
  deviceId?: string;
  /** Sobrescribe valores del payload para probar casos concretos. */
  capture?: Partial<CapturePayload>;
  /** Fuerza un fallo de conexión, como un bastón apagado. */
  failOnConnect?: boolean;
}

const BASE_PAYLOAD: CapturePayload = {
  latitude: 4.5339,
  longitude: -75.6811,
  altitudeM: 1550,
  speedKmh: 0.4,
  satellites: 9,
  hdop: 0.9,
  fixAgeS: 1.2,
  depthCm: 20,
  cropCode: 'cafe',
  plotCode: null,
  lastFertilizationDate: null,
  humidityPct: 38,
  temperatureC: 21.5,
  ph: 5.4,
  ecUsCm: 120,
  nMgKg: 12,
  pMgKg: 18,
  kMgKg: 95,
  batteryPct: 82,
  firmwareVersion: '0.1.0',
};

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
 * Permite cerrar los cortes 0 y 1 sin hardware y sirve de fixture de
 * integración. Toda captura se marca `simulated: true` para que el motor no
 * la trate como dato de campo.
 */
export class SimulatedStickGateway implements StickGateway {
  private currentStatus: StickStatus = DISCONNECTED;
  private sequence = 0;
  private confirmedSequence = 0;
  private readonly captureListeners = new Set<(capture: RawCapture) => void>();
  private readonly statusListeners = new Set<(status: StickStatus) => void>();
  private readonly options: SimulatedStickGatewayOptions;

  constructor(options: SimulatedStickGatewayOptions = {}) {
    this.options = options;
  }

  async connect(deviceId: string): Promise<void> {
    if (this.options.failOnConnect) {
      throw new Error('El bastón simulado no disponible');
    }

    this.updateStatus({
      connected: true,
      deviceId: deviceId || this.options.deviceId || 'simulated-stick',
      batteryPct: BASE_PAYLOAD.batteryPct,
      firmwareVersion: BASE_PAYLOAD.firmwareVersion,
      protocolVersion: '0.1',
    });
  }

  async disconnect(): Promise<void> {
    this.updateStatus(DISCONNECTED);
  }

  status(): StickStatus {
    return this.currentStatus;
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
    if (!this.currentStatus.connected) {
      throw new Error('El bastón no conectado');
    }

    this.sequence += 1;
    const now = new Date().toISOString();
    const capture: RawCapture = {
      deviceId: this.currentStatus.deviceId ?? 'simulated-stick',
      sequence: this.sequence,
      payload: { ...BASE_PAYLOAD, ...this.options.capture },
      capturedAtUtc: now,
      receivedAtUtc: now,
      origin: 'stick',
      flags: {
        positionValid: true,
        recentFix: true,
        probeOk: true,
        ecOverThreshold: false,
        timeValid: true,
        simulated: true,
      },
      configId: 0,
      plotId: null,
    };

    this.captureListeners.forEach((listener) => listener(capture));
  }

  async confirm(sequence: number): Promise<void> {
    this.confirmedSequence = Math.max(this.confirmedSequence, sequence);
  }

  /** Última secuencia confirmada; el BLE real la persiste en `sync_state`. */
  lastConfirmedSequence(): number {
    return this.confirmedSequence;
  }

  private updateStatus(next: StickStatus): void {
    this.currentStatus = next;
    this.statusListeners.forEach((listener) => listener(next));
  }
}
