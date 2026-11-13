import type { Measurement } from '@/domain/measurement/types';

export interface MeasurementFilter {
  readonly plotId?: string;
  /** Por defecto `false`: las mediciones descartadas no se listan. */
  readonly includeDiscarded?: boolean;
}

/** Almacén de mediciones derivadas. El crudo vive en `captures`. */
export interface MeasurementStore {
  insert(measurement: Measurement): Promise<void>;
  list(filter?: MeasurementFilter): Promise<Measurement[]>;
  get(id: string): Promise<Measurement | null>;
  /** Asigna el lote a una medición ya guardada; no toca el resto de la fila. */
  setPlotId(id: string, plotId: string | null): Promise<void>;
  /** Asigna la sesión resuelta; `null` la deja sin sesión. */
  setSessionId(id: string, sessionId: string | null): Promise<void>;
  /** Fija la bandera de posición que sobrevive a la captura. */
  setPositionValid(id: string, positionValid: boolean): Promise<void>;
}
