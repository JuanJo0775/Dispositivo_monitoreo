import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import {
  importThresholdSet,
  listStoredThresholdSets,
} from '@/infrastructure/thresholds/import-threshold-set';

import rawSet from '../../../assets/thresholds/2026.11-v1.json';
import { makeTestSqlDatabase, type TestSqlDatabase } from '../../helpers/test-sql-database';

describe('importThresholdSet', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS threshold_sets (
        version TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        checksum TEXT NOT NULL,
        source TEXT NOT NULL,
        activated_at TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('importa el set y guarda su huella', async () => {
    const set = parseThresholdSet(rawSet);

    await expect(importThresholdSet(db, set, '2026-11-12T12:00:00Z')).resolves.toBe(true);

    const guardados = await listStoredThresholdSets(db);

    expect(guardados).toHaveLength(1);
    expect(guardados[0]?.version).toBe('2026.11-v1');
    expect(guardados[0]?.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(guardados[0]?.source).toContain('Objetivo 1 v2');
  });

  it('no importa dos veces la misma versión', async () => {
    const set = parseThresholdSet(rawSet);

    await importThresholdSet(db, set);
    await expect(importThresholdSet(db, set)).resolves.toBe(false);
    expect(await listStoredThresholdSets(db)).toHaveLength(1);
  });

  it('conserva las versiones anteriores', async () => {
    const set = parseThresholdSet(rawSet);

    await importThresholdSet(db, set, '2026-11-12T12:00:00Z');
    await importThresholdSet(db, { ...set, version: '2027.01-v1' }, '2027-01-05T12:00:00Z');

    const guardados = await listStoredThresholdSets(db);

    expect(guardados.map((row) => row.version)).toEqual(['2027.01-v1', '2026.11-v1']);
  });
});
