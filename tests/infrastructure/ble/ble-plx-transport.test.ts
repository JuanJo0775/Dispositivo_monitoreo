/**
 * Pruebas del transporte BLE real.
 *
 * Se usa un doble de `react-native-ble-plx` inyectado por el constructor: las
 * pruebas no cargan el módulo nativo y pueden simular desconexiones, errores
 * y MTU efectiva.
 */

import {
  BLE_CHARACTERISTICS,
  BLE_CHARACTERISTIC_KEYS,
  BLE_CHARACTERISTIC_PROPERTIES,
  BLE_SERVICE_UUID,
} from '@/domain/protocol/ble-profile';
import type { BleCharacteristicKey } from '@/domain/protocol/ble-profile';
import {
  BlePlxTransport,
  decodeBase64,
  encodeBase64,
} from '@/infrastructure/ble/ble-plx-transport';
import type {
  BlePlxCharacteristic,
  BlePlxDevice,
  BlePlxLibrary,
  BlePlxManager,
  BlePlxScannedDevice,
  BlePlxSubscription,
} from '@/infrastructure/ble/ble-plx-transport';

interface FakeWrite {
  readonly bytes: Uint8Array;
  readonly withResponse: boolean;
}

/** Suscripción falsa: solo marca que se quitó. */
class FakeSubscription implements BlePlxSubscription {
  removed = false;

  remove(): void {
    this.removed = true;
  }
}

/** Característica falsa: guarda lo que se le escribe y avisa las notificaciones. */
class FakeCharacteristic implements BlePlxCharacteristic {
  readonly isReadable: boolean;
  readonly isWritableWithResponse: boolean;
  readonly isWritableWithoutResponse: boolean;
  readonly isNotifiable: boolean;
  readonly isIndicatable: boolean;
  readonly writes: FakeWrite[] = [];
  readonly subscription = new FakeSubscription();
  value: string | null = null;
  failWith: Error | null = null;
  private listener:
    ((error: Error | null, characteristic: BlePlxCharacteristic | null) => void) | null = null;

  constructor(
    readonly uuid: string,
    options: { read?: boolean; write?: boolean; notify?: boolean } = {},
  ) {
    this.isReadable = options.read ?? false;
    this.isWritableWithResponse = options.write ?? false;
    this.isWritableWithoutResponse = options.write ?? false;
    this.isNotifiable = options.notify ?? false;
    this.isIndicatable = options.notify ?? false;
  }

  async writeWithResponse(value: string): Promise<unknown> {
    return this.write(value, true);
  }

  async writeWithoutResponse(value: string): Promise<unknown> {
    return this.write(value, false);
  }

  monitor(
    listener: (error: Error | null, characteristic: BlePlxCharacteristic | null) => void,
  ): BlePlxSubscription {
    this.listener = listener;
    return this.subscription;
  }

  /** Simula una notificación del bastón. */
  notify(bytes: Uint8Array): void {
    this.value = encodeBase64(bytes);
    this.listener?.(null, this);
  }

  private write(value: string, withResponse: boolean): unknown {
    if (this.failWith !== null) {
      throw this.failWith;
    }
    this.writes.push({ bytes: decodeBase64(value), withResponse });
    return this;
  }
}

/** Dispositivo falso: sirve las características y avisa la caída del enlace. */
class FakeDevice implements BlePlxDevice {
  mtu = 23;
  discovered = false;
  readonly disconnectionSubscription = new FakeSubscription();
  private disconnectionListener: ((error: Error | null) => void) | null = null;

  constructor(
    readonly id: string,
    private readonly characteristicsByService: Map<string, FakeCharacteristic[]>,
  ) {}

  async discoverAllServicesAndCharacteristics(): Promise<BlePlxDevice> {
    this.discovered = true;
    return this;
  }

  async characteristicsForService(serviceUuid: string): Promise<BlePlxCharacteristic[]> {
    return this.characteristicsByService.get(serviceUuid) ?? [];
  }

  onDisconnected(listener: (error: Error | null) => void): BlePlxSubscription {
    this.disconnectionListener = listener;
    return this.disconnectionSubscription;
  }

  /** Simula que el bastón se cae. */
  drop(error: Error | null = null): void {
    this.disconnectionListener?.(error);
  }
}

/** Gestor falso: es el singleton que pide el transporte al construirse. */
class FakeManager implements BlePlxManager {
  static shared: FakeManager | null = null;

  readonly scanResults: FakeScannedDevice[] = [];
  readonly devices = new Map<string, FakeDevice>();
  readonly mtuRequests: { deviceId: string; mtu: number }[] = [];
  readonly cancelled: string[] = [];
  scanFilter: string[] | null = null;
  stopScanCalls = 0;
  effectiveMtu = 185;

  constructor() {
    if (FakeManager.shared !== null) {
      return FakeManager.shared;
    }
    FakeManager.shared = this;
  }

  async startDeviceScan(
    uuids: string[] | null,
    options: { allowDuplicates?: boolean } | null,
    listener: (error: Error | null, device: BlePlxScannedDevice | null) => void,
  ): Promise<void> {
    this.scanFilter = uuids;
    this.scanResults.forEach((device) => listener(null, device));
  }

