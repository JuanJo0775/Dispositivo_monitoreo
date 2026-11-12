import { applyMigrations, MIGRATIONS } from '@/infrastructure/db/migrations';
import { createSqliteStores } from '@/infrastructure/db/sqlite-stores';

import { makeCapture } from '../../helpers/captures';
import { makeMeasurement } from '../../helpers/measurements';
import { makeTestSqlDatabase, type TestSqlDatabase } from '../../helpers/test-sql-database';

describe('almacenes SQLite', () => {
  let db: TestSqlDatabase;

  async function seedPlots(): Promise<void> {
    await db.runAsync('INSERT INTO farms (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [
      'farm-1',
      'Finca El Roble',
      '2026-11-01T00:00:00Z',
      '2026-11-01T00:00:00Z',
    ]);

    for (const plotId of ['plot-1', 'plot-2']) {
      await db.runAsync(
        'INSERT INTO plots (id, farm_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [plotId, 'farm-1', `Lote ${plotId}`, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z'],
      );
    }
  }

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);
    await seedPlots();
  });

  afterEach(() => {
    db.close();
  });

  it('crea el esquema y no reaplica migraciones', async () => {
    await expect(applyMigrations(db)).resolves.toBe(0);

    const row = await db.getFirstAsync<{ version: number }>(
      'SELECT MAX(version) AS version FROM schema_migrations',
    );
    expect(row?.version).toBe(MIGRATIONS.length);
  });

  it('guarda y recupera una captura con su payload y banderas intactos', async () => {
    const stores = createSqliteStores(db);
    const capture = makeCapture({ humidityPct: 41, ph: null }, { simulated: true });

    await stores.captures.insertRaw(capture);
    const stored = await stores.captures.findByDeviceSequence('stick-01', 1);

    expect(stored).toEqual(capture);
  });

  it('rechaza una captura duplicada por device_id y sequence', async () => {
    const stores = createSqliteStores(db);

    await stores.captures.insertRaw(makeCapture());
    await expect(stores.captures.insertRaw(makeCapture())).rejects.toThrow();
  });

  it('guarda una medición con nulos, la lista y la recupera', async () => {
    const stores = createSqliteStores(db);
    const measurement = makeMeasurement({ humidityPct: null }, { notes: null, photoPath: null });

    await stores.measurements.insert(measurement);

    expect(await stores.measurements.get(measurement.id)).toEqual(measurement);
    expect(await stores.measurements.list()).toEqual([measurement]);
  });

  it('excluye descartadas y filtra por lote al listar', async () => {
    const stores = createSqliteStores(db);

    await stores.measurements.insert(
      makeMeasurement({}, { id: 'm-1', captureId: 'stick-01:1', plotId: 'plot-1' }),
    );
    await stores.measurements.insert(
      makeMeasurement({}, { id: 'm-2', captureId: 'stick-01:2', plotId: 'plot-2' }),
    );
    await stores.measurements.insert(
      makeMeasurement(
        {},
        {
          id: 'm-3',
          captureId: 'stick-01:3',
          plotId: 'plot-1',
          discardedAt: '2026-11-12T18:00:00Z',
        },
      ),
    );

    const plotOne = await stores.measurements.list({ plotId: 'plot-1' });
    const withDiscarded = await stores.measurements.list({ includeDiscarded: true });

    expect(plotOne.map((row) => row.id)).toEqual(['m-1']);
    expect(withDiscarded).toHaveLength(3);
  });

  it('hace rollback completo cuando falla la transacción', async () => {
    const stores = createSqliteStores(db);

    await expect(
      stores.uow.run(async (tx) => {
        await tx.captures.insertRaw(makeCapture());
        await tx.measurements.insert(makeMeasurement());
        throw new Error('fallo simulado');
      }),
    ).rejects.toThrow('fallo simulado');

    expect(await stores.captures.findByDeviceSequence('stick-01', 1)).toBeNull();
    expect(await stores.measurements.list()).toEqual([]);
  });

  it('devuelve el resultado de la transacción cuando todo sale bien', async () => {
    const stores = createSqliteStores(db);

    const result = await stores.uow.run(async (tx) => {
      await tx.captures.insertRaw(makeCapture());
      return 'ok';
    });

    expect(result).toBe('ok');
  });
});
