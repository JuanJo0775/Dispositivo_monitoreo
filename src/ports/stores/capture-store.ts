import type { RawCapture } from '@/domain/capture/types';

/** Almacén de capturas crudas. Inmutable: solo se insertan y se leen. */
export interface CaptureStore {
  insertRaw(capture: RawCapture): Promise<void>;
  /** Identidad de la captura: `device_id + sequence`. */
  findByDeviceSequence(deviceId: string, sequence: number): Promise<RawCapture | null>;
}
