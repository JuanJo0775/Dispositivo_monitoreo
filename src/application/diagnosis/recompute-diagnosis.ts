import { diagnose } from '@/domain/diagnosis/diagnose';
import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { DiagnosisContext, DiagnosisResult } from '@/domain/diagnosis/types';
import type { Clock } from '@/ports/clock';
import type { DiagnosisStore, StoredDiagnosis } from '@/ports/stores/diagnosis-store';
import type { MeasurementStore } from '@/ports/stores/measurement-store';

import { flagsFromMeasurement } from './diagnose-measurement';

/**
 * Recálculo de un diagnóstico.
 *
 * Reutiliza el contexto congelado del diagnóstico anterior (no el del lote actual) y crea una
 * fila nueva: los diagnósticos son inmutables y nunca se sobrescriben.
 */

export interface RecomputeDiagnosisInput {
  readonly measurementId: string;
}

export interface RecomputeDiagnosisDeps {
  readonly diagnoses: DiagnosisStore;
  readonly measurements: MeasurementStore;
  readonly thresholds: ThresholdSet;
  readonly clock: Clock;
  readonly newId: () => string;
  readonly firmwareVersion?: string | null;
}

export async function recomputeDiagnosis(
  input: RecomputeDiagnosisInput,
  deps: RecomputeDiagnosisDeps,
): Promise<DiagnosisResult | null> {
  const measurement = await deps.measurements.get(input.measurementId);

  if (measurement === null) {
    return null;
  }

  const previous = await deps.diagnoses.listByMeasurement(input.measurementId);
  const last = previous[previous.length - 1];

  if (last === undefined) {
    return null;
  }

  const context = last.contextSnapshot as unknown as DiagnosisContext;

  const result = diagnose(
    {
      measuredAtUtc: measurement.capturedAtUtc,
      payload: measurement.payload,
      flags: flagsFromMeasurement(measurement),
      context,
      calibrationVersion: last.calibrationVersion,
      firmwareVersion: deps.firmwareVersion ?? last.firmwareVersion,
    },
    deps.thresholds,
  );

  const stored: StoredDiagnosis = {
    id: deps.newId(),
    measurementId: measurement.id,
    engineVersion: result.versions.engine,
    thresholdsVersion: result.versions.thresholds,
    calibrationVersion: result.versions.calibration,
    firmwareVersion: result.versions.firmware,
    contextSnapshot: { ...context },
    result,
    explanation: result.explanation,
    createdAt: deps.clock.now(),
  };

  await deps.diagnoses.insert(stored);

  return result;
}
