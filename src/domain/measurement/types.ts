import type { CapturePayload } from '../capture/types';

/** Medición derivada de una captura: lo que el agricultor ve en el historial. */
export interface Measurement {
  readonly id: string;
  /** Clave de la captura de origen: `deviceId:sequence`. */
  readonly captureId: string;
  readonly plotId: string | null;
  readonly payload: CapturePayload;
  readonly capturedAtUtc: string;
  readonly valid: boolean;
  readonly invalidReasons: readonly string[];
  readonly notes: string | null;
  readonly photoPath: string | null;
  /** Borrado lógico; una medición descartada no se borra ni se recalcula. */
  readonly discardedAt: string | null;
  readonly createdAt: string;
}
