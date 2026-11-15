import { describePlotSpace, type PlotSpace } from '@/application/map/describe-plot-space';
import type { DiagnosisResult } from '@/domain/diagnosis/types';
import type { StoredDiagnosis } from '@/ports/stores/diagnosis-store';

import { classes, makeDiagnosis } from './diagnoses';
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

/**
 * Espacio de un lote con dos puntos medidos y uno sin posición.
 *
 * La malla sale de las funciones reales (tres celdas en fila): el punto del
 * oeste dictamina S1, el del este S2 y la celda del medio queda sin dato.
 */
export async function makePlotSpace(): Promise<PlotSpace> {
  const stores = makeInMemoryStores();
  const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'plot-1' })] });
  const diagnoses = makeInMemoryDiagnosisStore();

  await stores.measurements.insert(
    makeMeasurement({ latitude: LAT, longitude: LON }, { id: 'm-oeste' }),
  );
  await stores.measurements.insert(
    makeMeasurement({ latitude: LAT, longitude: LON + DOSCIENTOS_METROS }, { id: 'm-este' }),
  );
  await stores.measurements.insert(
    makeMeasurement(
      { latitude: null, longitude: null },
      { id: 'm-sin-posicion', positionValid: false },
    ),
  );

  await guardarDiagnostico(diagnoses, 'm-oeste', makeDiagnosis({ classes: classes('S1') }));
  await guardarDiagnostico(diagnoses, 'm-este', makeDiagnosis({ classes: classes('S2') }));

  return describePlotSpace('plot-1', {
    farms: farms.farms,
    measurements: stores.measurements,
    diagnoses: diagnoses.diagnoses,
  });
}

/** Guarda un diagnóstico con la forma que usa la app. */
async function guardarDiagnostico(
  diagnoses: ReturnType<typeof makeInMemoryDiagnosisStore>,
  measurementId: string,
  result: DiagnosisResult,
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