  async stopDeviceScan(): Promise<void> {
    this.stopScanCalls += 1;
  }

  async connectToDevice(deviceId: string): Promise<BlePlxDevice> {
    const device = this.devices.get(deviceId);
    if (device === undefined) {
      throw new Error(`No hay ningún dispositivo con id ${deviceId}`);
    }
    return device;
  }

  async cancelDeviceConnection(deviceId: string): Promise<BlePlxDevice> {
    this.cancelled.push(deviceId);
    const device = this.devices.get(deviceId);
    if (device === undefined) {
      throw new Error(`No hay ningún dispositivo con id ${deviceId}`);
    }
    return device;
  }

  async requestMTUForDevice(deviceId: string, mtu: number): Promise<BlePlxDevice> {
    this.mtuRequests.push({ deviceId, mtu });
    const device = this.devices.get(deviceId);
    if (device === undefined) {
      throw new Error(`No hay ningún dispositivo con id ${deviceId}`);
    }
    device.mtu = this.effectiveMtu;
    return device;
  }
}

/** Dispositivo escaneado falso. */
class FakeScannedDevice implements BlePlxScannedDevice {
  constructor(
    readonly id: string,
    readonly name: string | null,
    readonly rssi: number | null,
    readonly serviceUUIDs: string[] | null = null,
  ) {}
}

/** Biblioteca sin módulo nativo: al construir el gestor revienta. */
class BibliotecaSinNativo implements BlePlxManager {
  constructor() {
    throw new Error('Native module BlePlx not found');
  }

  startDeviceScan(): Promise<void> {
    return Promise.reject(new Error('No aplica'));
  }

  stopDeviceScan(): Promise<void> {
    return Promise.resolve();
  }

  connectToDevice(): Promise<BlePlxDevice> {
    return Promise.reject(new Error('No aplica'));
  }

  cancelDeviceConnection(): Promise<BlePlxDevice> {
    return Promise.reject(new Error('No aplica'));
  }

  requestMTUForDevice(): Promise<BlePlxDevice> {
    return Promise.reject(new Error('No aplica'));
  }
}

/** `Buffer` del runtime, si existe (Node en las pruebas). */
function testBuffer(): { from(data: Uint8Array): { toString(encoding: string): string } } | null {
  const runtime = globalThis as unknown as {
    Buffer?: { from(data: Uint8Array): { toString(encoding: string): string } };
  };
  return runtime.Buffer ?? null;
}

/** Crea las nueve características del perfil con sus propiedades del contrato. */
function makeProfileCharacteristics(): Map<string, FakeCharacteristic[]> {
  const characteristics = BLE_CHARACTERISTIC_KEYS.map((key) => {
    const properties = BLE_CHARACTERISTIC_PROPERTIES[key];
    return new FakeCharacteristic(BLE_CHARACTERISTICS[key], {
      read: properties.read,
      write: properties.write,
      notify: properties.notify,
    });
  });

  return new Map<string, FakeCharacteristic[]>([[BLE_SERVICE_UUID, characteristics]]);
}

/** Busca la característica falsa de una clave del perfil. */
function fakeCharacteristic(
  characteristics: Map<string, FakeCharacteristic[]>,
  key: BleCharacteristicKey,
): FakeCharacteristic {
  const list = characteristics.get(BLE_SERVICE_UUID) ?? [];
  const found = list.find((characteristic) => characteristic.uuid === BLE_CHARACTERISTICS[key]);
  if (found === undefined) {
    throw new Error(`El doble no tiene la característica ${key}`);
  }
  return found;
}

