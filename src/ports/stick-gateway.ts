import type { RawCapture } from '@/domain/capture/types';
import type { SessionConfig } from '@/domain/session/types';

/**
 * Estados del gateway del bastón.
 *
 * La máquina de estados es explícita y la UI la muestra: el usuario siempre
 * sabe en qué paso está la conexión y por qué se quedó quieta.
 *
 * ```
 * idle → scanning → connecting → discovering → ready
 * ready → configuring → ready
 * ready → capturing → ready
 * ready → syncing → ready
 * ready → reconnecting → ready | error
 * error → idle (acción manual)
 * ```
 */
export type StickGatewayState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'discovering'
  | 'ready'
  | 'configuring'
  | 'capturing'
  | 'syncing'
  | 'reconnecting'
  | 'error';

/** Estado observable del bastón. Se muestra siempre en la UI, no solo con color. */
export interface StickStatus {
  readonly connected: boolean;
  readonly deviceId: string | null;
  readonly batteryPct: number | null;
  readonly firmwareVersion: string | null;
  readonly protocolVersion: string | null;
  /** Si la microSD del bastón responde y tiene espacio. */
  readonly microSdOk?: boolean;
  /** Satélites visibles del GPS del bastón. */
  readonly satellites?: number | null;
  /** Dilución horizontal de precisión del GPS. */
  readonly hdop?: number | null;
  /** Registros que hay guardados en la microSD del bastón. */
  readonly recordCount?: number | null;
  /** Hora UTC del bastón, ISO 8601. */
  readonly deviceTimeUtc?: string | null;
  /** Estado de la máquina del gateway. */
  readonly state?: StickGatewayState;
}

/** Cancela una suscripción. Se llama al desmontar la pantalla. */
export type Unsubscribe = () => void;

/**
 * Puerto de salida hacia el bastón.
 *
 * La app real lo implementa con BLE; el desarrollo y las pruebas, con un
 * simulador. Ninguna capa de dominio o aplicación conoce BLE.
 */
export interface StickGateway {
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  status(): StickStatus;
  /** Capturas en vivo (característica Notify del contrato). */
  onCapture(listener: (capture: RawCapture) => void): Unsubscribe;
  onStatus(listener: (status: StickStatus) => void): Unsubscribe;
  /** Pulsación del gatillo simulada o comando «capturar ahora». */
  requestCapture(): Promise<void>;
  /**
   * Escribe al bastón el bloque de configuración de la sesión.
   *
   * A partir de esta escritura el bastón devuelve el `configId` en cada
   * captura y la puede relacionar con un lote y un cultivo.
   */
  writeConfig(config: SessionConfig): Promise<void>;
  /**
   * Confirma al bastón que la captura quedó guardada. Solo se llama después
   * del commit en SQLite; el bastón no borra de la microSD antes de esto.
   */
  confirm(sequence: number): Promise<void>;
}
