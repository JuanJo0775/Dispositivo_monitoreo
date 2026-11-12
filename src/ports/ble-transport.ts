/**
 * Puerto de transporte BLE.
 *
 * Es la frontera entre la app y el Bluetooth: la app habla de tramas y
 * características, no de Android ni de GATT. Así el mismo código sirve contra el
 * bastón real y contra el bastón simulado.
 */

/** Identificador del dispositivo advertising. */
export type BleDeviceId = string;

/** Resultado de un escaneo. */
export interface BleScanResult {
  readonly deviceId: BleDeviceId;
  readonly name: string | null;
  readonly rssi: number;
}

/** Característica descubierta, con sus propiedades. */
export interface BleCharacteristic {
  /** Clave dentro de `BLE_CHARACTERISTICS`. */
  readonly key: string;
  readonly uuid: string;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canNotify: boolean;
}

/** Estado de la conexión, para mostrarlo en la interfaz. */
export type BleConnectionState =
  'idle' | 'scanning' | 'connecting' | 'discovering' | 'ready' | 'disconnected' | 'error';

/** Eventos del transporte. */
export interface BleTransportEvents {
  /** Conexión perdida o caída del enlace. */
  onDisconnected(listener: () => void): () => void;
  /** Error de transporte (permisos, adaptador apagado, fallo de escritura). */
  onError(listener: (error: Error) => void): () => void;
}

/** Transporte BLE: todo lo que la app necesita del Bluetooth. */
export interface BleTransport extends BleTransportEvents {
  /** Escanea dispositivos que anuncian el servicio propio. */
  scan(options: { timeoutMs: number }): Promise<BleScanResult[]>;
  /** Conecta con un dispositivo. */
  connect(deviceId: BleDeviceId): Promise<void>;
  /** Cierra la conexión. */
  disconnect(): Promise<void>;
  /** Descubre las características del servicio propio. */
  discoverCharacteristics(): Promise<BleCharacteristic[]>;
  /** Se suscribe a las notificaciones de una característica. */
  subscribe(key: string, listener: (bytes: Uint8Array) => void): Promise<void>;
  /** Cancela la suscripción. */
  unsubscribe(key: string): Promise<void>;
  /** Escribe bytes en una característica. */
  write(key: string, bytes: Uint8Array, withResponse: boolean): Promise<void>;
  /** Negocia la MTU y devuelve la efectiva. */
  requestMtu(deviceId: BleDeviceId, mtu: number): Promise<number>;
  /** Estado actual del transporte. */
  state(): BleConnectionState;
}