describe('BlePlxTransport', () => {
  let manager: FakeManager;
  let transport: BlePlxTransport;
  let device: FakeDevice;
  let characteristics: Map<string, FakeCharacteristic[]>;

  beforeEach(async () => {
    FakeManager.shared = null;
    manager = new FakeManager();
    transport = new BlePlxTransport({ library: { BleManager: FakeManager } });

    characteristics = makeProfileCharacteristics();
    device = new FakeDevice('AA:BB:CC:DD:EE:FF', characteristics);
    manager.devices.set(device.id, device);
  });

  it('el escaneo devuelve solo los dispositivos del servicio propio', async () => {
    manager.scanResults.push(
      new FakeScannedDevice('AA:BB:CC:DD:EE:FF', 'Bastón', -55, [BLE_SERVICE_UUID]),
      new FakeScannedDevice('11:22:33:44:55:66', 'Otro bastón', -80, ['servicio-ajeno']),
    );

    const results = await transport.scan({ timeoutMs: 5 });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      deviceId: 'AA:BB:CC:DD:EE:FF',
      name: 'Bastón',
      rssi: -55,
    });
    expect(manager.scanFilter).toEqual([BLE_SERVICE_UUID]);
  });

  it('el escaneo se cancela al cumplirse el tiempo', async () => {
    await transport.scan({ timeoutMs: 5 });

    expect(manager.stopScanCalls).toBe(1);
    expect(transport.state()).toBe('idle');
  });

  it('conectar y descubrir expone las nueve características con sus claves', async () => {
    await transport.connect(device.id);
    expect(transport.state()).toBe('discovering');
    expect(device.discovered).toBe(true);

    const discovered = await transport.discoverCharacteristics();

    expect(discovered).toHaveLength(9);
    expect(discovered.map((characteristic) => characteristic.key)).toEqual([
      ...BLE_CHARACTERISTIC_KEYS,
    ]);
    expect(transport.state()).toBe('ready');
  });

  it('las características traen las propiedades del contrato', async () => {
    await transport.connect(device.id);
    const discovered = await transport.discoverCharacteristics();

    const estado = discovered.find((characteristic) => characteristic.key === 'estado');
    expect(estado).toEqual({
      key: 'estado',
      uuid: BLE_CHARACTERISTICS.estado,
      canRead: true,
      canWrite: false,
      canNotify: true,
    });

    const syncSolicitud = discovered.find(
      (characteristic) => characteristic.key === 'syncSolicitud',
    );
    expect(syncSolicitud?.canWrite).toBe(true);
    expect(syncSolicitud?.canNotify).toBe(false);

    const captura = discovered.find((characteristic) => characteristic.key === 'captura');
    expect(captura?.canNotify).toBe(true);
    expect(captura?.canRead).toBe(false);
  });

  it('escribir entrega los bytes exactos a la característica correcta', async () => {
    await transport.connect(device.id);
    await transport.discoverCharacteristics();

    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0xfe]);
    await transport.write('syncSolicitud', bytes, true);

    const escrita = fakeCharacteristic(characteristics, 'syncSolicitud');
    expect(escrita.writes).toHaveLength(1);
    expect(Array.from(escrita.writes[0]?.bytes ?? [])).toEqual([0x01, 0x02, 0x03, 0xfe]);
    expect(escrita.writes[0]?.withResponse).toBe(true);
    expect(fakeCharacteristic(characteristics, 'controlEscritura').writes).toHaveLength(0);
  });

  it('escribir sin respuesta no pide confirmación al bastón', async () => {
    await transport.connect(device.id);
    await transport.discoverCharacteristics();

    await transport.write('syncConfirmacion', new Uint8Array([0x09]), false);

    const escrita = fakeCharacteristic(characteristics, 'syncConfirmacion');
    expect(escrita.writes[0]?.withResponse).toBe(false);
  });

  it('la MTU negociada se devuelve', async () => {
    manager.effectiveMtu = 185;

    const mtu = await transport.requestMtu(device.id, 247);

    expect(mtu).toBe(185);
    expect(manager.mtuRequests).toEqual([{ deviceId: device.id, mtu: 247 }]);
  });

  it('una desconexión emite el evento y cambia el estado', async () => {
    await transport.connect(device.id);
    await transport.discoverCharacteristics();

    const eventos: string[] = [];
    transport.onDisconnected(() => eventos.push('desconectado'));

    device.drop();

    expect(eventos).toEqual(['desconectado']);
    expect(transport.state()).toBe('disconnected');
  });

  it('un error de la biblioteca emite el evento de error', async () => {
    await transport.connect(device.id);
    await transport.discoverCharacteristics();

    const errores: Error[] = [];
    transport.onError((error) => errores.push(error));

    const falla = new Error('No se pudo escribir en la característica');
    fakeCharacteristic(characteristics, 'syncSolicitud').failWith = falla;

    await expect(transport.write('syncSolicitud', new Uint8Array([0x01]), true)).rejects.toThrow(
      'No se pudo escribir en la característica',
    );

    expect(errores).toHaveLength(1);
    expect(errores[0]?.message).toBe('No se pudo escribir en la característica');
  });

  it('las notificaciones llegan al suscriptor y se cancelan al desuscribir', async () => {
    await transport.connect(device.id);
    await transport.discoverCharacteristics();

    const recibidas: number[][] = [];
    await transport.subscribe('captura', (bytes) => recibidas.push(Array.from(bytes)));

    const captura = fakeCharacteristic(characteristics, 'captura');
    captura.notify(new Uint8Array([0x0a, 0x0b]));

    expect(recibidas).toEqual([[0x0a, 0x0b]]);

    await transport.unsubscribe('captura');
    expect(captura.subscription.removed).toBe(true);
  });

  it('el constructor explica en español que hace falta el build nativo', () => {
    const library: BlePlxLibrary = { BleManager: BibliotecaSinNativo };

    expect(() => new BlePlxTransport({ library })).toThrow(/build nativo/);
  });

  it('la codificación en base64 coincide con la de Buffer', () => {
    const buffer = testBuffer();
    expect(buffer).not.toBeNull();
    if (buffer === null) {
      return;
    }

    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const base64 = buffer.from(bytes).toString('base64');

    expect(encodeBase64(bytes)).toBe(base64);
    expect(Array.from(decodeBase64(base64))).toEqual(Array.from(bytes));
  });
});
