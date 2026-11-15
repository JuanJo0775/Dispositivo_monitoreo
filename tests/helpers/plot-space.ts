import { describePlotSpace, type PlotSpace } from '@/application/map/describe-plot-space';
import type { CapturePayload } from '@/domain/capture/types';
import type { AptitudeClass, DiagnosisAlert, VariableResult } from '@/domain/diagnosis/types';
import type { Plot } from '@/domain/farm/types';
import type { StoredDiagnosis } from '@/ports/stores/diagnosis-store';

import { makeDiagnosis } from './diagnoses';
import { makePlot } from './farm-fixtures';
import { makeInMemoryDiagnosisStore } from './in-memory-diagnosis-stores';
import { makeInMemoryFarmStore } from './in-memory-farm-store';
import { makeInMemoryStores } from './in-memory-stores';
import { makeMeasurement } from './measurements';

/** Latitud del Quindío, la misma de los ayudantes de captura. */
const LAT = 4.5339;
const LON = -75.6811;

/** 200 m hacia el este a esta latitud: la malla queda de tres celdas en fila. */
const DOSCIENTOS_METROS = 0.001802;

/** Punto de un espacio de prueba: posición, validez y dictamen guardado. */
export interface PlotSpacePointSeed {
  readonly id: string;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly positionValid?: boolean;
  readonly hdop?: number | null;
  readonly valid?: boolean;
  readonly capturedAtUtc?: string;
  /** Clases del diagnóstico guardado; sin esto el punto queda sin diagnóstico. */
  readonly diagnosisClasses?: readonly AptitudeClass[] | null;
  /** Variables del diagnóstico guardado, para probar el resumen de la celda. */
  readonly variables?: readonly VariableResult[];
  /** Alertas del motor que trae el diagnóstico guardado. */
  readonly alerts?: readonly DiagnosisAlert[];
  /** Validez del diagnóstico guardado. */
  readonly diagnosisValidity?: 'valid' | 'blocked' | 'insufficient_data';
}

/**
 * Espacio de un lote armado con los puntos indicados.
 *
 * Usa los almacenes en memoria y las funciones reales de la aplicación: la
 * malla, los dictámenes y el resumen salen de `describePlotSpace`, no de un
 * modelo escrito a mano.
 */
export async function makePlotSpaceWith(
  seeds: readonly PlotSpacePointSeed[],
  plot: Plot = makePlot({ id: 'plot-1' }),
): Promise<PlotSpace> {
  const stores = makeInMemoryStores();
  const farms = makeInMemoryFarmStore({ plots: [plot] });
  const diagnoses = makeInMemoryDiagnosisStore();

  for (const seed of seeds) {
    const payload: Partial<CapturePayload> = {
      latitude: seed.latitude === undefined ? LAT : seed.latitude,
      longitude: seed.longitude === undefined ? LON : seed.longitude,
      ...(seed.hdop === undefined ? {} : { hdop: seed.hdop }),
    };

    await stores.measurements.insert(
      makeMeasurement(payload, {
        id: seed.id,
        positionValid: seed.positionValid ?? true,
        valid: seed.valid ?? true,
        ...(seed.capturedAtUtc === undefined ? {} : { capturedAtUtc: seed.capturedAtUtc }),
      }),
    );

    if (seed.diagnosisClasses !== undefined && seed.diagnosisClasses !== null) {
      await guardarDiagnostico(
        diagnoses,
        seed.id,
        makeDiagnosis({
          classes: seed.diagnosisClasses,
          validity: seed.diagnosisValidity ?? 'valid',
          perVariable: seed.variables ?? [],
          alerts: seed.alerts ?? [],
        }),
      );
    }
  }

  return describePlotSpace(plot.id, {
    farms: farms.farms,
    measurements: stores.measurements,
    diagnoses: diagnoses.diagnoses,
  });
}

/**
 * Espacio de un lote con dos puntos medidos y uno sin posición.
 *
 * La malla sale de las funciones reales (tres celdas en fila): el punto del
 * oeste dictamina S1, el del este S2 y la celda del medio queda sin dato.
 */
export function makePlotSpace(): Promise<PlotSpace> {
  return makePlotSpaceWith([
    { id: 'm-oeste', diagnosisClasses: ['S1'] },
    {
      id: 'm-este',
      longitude: LON + DOSCIENTOS_METROS,
      diagnosisClasses: ['S2'],
    },
    { id: 'm-sin-posicion', latitude: null, longitude: null, positionValid: false },
  ]);
}

/** Guarda un diagnóstico con la forma que usa la app. */
async function guardarDiagnostico(
  diagnoses: ReturnType<typeof makeInMemoryDiagnosisStore>,
  measurementId: string,
  result: ReturnType<typeof makeDiagnosis>,
): Promise<void> {
  const stored: StoredDiagnosis = {
    id: `diag-${measurementId}`,
    measurementId,
    engineVersion: result.versions.engine,
    thresholdsVersion: result.versions.thresholds,
    calibrationVersion: result.versions.calibration,
    firmwareVersion: result.versions.firmware,
    contextSnapshot: { crop: 'cafe' },
    result,
    explanation: result.explanation,
    createdAt: '2026-11-12T18:00:00Z',
  };

  await diagnoses.diagnoses.insert(stored);
}
