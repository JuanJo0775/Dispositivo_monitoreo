import { describePlotSpace } from '@/application/map/describe-plot-space';
import type { StoredDiagnosis } from '@/ports/stores/diagnosis-store';

import { makePlot } from '../../helpers/farm-fixtures';
import { classes, makeAlert, makeDiagnosis, makeVariable } from '../../helpers/diagnoses';
import { makeInMemoryDiagnosisStore } from '../../helpers/in-memory-diagnosis-stores';
import { makeInMemoryFarmStore } from '../../helpers/in-memory-farm-store';
import { makeInMemoryStores } from '../../helpers/in-memory-stores';
import { makeMeasurement } from '../../helpers/measurements';

/** Latitud del Quindío, la misma de los ayudantes de captura. */
const LAT = 4.5339;
const LON = -75.6811;

/** 200 m hacia el este a esta latitud: la malla queda de tres celdas en fila. */
const DOSCIENTOS_METROS = 0.001802;

const OESTE = { latitude: LAT, longitude: LON };
const ESTE = { latitude: LAT, longitude: LON + DOSCIENTOS_METROS };

function makeDeps() {
  const stores = makeInMemoryStores();
  const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'plot-1' })] });
  const diagnoses = makeInMemoryDiagnosisStore();

  return {
    stores,
    farms,
    diagnoses,
    deps: {
      farms: farms.farms,
      measurements: stores.measurements,
      diagnoses: diagnoses.diagnoses,
    },
  };
}

/** Guarda un diagnóstico para una medición, como lo haría la app. */
async function seedDiagnosis(
  diagnoses: ReturnType<typeof makeInMemoryDiagnosisStore>,
  measurementId: string,
  result: ReturnType<typeof makeDiagnosis>,
  createdAt = '2026-11-12T18:00:00Z',
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
    createdAt,
  };

  await diagnoses.diagnoses.insert(stored);
}

