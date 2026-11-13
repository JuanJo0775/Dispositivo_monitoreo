/**
 * Transporte BLE real sobre `react-native-ble-plx`.
 *
 * Traduce la API de la biblioteca al puerto `BleTransport`: la app habla de
 * características del contrato, no de GATT ni de Android. El perfil de UUID
 * vive congelado en `src/domain/protocol/ble-profile.ts`.
 *
 * El módulo nativo se carga con `require` diferido, dentro del constructor,
 * para que las pruebas y cualquier entorno sin nativo no lo carguen. En la
 * app real hace falta un build nativo (dev client o APK): Expo Go no trae el
 * módulo de Bluetooth.
 */

import {
  BLE_CHARACTERISTICS,
  BLE_CHARACTERISTIC_KEYS,
  BLE_SERVICE_UUID,
} from '@/domain/protocol/ble-profile';
import type {
  BleCharacteristic,
  BleConnectionState,
  BleScanResult,
  BleTransport,
} from '@/ports/ble-transport';
import type { BleManager as ReactNativeBleManager } from 'react-native-ble-plx';

/** Mensaje único cuando la biblioteca nativa no está disponible. */
const MISSING_NATIVE_MESSAGE =
  'No se pudo cargar el módulo nativo de BLE (react-native-ble-plx). ' +
  'La app necesita un build nativo: ejecuta `expo prebuild` y usa un dev client o un APK. ' +
  'Expo Go no incluye el módulo de Bluetooth.';

/** Suscripción de la biblioteca: notificaciones o vigilancia de conexión. */
export interface BlePlxSubscription {
  remove(): void;
}

/** Dispositivo durante el escaneo: lo mínimo que se necesita para listarlo. */
export interface BlePlxScannedDevice {
  readonly id: string;
  readonly name: string | null;
  readonly rssi: number | null;
  readonly localName?: string | null;
  readonly serviceUUIDs?: readonly string[] | null;
}

/** Característica de la biblioteca: solo lo que usa el transporte. */
export interface BlePlxCharacteristic {
  readonly uuid: string;
  readonly isReadable: boolean;
  readonly isWritableWithResponse: boolean;
  readonly isWritableWithoutResponse: boolean;
  readonly isNotifiable: boolean;
  readonly isIndicatable: boolean;
  readonly value: string | null;
  writeWithResponse(value: string): Promise<unknown>;
  writeWithoutResponse(value: string): Promise<unknown>;
  monitor(
    listener: (error: Error | null, characteristic: BlePlxCharacteristic | null) => void,
  ): BlePlxSubscription;
}

/** Dispositivo conectado: lo mínimo que usa el transporte. */
export interface BlePlxDevice {
  readonly id: string;
  readonly mtu: number;
  discoverAllServicesAndCharacteristics(): Promise<BlePlxDevice>;
  characteristicsForService(serviceUuid: string): Promise<BlePlxCharacteristic[]>;
  onDisconnected(listener: (error: Error | null) => void): BlePlxSubscription;
}

/** Gestor de BLE: lo mínimo que usa el transporte. */
export interface BlePlxManager {
  startDeviceScan(
    uuids: string[] | null,
    options: { allowDuplicates?: boolean } | null,
    listener: (error: Error | null, device: BlePlxScannedDevice | null) => void,
  ): Promise<void>;
  stopDeviceScan(): Promise<void>;
  connectToDevice(deviceId: string, options?: unknown): Promise<BlePlxDevice>;
  cancelDeviceConnection(deviceId: string): Promise<BlePlxDevice>;
  requestMTUForDevice(deviceId: string, mtu: number): Promise<BlePlxDevice>;
}

/** Forma de la biblioteca: solo se usa `BleManager`. */
export interface BlePlxLibrary {
  readonly BleManager: new () => BlePlxManager;
}

/** Obliga a que el tipo sea `true`: si no, el typecheck falla. */
type Assert<T extends true> = T;

/**
 * El `BleManager` real debe encajar con la interfaz mínima de arriba. Si la
 * biblioteca cambia su API, esto deja de compilar y avisa en el typecheck.
 */
