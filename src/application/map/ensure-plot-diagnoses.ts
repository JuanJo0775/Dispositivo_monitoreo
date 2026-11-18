import { diagnoseMeasurement } from '@/application/diagnosis/diagnose-measurement';
import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { Clock } from '@/ports/clock';
import type { DiagnosisStore } from '@/ports/stores/diagnosis-store';
import type { FarmStore } from '@/ports/stores/farm-store';
import type { MeasurementStore } from '@/ports/stores/measurement-store';
import type { SessionStore } from '@/ports/stores/session-store';

/** Qué se pudo completar al abrir el mapa de un lote. */
export interface EnsurePlotDiagnosesResult {
  /** Mediciones del lote que ganaron diagnóstico. */
  readonly diagnosed: number;
  /** Sin sesión del bastón: no hay contexto para dictaminar. */
  readonly withoutSession: number;
  /** Invalidada por el contrato: sus valores no se dictaminan. */
  readonly invalid: number;
  /** Tenía sesión, pero el motor o el guardado fallaron. */
  readonly failed: number;
}

export interface EnsurePlotDiagnosesDeps {
  readonly measurements: MeasurementStore;
  readonly diagnoses: DiagnosisStore;
  readonly sessions: SessionStore;
  readonly farms: FarmStore;
  readonly thresholds: ThresholdSet;
  readonly clock: Clock;
  readonly newId: () => string;
}

/**
 * Completa los diagnósticos de un lote antes de dibujar su mapa.
 *
 * Lo que llegó por sincronización o importación no traía diagnóstico y el mapa
 * quedaría en blanco. Cada medición se diagnostica con **la sesión que guardó
 * por su `configId`** (el contexto que el bastón tenía al capturar), nunca con
 * la sesión de hoy del lote: usar la actual dictaminaría con umbrales ajenos.
 *
 * Lo que ya tiene diagnóstico no se recalcula (el diagnóstico es inmutable) y
 * las mediciones inválidas no se dictaminan. Si una falla, se cuenta y se sigue:
 * el mapa abre con lo que sí se pudo completar.
 */
export async function ensurePlotDiagnoses(
  plotId: string,
  deps: EnsurePlotDiagnosesDeps,
): Promise<EnsurePlotDiagnosesResult> {
  const mediciones = await deps.measurements.list({ plotId });

  let diagnosed = 0;
  let withoutSession = 0;
  let invalid = 0;
  let failed = 0;

  for (const measurement of mediciones) {
    const existentes = await deps.diagnoses.listByMeasurement(measurement.id);

    if (existentes.length > 0) {
      continue;
    }

    if (!measurement.valid) {
      invalid += 1;
      continue;
    }

    const session =
      measurement.sessionId === null ? null : await deps.sessions.get(measurement.sessionId);

    if (session === null) {
      withoutSession += 1;
      continue;
    }

    try {
      const resultado = await diagnoseMeasurement({ measurement, session }, deps);

      if (resultado === null) {
        failed += 1;
      } else {
        diagnosed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { diagnosed, withoutSession, invalid, failed };
}
