import { diagnose } from '@/domain/diagnosis/diagnose';
import type { CaptureFlags } from '@/domain/capture/types';
import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { DiagnosisContext, DiagnosisResult } from '@/domain/diagnosis/types';
import type { Measurement } from '@/domain/measurement/types';
import type { Clock } from '@/ports/clock';
import type { DiagnosisStore, StoredDiagnosis } from '@/ports/stores/diagnosis-store';
import type { FarmStore } from '@/ports/stores/farm-store';
import type { MeasurementStore } from '@/ports/stores/measurement-store';
import type { Session, SessionStore } from '@/ports/stores/session-store';

/**
 * Diagnóstico de una medición.
 *
 * El diagnóstico se calcula bajo demanda y se guarda inmutable: recalcular crea una fila nueva.
 * Una medición sin sesión no tiene contexto (ni cultivo, ni lote, ni versión de umbrales) y no se
 * diagnostica: el caso de uso devuelve `null` y no escribe nada.
 */

export interface DiagnoseMeasurementInput {
  readonly measurement: Measurement;
  /** Sesión con la que se capturó; sin ella no hay diagnóstico. */
  readonly session: Session | null;
}

export interface DiagnoseMeasurementDeps {
  readonly diagnoses: DiagnosisStore;
  readonly measurements: MeasurementStore;
  readonly sessions: SessionStore;
  readonly farms: FarmStore;
  readonly thresholds: ThresholdSet;
  readonly clock: Clock;
  readonly newId: () => string;
  readonly firmwareVersion?: string | null;
}

/** Arma el contexto del lote con la sesión y los datos del lote. */
export function buildDiagnosisContext(
  session: Session,
  plot: {
    altitudeM: number | null;
    drainage: string | null;
    plantingDensityHa: number | null;
  },
): DiagnosisContext {
  return {
    crop: session.cropPrimary,
    cartographicUnit: session.cartographicUnit,
    depthCm: session.depthCm,
    lastFertilizationDate: session.lastFertilizationDate,
    altitudeM: plot.altitudeM,
    drainage: plot.drainage,
    plantingDensityHa: plot.plantingDensityHa,
    shadingPct: null,
  };
}

/** Reconstruye las banderas del contrato a partir de los motivos de invalidez guardados. */
export function flagsFromMeasurement(measurement: Measurement): CaptureFlags {
  const reasons = measurement.invalidReasons;

  return {
    positionValid: measurement.payload.latitude !== null && measurement.payload.longitude !== null,
    recentFix: !reasons.includes('stale_fix'),
    probeOk: !reasons.includes('probe_fault'),
    ecOverThreshold: reasons.includes('ec_interlock'),
    timeValid: !reasons.includes('time_unverified'),
    simulated: reasons.includes('simulated_data'),
  };
}

export async function diagnoseMeasurement(
  input: DiagnoseMeasurementInput,
  deps: DiagnoseMeasurementDeps,
): Promise<DiagnosisResult | null> {
  const { measurement, session } = input;

  if (session === null) {
    return null;
  }

  const plot = await deps.farms.getPlot(session.plotId);

  if (plot === null) {
    return null;
  }

  const context = buildDiagnosisContext(session, plot);

  const result = diagnose(
    {
      measuredAtUtc: measurement.capturedAtUtc,
      payload: measurement.payload,
      flags: flagsFromMeasurement(measurement),
      context,
      calibrationVersion: 'factory-v1',
      firmwareVersion: deps.firmwareVersion ?? measurement.payload.firmwareVersion,
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