export type BlePlxManagerIsCompatible = Assert<
  ReactNativeBleManager extends BlePlxManager ? true : false
>;

/** Opciones del transporte. */
export interface BlePlxTransportOptions {
  /**
   * Biblioteca ya cargada. Las pruebas inyectan aquí un doble; en la app se
   * carga `react-native-ble-plx` con `require` diferido.
   */
  library?: BlePlxLibrary;
}

/**
 * Transporte BLE real: habla con el bastón a través de `react-native-ble-plx`.
 *
 * La máquina de estados es la del contrato: `idle → scanning → connecting →
 * discovering → ready`, con `disconnected` y `error` como salidas.
 */
export class BlePlxTransport implements BleTransport {
  private readonly manager: BlePlxManager;
  private readonly disconnectListeners = new Set<() => void>();
  private readonly errorListeners = new Set<(error: Error) => void>();
  private readonly monitors = new Map<string, BlePlxSubscription>();
  private readonly characteristics = new Map<string, BlePlxCharacteristic>();
  private currentState: BleConnectionState = 'idle';
  private device: BlePlxDevice | null = null;
  private deviceId: string | null = null;
  private disconnectionWatcher: BlePlxSubscription | null = null;

  constructor(options: BlePlxTransportOptions = {}) {
    this.manager = createManager(options.library);
  }

  /** Escanea los dispositivos que anuncian el servicio propio del bastón. */
  async scan(options: { timeoutMs: number }): Promise<BleScanResult[]> {
    const found = new Map<string, BleScanResult>();
    this.setState('scanning');

    try {
      await this.manager.startDeviceScan(
        [BLE_SERVICE_UUID],
        { allowDuplicates: false },
        (error, device) => {
          if (error !== null) {
            this.reportError(toError(error));
            return;
          }
          if (device === null) {
            return;
          }
          const result = toScanResult(device);
          if (result === null) {
            return;
          }
          found.set(result.deviceId, result);
        },
      );

      await delay(options.timeoutMs);
    } catch (error) {
      this.setState('error');
      this.reportError(toError(error));
      throw toError(error);
    } finally {
      try {
        await this.manager.stopDeviceScan();
      } catch (error) {
        this.reportError(toError(error));
      }
    }

    this.setState('idle');
    return [...found.values()];
  }

  /** Conecta con el bastón y deja los servicios descubiertos. */
  async connect(deviceId: string): Promise<void> {
    this.setState('connecting');

    try {
      const device = await this.manager.connectToDevice(deviceId);
      this.device = device;
      this.deviceId = deviceId;
      this.watchDisconnection(device);
      await device.discoverAllServicesAndCharacteristics();
      this.setState('discovering');
    } catch (error) {
      this.device = null;
      this.deviceId = null;
      this.setState('error');
      this.reportError(toError(error));
      throw toError(error);
    }
  }

  /** Cierra la conexión con el bastón. */
  async disconnect(): Promise<void> {
    const deviceId = this.deviceId;

    try {
      if (deviceId !== null) {
        await this.manager.cancelDeviceConnection(deviceId);
      }
    } catch (error) {
      this.reportError(toError(error));
    } finally {
      this.release();
      this.setState('disconnected');
    }
  }

  /** Devuelve las características del servicio propio con su clave del perfil. */
  async discoverCharacteristics(): Promise<BleCharacteristic[]> {
    const device = this.device;
    if (device === null) {
      throw new Error('No hay ningún bastón conectado');
    }

    try {
      const discovered = await device.characteristicsForService(BLE_SERVICE_UUID);
      this.characteristics.clear();

      const result: BleCharacteristic[] = [];
      for (const key of BLE_CHARACTERISTIC_KEYS) {
        const uuid = BLE_CHARACTERISTICS[key];
        const characteristic = discovered.find(
          (candidate) => candidate.uuid.toLowerCase() === uuid.toLowerCase(),
        );
        if (characteristic === undefined) {
          continue;
        }
        this.characteristics.set(key, characteristic);
        result.push({
          key,
          uuid,
          canRead: characteristic.isReadable,
          canWrite:
            characteristic.isWritableWithResponse || characteristic.isWritableWithoutResponse,
          canNotify: characteristic.isNotifiable || characteristic.isIndicatable,
        });
      }

      this.setState('ready');
      return result;
    } catch (error) {
      this.setState('error');
      this.reportError(toError(error));
      throw toError(error);
    }
  }

