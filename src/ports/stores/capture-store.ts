import type { RawCapture } from '@/domain/capture/types';

/** Almacén de capturas crudas. Inmutable: solo se insertan y se leen. */
export interface CaptureStore {
  insertRaw(capture: RawCapture): Promise<void>;
  /** Identidad de la captura: `device_id + sequence`. */
  findByDeviceSequence(deviceId: string, sequence: number): Promise<RawCapture | null>;
  /** Todas las capturas, de la más antigua a la más reciente. */
  listAll(): Promise<RawCapture[]>;
  /**
   * Asigna el lote a una captura ya guardada; no toca el contenido crudo.
   *
   * Es metadato: sirve para ubicar en el mapa lo que se guardó antes de que la
   * ingesta resolviera el lote.
   */
  setPlotId(deviceId: string, sequence: number, plotId: string | null): Promise<void>;
}
