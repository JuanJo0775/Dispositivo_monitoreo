/**
 * Perfil BLE del contrato ESP32 ↔ App v0.1.
 *
 * Los UUID son UUID v4 generados una vez y congelados: si cambian, es un
 * cambio de versión del protocolo y hay que migrar el lado del bastón.
 *
 * Este módulo es TypeScript puro: no importa React Native, Expo, SQLite ni
 * ninguna biblioteca BLE. Solo describe el contrato.
 */

/** Versión mayor del protocolo de tramas. Un cambio mayor bloquea la conexión. */
export const PROTOCOL_VERSION = 1;

/** UUID del servicio propio del bastón. Es lo único que se escanea. */
export const BLE_SERVICE_UUID = 'e962ff5a-2123-4b60-b472-27f62c97902e';

/** UUID de cada característica del servicio propio. */
export const BLE_CHARACTERISTICS = {
  captura: 'e605f44c-0ec9-4bf1-9500-c4ed37e3fac2',
  estado: '5b8479b5-a08b-448c-b5a2-fcb0eaae1ee3',
  syncSolicitud: 'f1d9eaec-c057-4424-8430-8bbf8c0caa44',
  syncDatos: '5f0bb6a2-26e0-4f05-a551-e37a02db2be2',
  syncConfirmacion: '57f2fa6a-d641-4915-af5b-e4da1d334861',
  configEscritura: '642892a2-1d00-469f-a6ef-0dcd5a6d4f29',
  configEstado: '92294ea6-4878-4a50-bbdd-40ca5e0de562',
  resumenEscritura: '43d59275-f1d6-4060-a89f-a8b65d97c7db',
  controlEscritura: 'edd4b57c-3a7e-4f71-8b0b-c51c0ccd55c2',
} as const;

/** Nombre de una característica del servicio propio. */
export type BleCharacteristicKey = keyof typeof BLE_CHARACTERISTICS;

/** Nombres de las características, en el orden del contrato. */
export const BLE_CHARACTERISTIC_KEYS: readonly BleCharacteristicKey[] = [
  'captura',
  'estado',
  'syncSolicitud',
  'syncDatos',
  'syncConfirmacion',
  'configEscritura',
  'configEstado',
  'resumenEscritura',
  'controlEscritura',
];

/**
 * Propiedades de cada característica según el contrato.
 *
 * `encrypted` marca las características cuyo cuerpo viaja cifrado con
 * XChaCha20-Poly1305 (el sobre va dentro del cuerpo de la trama y el CRC se
 * calcula sobre los bytes tal como viajan).
 */
export interface BleCharacteristicProperties {
  /** La app se suscribe y recibe notificaciones. */
  readonly notify: boolean;
  /** La app puede leer el valor bajo demanda. */
  readonly read: boolean;
  /** La app puede escribir el valor. */
  readonly write: boolean;
  /** El cuerpo viaja cifrado. */
  readonly encrypted: boolean;
}

/** Propiedades de cada característica del servicio propio. */
export const BLE_CHARACTERISTIC_PROPERTIES = {
  captura: { notify: true, read: false, write: false, encrypted: false },
  estado: { notify: true, read: true, write: false, encrypted: false },
  syncSolicitud: { notify: false, read: false, write: true, encrypted: false },
  syncDatos: { notify: true, read: false, write: false, encrypted: false },
  syncConfirmacion: { notify: false, read: false, write: true, encrypted: false },
  configEscritura: { notify: false, read: false, write: true, encrypted: true },
  configEstado: { notify: true, read: true, write: false, encrypted: false },
  resumenEscritura: { notify: false, read: false, write: true, encrypted: true },
  controlEscritura: { notify: false, read: false, write: true, encrypted: true },
} as const satisfies Record<BleCharacteristicKey, BleCharacteristicProperties>;

/** Dice si un texto es el nombre de una característica del contrato. */
export function isBleCharacteristicKey(value: string): value is BleCharacteristicKey {
  return Object.prototype.hasOwnProperty.call(BLE_CHARACTERISTICS, value);
}