  /** Se suscribe a las notificaciones de una característica del perfil. */
  async subscribe(key: string, listener: (bytes: Uint8Array) => void): Promise<void> {
    const characteristic = this.characteristics.get(key);
    if (characteristic === undefined) {
      throw new Error(`La característica "${key}" no está descubierta`);
    }

    const previous = this.monitors.get(key);
    if (previous !== undefined) {
      previous.remove();
    }

    const subscription = characteristic.monitor((error, notified) => {
      if (error !== null) {
        this.reportError(toError(error));
        return;
      }
      if (notified === null || notified.value === null) {
        return;
      }
      listener(decodeBase64(notified.value));
    });

    this.monitors.set(key, subscription);
  }

  /** Cancela la suscripción de una característica. */
  async unsubscribe(key: string): Promise<void> {
    const subscription = this.monitors.get(key);
    if (subscription === undefined) {
      return;
    }
    subscription.remove();
    this.monitors.delete(key);
  }

  /** Escribe bytes exactos en una característica del perfil. */
  async write(key: string, bytes: Uint8Array, withResponse: boolean): Promise<void> {
    const characteristic = this.characteristics.get(key);
    if (characteristic === undefined) {
      throw new Error(`La característica "${key}" no está descubierta`);
    }

    const encoded = encodeBytes(bytes);

    try {
      if (withResponse) {
        await characteristic.writeWithResponse(encoded);
      } else {
        await characteristic.writeWithoutResponse(encoded);
      }
    } catch (error) {
      this.reportError(toError(error));
      throw toError(error);
    }
  }

  /** Negocia la MTU y devuelve la efectiva. */
  async requestMtu(deviceId: string, mtu: number): Promise<number> {
    try {
      const device = await this.manager.requestMTUForDevice(deviceId, mtu);
      return device.mtu;
    } catch (error) {
      this.reportError(toError(error));
      throw toError(error);
    }
  }

  /** Estado actual del transporte. */
  state(): BleConnectionState {
    return this.currentState;
  }

  /** Avisa cuando se cae el enlace con el bastón. */
  onDisconnected(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => {
      this.disconnectListeners.delete(listener);
    };
  }

  /** Avisa los errores de transporte (permisos, adaptador apagado, escritura). */
  onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /** Vigila la caída del enlace para actualizar el estado y avisar. */
  private watchDisconnection(device: BlePlxDevice): void {
    this.disconnectionWatcher = device.onDisconnected((error) => {
      this.release();
      this.setState('disconnected');
      if (error !== null) {
        this.reportError(toError(error));
      }
      this.disconnectListeners.forEach((listener) => listener());
    });
  }

  /** Suelta notificaciones y referencias del dispositivo. */
  private release(): void {
    this.monitors.forEach((subscription) => subscription.remove());
    this.monitors.clear();
    this.characteristics.clear();
    this.disconnectionWatcher?.remove();
    this.disconnectionWatcher = null;
    this.device = null;
    this.deviceId = null;
  }

  private setState(next: BleConnectionState): void {
    this.currentState = next;
  }

  private reportError(error: Error): void {
    this.errorListeners.forEach((listener) => listener(error));
  }
}

/** Crea el gestor de BLE: la biblioteca inyectada o la nativa, con `require` diferido. */
function createManager(library?: BlePlxLibrary): BlePlxManager {
  const loaded = library ?? loadLibrary();

  try {
    return new loaded.BleManager();
  } catch (error) {
    throw new Error(`${MISSING_NATIVE_MESSAGE} Detalle: ${toError(error).message}`);
  }
}

