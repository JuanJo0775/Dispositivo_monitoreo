import type { DiagnosisResult } from '@/domain/diagnosis/types';

/**
 * Diagnóstico guardado: el resultado del motor más las versiones y el contexto
 * con los que se calculó, para que un recálculo pueda detectar que cambió algo.
 */
export interface StoredDiagnosis {
  readonly id: string;
  readonly measurementId: string;
  readonly engineVersion: string;
  readonly thresholdsVersion: string;
  readonly calibrationVersion: string;
  readonly firmwareVersion: string | null;
  readonly contextSnapshot: Record<string, unknown>;
  readonly result: DiagnosisResult;
  readonly explanation: string;
  readonly createdAt: string;
}

/** Almacén de diagnósticos calculados. */
export interface DiagnosisStore {
  insert(diagnosis: StoredDiagnosis): Promise<void>;
  get(id: string): Promise<StoredDiagnosis | null>;
  listByMeasurement(measurementId: string): Promise<StoredDiagnosis[]>;
}
