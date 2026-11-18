import { diagnoseMeasurement } from '@/application/diagnosis/diagnose-measurement';
import { ensurePlotDiagnoses } from '@/application/map/ensure-plot-diagnoses';
import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { StoredDiagnosis } from '@/ports/stores/diagnosis-store';
import type { Session } from '@/ports/stores/session-store';

import rawSet from '../../../assets/thresholds/2026.11-v1.json';
import { makePlot, makeSession } from '../../helpers/farm-fixtures';
import { makeInMemoryDiagnosisStore } from '../../helpers/in-memory-diagnosis-stores';
import { makeInMemoryFarmStore } from '../../helpers/in-memory-farm-store';
import { makeInMemorySessionStore } from '../../helpers/in-memory-session-store';
import { makeInMemoryStores } from '../../helpers/in-memory-stores';
import { makeMeasurement } from '../../helpers/measurements';

const thresholds = parseThresholdSet(rawSet);
const clock = { now: () => '2026-11-12T18:00:00Z' };

/**
 * Sesión vieja del bastón: la que la medición guardó por su `configId`.
 * El lote hoy tiene otra sesión con otro cultivo, para probar que se usa la
 * vieja y no la del lote actual.
 */
const sesionVieja: Session = makeSession({
  id: 'sesion-vieja',
  configId: 9,
  plotId: 'plot-1',
  cropPrimary: 'cafe',
});

const sesionActual: Session = makeSession({
  id: 'sesion-actual',
  configId: 12,
  plotId: 'plot-1',
  cropPrimary: 'platano',
});

function makeDeps() {
  const stores = makeInMemoryStores();
  const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'plot-1' })] });
  // La actual se inserta primero: si se usara "la sesión del lote", esta sería
  // la elegida. La vieja va segunda y es la que debe mandar.
  const sessions = makeInMemorySessionStore([sesionActual, sesionVieja]);
  const diagnoses = makeInMemoryDiagnosisStore();

  let counter = 0;

  return {
    stores,
    farms,
    sessions,
    diagnoses,
    deps: {
      measurements: stores.measurements,
      diagnoses: diagnoses.diagnoses,
      sessions: sessions.sessions,
      farms: farms.farms,
      thresholds,
      clock,
      newId: () => {
        counter += 1;
        return `diag-${counter}`;
      },
    },
  };
}

describe('ensurePlotDiagnoses', () => {
  it('diagnostica con la sesión de su configId, no con la del lote actual', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-1', sessionId: 'sesion-vieja' }));

    const resultado = await ensurePlotDiagnoses('plot-1', deps);

    expect(resultado).toEqual({ diagnosed: 1, withoutSession: 0, invalid: 0, failed: 0 });
    expect(diagnoses.diagnosisRows).toHaveLength(1);
    expect(diagnoses.diagnosisRows[0]?.measurementId).toBe('m-1');
    expect(diagnoses.diagnosisRows[0]?.contextSnapshot).toMatchObject({
      crop: 'cafe',
      cartographicUnit: 'chinchina',
    });
    expect(diagnoses.diagnosisRows[0]?.engineVersion).toBe('engine-v1');
    expect(diagnoses.diagnosisRows[0]?.thresholdsVersion).toBe('2026.11-v1');
    expect(diagnoses.diagnosisRows[0]?.calibrationVersion).toBe('factory-v1');
    expect(diagnoses.diagnosisRows[0]?.firmwareVersion).toBe('0.1.0');
  });

  it('no recalcula la medición que ya tiene diagnóstico', async () => {
    const { stores, diagnoses, deps } = makeDeps();
    const measurement = makeMeasurement({}, { id: 'm-1', sessionId: 'sesion-vieja' });

    await stores.measurements.insert(measurement);
    await diagnoseMeasurement({ measurement, session: sesionVieja }, deps);

    const antes = [...diagnoses.diagnosisRows];

    const resultado = await ensurePlotDiagnoses('plot-1', deps);

    expect(resultado.diagnosed).toBe(0);
    expect(diagnoses.diagnosisRows).toHaveLength(1);
    expect(diagnoses.diagnosisRows[0]).toBe(antes[0]);
  });

  it('deja sin diagnóstico la medición sin sesión y la cuenta', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-1', sessionId: null }));

    const resultado = await ensurePlotDiagnoses('plot-1', deps);

    expect(resultado).toEqual({ diagnosed: 0, withoutSession: 1, invalid: 0, failed: 0 });
    expect(diagnoses.diagnosisRows).toHaveLength(0);
  });

  it('no diagnostica una medición inválida', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(
      makeMeasurement({}, { id: 'm-1', sessionId: 'sesion-vieja', valid: false }),
    );

    const resultado = await ensurePlotDiagnoses('plot-1', deps);

    expect(resultado).toEqual({ diagnosed: 0, withoutSession: 0, invalid: 1, failed: 0 });
    expect(diagnoses.diagnosisRows).toHaveLength(0);
  });

  it('es idempotente: la segunda vuelta no escribe ni cuenta', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-1', sessionId: 'sesion-vieja' }));

    const primera = await ensurePlotDiagnoses('plot-1', deps);
    const segunda = await ensurePlotDiagnoses('plot-1', deps);

    expect(primera.diagnosed).toBe(1);
    expect(segunda).toEqual({ diagnosed: 0, withoutSession: 0, invalid: 0, failed: 0 });
    expect(diagnoses.diagnosisRows).toHaveLength(1);
  });

  it('cuenta el fallo puntual y sigue con las demás mediciones', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(
      makeMeasurement({}, { id: 'm-falla', sessionId: 'sesion-vieja' }),
    );
    await stores.measurements.insert(
      makeMeasurement({}, { id: 'm-buena', sessionId: 'sesion-vieja' }),
    );

    const diagnosesQueFalla = {
      ...diagnoses.diagnoses,
      async insert(diagnosis: StoredDiagnosis) {
        if (diagnosis.measurementId === 'm-falla') {
          throw new Error('fallo simulado al guardar el diagnóstico');
        }

        await diagnoses.diagnoses.insert(diagnosis);
      },
    };

    const resultado = await ensurePlotDiagnoses('plot-1', {
      ...deps,
      diagnoses: diagnosesQueFalla,
    });

    expect(resultado).toEqual({ diagnosed: 1, withoutSession: 0, invalid: 0, failed: 1 });
    expect(diagnoses.diagnosisRows.map((fila) => fila.measurementId)).toEqual(['m-buena']);
  });

  it('solo toca las mediciones del lote pedido', async () => {
    const { stores, diagnoses, deps } = makeDeps();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-1', sessionId: 'sesion-vieja' }));
    await stores.measurements.insert(
      makeMeasurement({}, { id: 'm-otro', plotId: 'plot-2', sessionId: 'sesion-vieja' }),
    );

    const resultado = await ensurePlotDiagnoses('plot-1', deps);

    expect(resultado.diagnosed).toBe(1);
    expect(diagnoses.diagnosisRows.map((fila) => fila.measurementId)).toEqual(['m-1']);
  });
});