describe('describePlotSpace', () => {
  it('cuenta celdas con dato, sin dato y puntos con y sin posición', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(makeMeasurement(OESTE, { id: 'm-oeste' }));
    await stores.measurements.insert(makeMeasurement(ESTE, { id: 'm-este' }));
    await stores.measurements.insert(
      makeMeasurement(OESTE, { id: 'm-mala', valid: false, invalidReasons: ['probe_fault'] }),
    );
    await stores.measurements.insert(
      makeMeasurement(
        { latitude: null, longitude: null },
        { id: 'm-sin-posicion', positionValid: false },
      ),
    );
    await seedDiagnosis(diagnoses, 'm-oeste', makeDiagnosis({ classes: classes('S1') }));
    await seedDiagnosis(diagnoses, 'm-este', makeDiagnosis({ classes: classes('S2') }));

    const espacio = await describePlotSpace('plot-1', deps);

    expect(espacio.grid).not.toBeNull();
    expect(espacio.counts).toEqual({
      cells: 3,
      cellsWithData: 2,
      cellsWithoutData: 1,
      cellsInconclusive: 0,
      points: 4,
      withPosition: 3,
      withoutPosition: 1,
      outsideArea: 0,
      invalid: 1,
      withoutDiagnosis: 1,
    });
    expect(espacio.points.find((punto) => punto.measurement.id === 'm-sin-posicion')?.cellId).toBe(
      null,
    );
  });

  it('incluye las celdas vacías con estado sin_dato', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(makeMeasurement(OESTE, { id: 'm-oeste' }));
    await stores.measurements.insert(makeMeasurement(ESTE, { id: 'm-este' }));
    await seedDiagnosis(diagnoses, 'm-oeste', makeDiagnosis());
    await seedDiagnosis(diagnoses, 'm-este', makeDiagnosis());

    const espacio = await describePlotSpace('plot-1', deps);

    expect(espacio.cells).toHaveLength(3);
    expect(espacio.cells.filter((celda) => celda.verdict.state === 'sin_dato')).toHaveLength(1);

    for (const celda of espacio.cells) {
      expect(espacio.grid?.cells.map((base) => base.id)).toContain(celda.cell.id);
    }
  });

  it('marca no concluyente la celda con dos conjuntos de clases distintos', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(makeMeasurement(OESTE, { id: 'm-1' }));
    await stores.measurements.insert(makeMeasurement(OESTE, { id: 'm-2' }));
    await seedDiagnosis(diagnoses, 'm-1', makeDiagnosis({ classes: classes('S1') }));
    await seedDiagnosis(diagnoses, 'm-2', makeDiagnosis({ classes: classes('S3') }));

    const espacio = await describePlotSpace('plot-1', deps);

    expect(espacio.cells).toHaveLength(1);
    expect(espacio.cells[0]?.verdict.state).toBe('no_concluyente');
    expect(espacio.cells[0]?.verdict.reason).toBe('clases_distintas');
    expect(espacio.cells[0]?.verdict.classes).toEqual([]);
    expect(espacio.cells[0]?.verdict.groups).toHaveLength(2);
    expect(espacio.cells[0]?.measurementIds).toEqual(['m-1', 'm-2']);
    expect(espacio.counts.cellsInconclusive).toBe(1);
  });

  it('resume con mediana y mínimo–máximo cuando los puntos coinciden en clases', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(makeMeasurement(OESTE, { id: 'm-1' }));
    await stores.measurements.insert(makeMeasurement(OESTE, { id: 'm-2' }));
    await seedDiagnosis(
      diagnoses,
      'm-1',
      makeDiagnosis({ classes: classes('S1'), perVariable: [makeVariable('humidity', 30, '%')] }),
    );
    await seedDiagnosis(
      diagnoses,
      'm-2',
      makeDiagnosis({ classes: classes('S1'), perVariable: [makeVariable('humidity', 50, '%')] }),
    );

    const espacio = await describePlotSpace('plot-1', deps);
    const celda = espacio.cells[0];

    expect(celda?.verdict.state).toBe('resumen');
    expect(celda?.verdict.classes).toEqual(['S1']);
    expect(celda?.verdict.groups).toEqual([{ classes: ['S1'], count: 2 }]);
    expect(celda?.summary).toEqual([
      { variable: 'humidity', unit: '%', median: 40, min: 30, max: 50, points: 2 },
    ]);
  });

  it('lista los puntos del más reciente al más antiguo', async () => {
    const { stores, deps } = makeDeps();

    await stores.measurements.insert(
      makeMeasurement(OESTE, { id: 'm-vieja', capturedAtUtc: '2026-11-12T10:00:00Z' }),
    );
    await stores.measurements.insert(
      makeMeasurement(OESTE, { id: 'm-nueva', capturedAtUtc: '2026-11-12T12:00:00Z' }),
    );
    await stores.measurements.insert(
      makeMeasurement(OESTE, { id: 'm-media', capturedAtUtc: '2026-11-12T11:00:00Z' }),
    );

    const espacio = await describePlotSpace('plot-1', deps);

    expect(espacio.points.map((punto) => punto.measurement.id)).toEqual([
      'm-nueva',
      'm-media',
      'm-vieja',
    ]);
  });

  it('agrupa las alertas del motor por código y gravedad, con blocking primero', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(
      makeMeasurement(OESTE, { id: 'm-1', capturedAtUtc: '2026-11-12T10:00:00Z' }),
    );
    await stores.measurements.insert(
      makeMeasurement(OESTE, { id: 'm-2', capturedAtUtc: '2026-11-12T12:00:00Z' }),
    );
    await stores.measurements.insert(
      makeMeasurement(OESTE, { id: 'm-3', capturedAtUtc: '2026-11-12T11:00:00Z' }),
    );
    await seedDiagnosis(
      diagnoses,
      'm-1',
      makeDiagnosis({ alerts: [makeAlert('ph_bajo', 'warning', 'pH por debajo del rango.')] }),
    );
    await seedDiagnosis(
      diagnoses,
      'm-2',
      makeDiagnosis({
        alerts: [
          makeAlert('ph_bajo', 'warning', 'pH por debajo del rango.'),
          makeAlert('materia_organica_baja', 'blocking', 'Materia orgánica muy baja.'),
        ],
      }),
    );
    await seedDiagnosis(
      diagnoses,
      'm-3',
      makeDiagnosis({ alerts: [makeAlert('ph_bajo', 'info', 'pH en el límite.')] }),
    );

    const espacio = await describePlotSpace('plot-1', deps);

    expect(espacio.alerts).toEqual([
      {
        code: 'materia_organica_baja',
        severity: 'blocking',
        message: 'Materia orgánica muy baja.',
        count: 1,
        firstMeasurementId: 'm-2',
      },
      {
        code: 'ph_bajo',
        severity: 'warning',
        message: 'pH por debajo del rango.',
        count: 2,
        firstMeasurementId: 'm-2',
      },
      {
        code: 'ph_bajo',
        severity: 'info',
        message: 'pH en el límite.',
        count: 1,
        firstMeasurementId: 'm-3',
      },
    ]);
  });

  it('separa los avisos de registro de las alertas del motor', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(
      makeMeasurement(
        { latitude: null, longitude: null },
        { id: 'm-sin-posicion', positionValid: false },
      ),
    );
    await stores.measurements.insert(
      makeMeasurement({ hdop: 8 }, { id: 'm-imprecisa', capturedAtUtc: '2026-11-12T11:00:00Z' }),
    );
    await stores.measurements.insert(
      makeMeasurement(OESTE, {
        id: 'm-invalida',
        valid: false,
        invalidReasons: ['probe_fault'],
        capturedAtUtc: '2026-11-12T10:00:00Z',
      }),
    );
    await seedDiagnosis(diagnoses, 'm-sin-posicion', makeDiagnosis());

    const espacio = await describePlotSpace('plot-1', deps);

    expect(espacio.alerts).toEqual([]);
    expect(espacio.recordAlerts.map((alerta) => alerta.code)).toEqual([
      'sin_posicion',
      'posicion_imprecisa',
      'mediciones_invalidas',
      'sin_diagnostico',
    ]);
    expect(espacio.recordAlerts.find((a) => a.code === 'sin_diagnostico')).toMatchObject({
      count: 1,
      firstMeasurementId: 'm-imprecisa',
    });
  });

  it('devuelve grid null y conteos en cero cuando el lote no tiene mediciones', async () => {
    const { deps } = makeDeps();

    const espacio = await describePlotSpace('plot-1', deps);

    expect(espacio.plot.id).toBe('plot-1');
    expect(espacio.grid).toBeNull();
    expect(espacio.points).toEqual([]);
    expect(espacio.cells).toEqual([]);
    expect(espacio.alerts).toEqual([]);
    expect(espacio.recordAlerts).toEqual([]);
    expect(espacio.counts).toEqual({
      cells: 0,
      cellsWithData: 0,
      cellsWithoutData: 0,
      cellsInconclusive: 0,
      points: 0,
      withPosition: 0,
      withoutPosition: 0,
      outsideArea: 0,
      invalid: 0,
      withoutDiagnosis: 0,
    });
  });

  it('mete la medición inválida en su celda sin que cuente para el dictamen', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(makeMeasurement(OESTE, { id: 'm-buena' }));
    await stores.measurements.insert(
      makeMeasurement(OESTE, { id: 'm-mala', valid: false, invalidReasons: ['ec_interlock'] }),
    );
    await seedDiagnosis(diagnoses, 'm-buena', makeDiagnosis({ classes: classes('S2') }));

    const espacio = await describePlotSpace('plot-1', deps);
    const celda = espacio.cells[0];

    expect(celda?.verdict.state).toBe('un_punto');
    expect(celda?.verdict.validPoints).toBe(1);
    expect(celda?.verdict.invalidPoints).toBe(1);
    expect(celda?.measurementIds).toEqual(['m-buena', 'm-mala']);
    expect(espacio.points.find((punto) => punto.measurement.id === 'm-mala')?.cellId).toBe(
      celda?.cell.id,
    );
  });
});
