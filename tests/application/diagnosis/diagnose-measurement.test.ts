import { diagnoseMeasurement } from '@/application/diagnosis/diagnose-measurement';
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
  const measurements = {
    async insert() {},
    async list() {
      return [];
    },
    async get() {
      return null;
    },
  };

  return {
    farms,
    diagnoses,
    diagnosisRows,
    deps: {
      diagnoses,
      measurements,
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
      newId: () => 'diag-1',
    },
  };
}

describe('diagnoseMeasurement', () => {
  it('diagnostica una medición con sesión y guarda el diagnóstico', async () => {
    const { deps, diagnosisRows } = makeDeps();
    const measurement = makeMeasurement(
      { humidityPct: 38, ph: 5.4, ecUsCm: 120, cropCode: 'cafe' },
      { id: 'm-1', plotId: 'plot-1' },
    );

    const result = await diagnoseMeasurement({ measurement, session: sesion }, deps);

    expect(result).not.toBeNull();
    expect(result?.versions.thresholds).toBe('2026.11-v1');
    expect(result?.versions.engine).toBe('engine-v1');
    expect(diagnosisRows).toHaveLength(1);
    expect(diagnosisRows[0]?.measurementId).toBe('m-1');
    expect(diagnosisRows[0]?.contextSnapshot).toMatchObject({
      crop: 'cafe',
      cartographicUnit: 'chinchina',
    });
  });

  it('no diagnostica una medición sin sesión', async () => {
    const { deps, diagnosisRows } = makeDeps();

    const result = await diagnoseMeasurement(
      { measurement: makeMeasurement(), session: null },
      deps,
    );

    expect(result).toBeNull();
    expect(diagnosisRows).toHaveLength(0);
  });

  it('no diagnostica cuando el lote de la sesión ya no existe', async () => {
    const { deps, diagnosisRows } = makeDeps();

    const result = await diagnoseMeasurement(
      { measurement: makeMeasurement(), session: { ...sesion, plotId: 'plot-inexistente' } },
      deps,
    );

    expect(result).toBeNull();
    expect(diagnosisRows).toHaveLength(0);
  });

  it('guarda la explicación y las cuatro versiones del diagnóstico', async () => {
    const { deps, diagnosisRows } = makeDeps();

    await diagnoseMeasurement({ measurement: makeMeasurement(), session: sesion }, deps);

    const guardado = diagnosisRows[0];
    expect(guardado?.explanation.length).toBeGreaterThan(10);
    expect(guardado?.engineVersion).toBe('engine-v1');
    expect(guardado?.thresholdsVersion).toBe('2026.11-v1');
    expect(guardado?.calibrationVersion).toBe('factory-v1');
    expect(guardado?.firmwareVersion).toBe('0.1.0');
  });
});
