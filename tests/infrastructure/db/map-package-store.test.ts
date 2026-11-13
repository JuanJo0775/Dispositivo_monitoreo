import { applyMigrations } from '@/infrastructure/db/migrations';
import { createSqliteStores } from '@/infrastructure/db/sqlite-stores';
import type { MapPackage } from '@/ports/stores/map-package-store';

import { makeTestSqlDatabase, type TestSqlDatabase } from '../../helpers/test-sql-database';

function makeMapPackage(overrides: Partial<MapPackage> = {}): MapPackage {
  return {
    id: 'pkg-1',
    fileName: 'valle-del-cauca.pmtiles',
    path: '/data/user/0/com.corte10.app/files/maps/valle-del-cauca.pmtiles',
    sizeBytes: 24 * 1024 * 1024,
    importedAt: '2026-11-13T08:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('almacén SQLite de paquetes de mapa', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('guarda un paquete y lo lee por su id', async () => {
    const stores = createSqliteStores(db);
    const paquete = makeMapPackage();

    await stores.mapPackages.insert(paquete);

    expect(await stores.mapPackages.get(paquete.id)).toEqual(paquete);
  });

  it('lista solo los vigentes y listAll trae también los borrados', async () => {
    const stores = createSqliteStores(db);

    await stores.mapPackages.insert(
      makeMapPackage({ id: 'pkg-1', importedAt: '2026-11-13T08:00:00Z' }),
    );
    await stores.mapPackages.insert(
      makeMapPackage({
        id: 'pkg-2',
        fileName: 'cafe.pmtiles',
        importedAt: '2026-11-13T09:00:00Z',
        deletedAt: '2026-11-13T10:00:00Z',
      }),
    );
    await stores.mapPackages.insert(
      makeMapPackage({
        id: 'pkg-3',
        fileName: 'finca.pmtiles',
        importedAt: '2026-11-13T11:00:00Z',
      }),
    );

    const vigentes = await stores.mapPackages.list();
    const todos = await stores.mapPackages.listAll();

    expect(vigentes.map((paquete) => paquete.id)).toEqual(['pkg-3', 'pkg-1']);
    expect(todos.map((paquete) => paquete.id)).toEqual(['pkg-3', 'pkg-2', 'pkg-1']);
  });

  it('marca el paquete como borrado sin quitar la fila', async () => {
    const stores = createSqliteStores(db);

    await stores.mapPackages.insert(makeMapPackage());
    await stores.mapPackages.markDeleted('pkg-1', '2026-11-13T09:00:00Z');

    const row = await db.getFirstAsync<{ deleted_at: string | null }>(
      'SELECT deleted_at FROM map_packages WHERE id = ?',
      ['pkg-1'],
    );

    expect(row?.deleted_at).toBe('2026-11-13T09:00:00Z');
    expect(await stores.mapPackages.list()).toEqual([]);
    expect((await stores.mapPackages.listAll())[0]?.deletedAt).toBe('2026-11-13T09:00:00Z');
  });

  it('borra la fila del paquete', async () => {
    const stores = createSqliteStores(db);

    await stores.mapPackages.insert(makeMapPackage());
    await stores.mapPackages.remove('pkg-1');

    expect(await stores.mapPackages.get('pkg-1')).toBeNull();
    expect(await stores.mapPackages.listAll()).toEqual([]);
  });
});