/** Carga `react-native-ble-plx` de forma diferida. */
function loadLibrary(): BlePlxLibrary {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-ble-plx') as BlePlxLibrary;
  } catch {
    throw new Error(MISSING_NATIVE_MESSAGE);
  }
}

/** Traduce un dispositivo escaneado al resultado del puerto. */
function toScanResult(device: BlePlxScannedDevice): BleScanResult | null {
  if (!advertisesOwnService(device)) {
    return null;
  }

  return {
    deviceId: device.id,
    name: device.name ?? device.localName ?? null,
    rssi: device.rssi ?? 0,
  };
}

/**
 * Dice si el dispositivo anuncia el servicio propio.
 *
 * El filtro nativo ya deja pasar solo los dispositivos correctos; aquí se
 * descarta al que anuncie otros servicios, que es lo que reportan algunas
 * plataformas cuando el filtro no alcanza.
 */
function advertisesOwnService(device: BlePlxScannedDevice): boolean {
  const advertised = device.serviceUUIDs;
  if (advertised === null || advertised === undefined || advertised.length === 0) {
    return true;
  }
  return advertised.some((uuid) => uuid.toLowerCase() === BLE_SERVICE_UUID);
}

/** Espera el tiempo indicado. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Convierte cualquier error en un `Error`. */
function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const BASE64_VALUES = new Map<string, number>(
  [...BASE64_ALPHABET].map((character, index) => [character, index]),
);

/** Parte de `Buffer` que hace falta para codificar. */
interface BufferLike {
  from(data: Uint8Array): { toString(encoding: string): string };
}

/** `Buffer` si el runtime lo tiene (Node, pruebas); Hermes no lo trae. */
function runtimeBuffer(): BufferLike | null {
  const runtime = globalThis as unknown as { Buffer?: BufferLike };
  return runtime.Buffer ?? null;
}

/**
 * Codifica los bytes para la biblioteca, que los espera en base64.
 *
 * En la base (Node, pruebas) se convierte a `Buffer`; en Hermes, que no lo
 * trae, se codifica a mano para no depender del nativo.
 */
function encodeBytes(bytes: Uint8Array): string {
  const buffer = runtimeBuffer();
  if (buffer !== null) {
    return buffer.from(bytes).toString('base64');
  }
  return encodeBase64(bytes);
}

/** Codifica bytes en base64 sin depender de `Buffer`. */
export function encodeBase64(bytes: Uint8Array): string {
  let result = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1];
    const byte3 = bytes[index + 2];

    result += BASE64_ALPHABET.charAt(byte1 >> 2);
    result += BASE64_ALPHABET.charAt(((byte1 & 0x03) << 4) | ((byte2 ?? 0) >> 4));
    result +=
      byte2 === undefined
        ? '='
        : BASE64_ALPHABET.charAt(((byte2 & 0x0f) << 2) | ((byte3 ?? 0) >> 6));
    result += byte3 === undefined ? '=' : BASE64_ALPHABET.charAt(byte3 & 0x3f);
  }

  return result;
}

/** Decodifica base64 a bytes sin depender de `Buffer`. */
export function decodeBase64(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let offset = 0;

  for (let index = 0; index < clean.length; index += 4) {
    const first = BASE64_VALUES.get(clean.charAt(index)) ?? 0;
    const second = BASE64_VALUES.get(clean.charAt(index + 1)) ?? 0;
    const third = BASE64_VALUES.get(clean.charAt(index + 2)) ?? 0;
    const fourth = BASE64_VALUES.get(clean.charAt(index + 3)) ?? 0;

    bytes[offset] = (first << 2) | (second >> 4);
    if (offset + 1 < bytes.length) {
      bytes[offset + 1] = ((second & 0x0f) << 4) | (third >> 2);
    }
    if (offset + 2 < bytes.length) {
      bytes[offset + 2] = ((third & 0x03) << 6) | fourth;
    }
    offset += 3;
  }

  return bytes;
}
