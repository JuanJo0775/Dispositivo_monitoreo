import { diagnoseMeasurement } from '@/application/diagnosis/diagnose-measurement';
import { recomputeDiagnosis } from '@/application/diagnosis/recompute-diagnosis';
import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { Plot } from '@/domain/farm/types';
import type { Session } from '@/ports/stores/session-store';

import rawSet from '../../../assets/thresholds/2026.11-v1.json';
import { makeInMemoryFarmStore } from '../../helpers/in-memory-farm-store';
import { makeInMemoryDiagnosisStore } from '../../helpers/in-memory-diagnosis-stores';
import { makeMeasurement } from '../../helpers/measurements';

const thresholds = parseThresholdSet(rawSet);

const lote: Plot = {
  id: 'plot-1',
  farmId: 'farm-1',
  name: 'Lote El Guamo',
  cropPrimary: 'cafe',
  cropSecondary: null,
  depthCm: 20,
  cartographicUnit: 'chinchina',
  lastFertilizationDate: '2026-07-15',
  drainage: 'bien_drenado',
  shading: null,
  density: null,
  plantingDensityHa: null,
  altitudeM: 1550,
  slope: null,
  notes: null,
  deletedAt: null,
  createdAt: '2026-01-06T08:00:00Z',
  updatedAt: '2026-01-06T08:00:00Z',
};

const sesion: Session = {
  id: 'session-1',
  plotId: 'plot-1',
  configId: 1,
  cropPrimary: 'cafe',
  cropSecondary: null,
  depthCm: 20,
  cartographicUnit: 'chinchina',
  lastFertilizationDate: '2026-07-15',
  thresholdsVersion: '2026.11-v1',
  firmwareVersion: '0.1.0',
  sentAt: '2026-11-12T16:50:00Z',
  acceptedAt: null,
  status: 'sent',
};

function makeDeps() {
  const farms = makeInMemoryFarmStore({ farms: [], plots: [lote] });
  const { diagnoses, diagnosisRows } = makeInMemoryDiagnosisStore();
  let contador = 0;

  return {
    farms,
    diagnosisRows,
    deps: {
      diagnoses,
      measurements: {
        async insert() {},
        async list() {
          return [];
        },
        async get(id: string) {
          return id === 'm-1' ? makeMeasurement() : null;
        },
      },
      sessions: {
        async insert() {},
        async get() {
          return null;
        },
        async findByConfigId() {
          return null;
        },
        async listByPlot() {
          return [];
        },
      },
      farms: farms.farms,
      thresholds,
      clock: { now: () => '2026-11-12T17:06:00Z' },
      newId: () => `diag-${++contador}`,
    },
  };
}

describe('recomputeDiagnosis', () => {
  it('reutiliza el contexto congelado del diagnóstico anterior', async () => {
    const { deps, farms, diagnosisRows } = makeDeps();
    const measurement = makeMeasurement({}, { id: 'm-1', plotId: 'plot-1' });

    await diagnoseMeasurement({ measurement, session: sesion }, deps);

    // El lote cambia después del primer diagnóstico: el recálculo no debe seguirlo.
    Object.assign(farms.plotRows[0] as Plot, { altitudeM: 2500 });

    const resultado = await recomputeDiagnosis({ measurementId: 'm-1' }, deps);

    expect(resultado).not.toBeNull();
    expect(resultado?.validity).toBe('valid');
    expect(diagnosisRows).toHaveLength(2);
  });

  it('crea una fila nueva y no toca la anterior', async () => {
    const { deps, diagnosisRows } = makeDeps();
    const measurement = makeMeasurement({}, { id: 'm-1', plotId: 'plot-1' });

    await diagnoseMeasurement({ measurement, session: sesion }, deps);
    const primera = diagnosisRows[0];

    await recomputeDiagnosis({ measurementId: 'm-1' }, deps);

    expect(diagnosisRows).toHaveLength(2);
    expect(diagnosisRows[0]?.id).toBe(primera?.id);
    expect(diagnosisRows[1]?.id).not.toBe(primera?.id);
    expect(diagnosisRows[1]?.createdAt).toBe('2026-11-12T17:06:00Z');
  });

  it('no recalcula una medición que no tiene diagnóstico', async () => {
    const { deps, diagnosisRows } = makeDeps();

    const resultado = await recomputeDiagnosis({ measurementId: 'm-1' }, deps);

    expect(resultado).toBeNull();
    expect(diagnosisRows).toHaveLength(0);
  });

  it('no recalcula una medición que no existe', async () => {
    const { deps } = makeDeps();

    await expect(recomputeDiagnosis({ measurementId: 'm-inexistente' }, deps)).resolves.toBeNull();
  });
});
