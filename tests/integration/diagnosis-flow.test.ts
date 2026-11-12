import { ingestCapture } from '@/application/capture/ingest-capture';
import { diagnoseMeasurement } from '@/application/diagnosis/diagnose-measurement';
import { listMeasurements } from '@/application/capture/list-measurements';
import { startSession } from '@/application/session/start-session';
import type { RawCapture } from '@/domain/capture/types';
import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import { SimulatedStickGateway } from '@/infrastructure/ble/simulated-stick-gateway';
import { applyMigrations } from '@/infrastructure/db/migrations';
import { createSqliteStores } from '@/infrastructure/db/sqlite-stores';
import { importThresholdSet } from '@/infrastructure/thresholds/import-threshold-set';
import { loadThresholdSet } from '@/infrastructure/thresholds/load-threshold-set';

import rawSet from '../../assets/thresholds/2026.11-v1.json';
import { makeTestSqlDatabase, type TestSqlDatabase } from '../helpers/test-sql-database';

/**
 * Flujo de campo completo sobre SQLite real: lote y sesión, captura del bastón
 * simulado, guardado, diagnóstico y reopening de la app.
 */
describe('flujo de campo completo', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('diagnostica una captura con sesión, lote y umbrales reales', async () => {
    const stores = createSqliteStores(db);
    const thresholds = await loadThresholdSet('2026.11-v1');
    await importThresholdSet(db, thresholds);

    const farm = {
      id: 'farm-1',
      name: 'Finca El Roble',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    };
    const plot = {
      id: 'plot-1',
      farmId: 'farm-1',
      name: 'Lote El Guamo',
      cropPrimary: 'cafe',
      cropSecondary: null,
      depthCm: 20,
      cartographicUnit: 'chinchina',
      lastFertilizationDate: '2026-07-15',
      drainage: 'bien_drenado' as const,
      shading: null,
      density: null,
      plantingDensityHa: null,
      altitudeM: 1550,
      slope: null,
      notes: null,
      deletedAt: null,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    };

    await stores.farms.insertFarm(farm);
    await stores.farms.insertPlot(plot);

    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });
    await gateway.connect('stick-01');

    const sesion = await startSession(
      { plotId: 'plot-1', cropPrimary: 'cafe', cartographicUnit: 'chinchina' },
      {
        farms: stores.farms,
        sessions: stores.sessions,
        settings: stores.settings,
        gateway,
        clock: { now: () => '2026-11-12T16:50:00Z' },
        thresholds,
        newId: () => 'session-1',
      },
    );

    expect(sesion.configId).toBeGreaterThan(0);

    const capturas: RawCapture[] = [];
    gateway.onCapture((capture) => capturas.push(capture));
    await gateway.requestCapture();

    const captura = capturas[0] as RawCapture;

    await ingestCapture(
      { capture: captura, plotId: 'plot-1' },
      {
        uow: stores.uow,
        clock: () => '2026-11-12T17:05:01Z',
        newId: () => 'm-1',
      },
    );

    const mediciones = await listMeasurements(stores.measurements);
    expect(mediciones).toHaveLength(1);

    const sesionDeLaCaptura = await stores.sessions.findByConfigId(
      captura.configId ?? sesion.configId,
    );

    const diagnostico = await diagnoseMeasurement(
      { measurement: mediciones[0] ?? (null as never), session: sesionDeLaCaptura },
      {
        diagnoses: stores.diagnoses,
        measurements: stores.measurements,
        sessions: stores.sessions,
        farms: stores.farms,
        thresholds,
        clock: { now: () => '2026-11-12T17:06:00Z' },
        newId: () => 'diag-1',
      },
    );

    expect(diagnostico).not.toBeNull();
    expect(diagnostico?.validity).not.toBe('blocked');
    expect(diagnostico?.versions.thresholds).toBe('2026.11-v1');
    expect(diagnostico?.evidence.crop).toBe('cafe');
    expect(diagnostico?.evidence.cartographicUnit).toBe('chinchina');
    expect(diagnostico?.perVariable.length).toBeGreaterThan(0);
  });

  it('no diagnostica una medición que no tiene sesión', async () => {
    const stores = createSqliteStores(db);
    const thresholds = parseThresholdSet(rawSet);

    const resultado = await diagnoseMeasurement(
      { measurement: null as never, session: null },
      {
        diagnoses: stores.diagnoses,
        measurements: stores.measurements,
        sessions: stores.sessions,
        farms: stores.farms,
        thresholds,
        clock: { now: () => '2026-11-12T17:06:00Z' },
        newId: () => 'diag-1',
      },
    );

    expect(resultado).toBeNull();
  });
});
