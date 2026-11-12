/**
 * Transporte BLE falso: monta el bastón simulado detrás del puerto de
 * transporte.
 *
 * Es la contraparte de `BlePlxTransport` (el transporte real): la app habla
 * de tramas y características, y aquí esas tramas llegan al bastón simulado.
 */

import {
  BLE_CHARACTERISTICS,
  BLE_CHARACTERISTIC_KEYS,
  BLE_CHARACTERISTIC_PROPERTIES,
  isBleCharacteristicKey,
} from '@/domain/protocol/ble-profile';
import type {
  BleCharacteristic,
  BleConnectionState,
  BleScanResult,
  BleTransport,
} from '@/ports/ble-transport';
import type { SimulatedStickDevice } from './simulated-stick-device';

/**
 * Características del contrato, con las propiedades reales del perfil.
 */
export function contractCharacteristics(): BleCharacteristic[] {
  return BLE_CHARACTERISTIC_KEYS.map((key) => {
    const properties = BLE_CHARACTERISTIC_PROPERTIES[key];
    return {
      key,
      uuid: BLE_CHARACTERISTICS[key],
      canRead: properties.read,
      canWrite: properties.write,
      canNotify: properties.notify,
    };
  });
}

/**
 * Crea un transporte BLE falso sobre un bastón simulado.
 *
 * El escaneo devuelve el propio bastón; conectar descubre las características
 * del perfil congelado; las escrituras llegan al bastón y las notificaciones
 * que el bastón emite llegan a los suscriptores.
 */
export function makeFakeBleTransport(device: SimulatedStickDevice): BleTransport {
  const subscriptions = new Map<string, Set<(bytes: Uint8Array) => void>>();
  const lastNotification = new Map<string, Uint8Array>();
  const disconnectListeners = new Set<() => void>();
  const errorListeners = new Set<(error: Error) => void>();

  let connectionState: BleConnectionState = 'idle';

  device.onEvent((event) => {
    if (event.type === 'notify') {
      lastNotification.set(event.characteristic, event.bytes);
      const listeners = subscriptions.get(event.characteristic);
      listeners?.forEach((listener) => listener(event.bytes));
      return;
    }

    if (event.type === 'disconnected') {
      connectionState = 'disconnected';
      disconnectListeners.forEach((listener) => listener());
      return;
    }

    errorListeners.forEach((listener) => listener(event.error));
  });

  return {
    async scan(): Promise<BleScanResult[]> {
      connectionState = 'scanning';

      if (!device.isVisible()) {
        connectionState = 'idle';
        return [];
      }

      const results: BleScanResult[] = [
        { deviceId: device.deviceId, name: device.name, rssi: device.rssi },
      ];

      connectionState = 'idle';

      return results;
    },

    async connect(deviceId: string): Promise<void> {
      connectionState = 'connecting';

      if (deviceId !== device.deviceId) {
        connectionState = 'error';
        throw new Error(`No se conoce el dispositivo ${deviceId}.`);
      }

      try {
        device.assertProtocolCompatible();
      } catch (error) {
        connectionState = 'error';
        throw error;
      }

      connectionState = 'ready';
      device.notifyStatus();
    },

    async disconnect(): Promise<void> {
      connectionState = 'disconnected';
    },

    async discoverCharacteristics(): Promise<BleCharacteristic[]> {
      connectionState = 'discovering';

      const characteristics = contractCharacteristics();

      connectionState = 'ready';

      return characteristics;
    },

    async subscribe(key: string, listener: (bytes: Uint8Array) => void): Promise<void> {
      if (!isBleCharacteristicKey(key)) {
        throw new Error(`Característica desconocida del contrato: ${key}.`);
      }

      const listeners = subscriptions.get(key) ?? new Set<(bytes: Uint8Array) => void>();
      listeners.add(listener);
      subscriptions.set(key, listeners);

      // El transporte real deja leer la característica al suscribirse: aquí se
      // entrega la última notificación conocida, si la hay.
      const pending = lastNotification.get(key);
      if (pending !== undefined) {
        listener(pending);
      }
    },

    async unsubscribe(key: string): Promise<void> {
      subscriptions.delete(key);
    },

    async write(key: string, bytes: Uint8Array, _withResponse: boolean): Promise<void> {
      if (!isBleCharacteristicKey(key)) {
        throw new Error(`Característica desconocida del contrato: ${key}.`);
      }

      device.handleWrite(key, bytes);
    },

    async requestMtu(_deviceId: string, mtu: number): Promise<number> {
      return device.negotiateMtu(mtu);
    },

    state(): BleConnectionState {
      return connectionState;
    },

    onDisconnected(listener: () => void): () => void {
      disconnectListeners.add(listener);
      return () => {
        disconnectListeners.delete(listener);
      };
    },

    onError(listener: (error: Error) => void): () => void {
      errorListeners.add(listener);
      return () => {
        errorListeners.delete(listener);
      };
    },
  };
}
