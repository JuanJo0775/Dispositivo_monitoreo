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
}
