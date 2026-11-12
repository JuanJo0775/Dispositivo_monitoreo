import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { SqlDatabase } from '@/infrastructure/db/sql-database';

import { contentChecksum } from './load-threshold-set';

/**
 * Importación de un set de umbrales a la base local.
 *
 * Un set nunca se edita en sitio: importarlo crea su versión y conserva las anteriores, para poder
 * recalcular y auditar. Si la versión ya está, no se vuelve a escribir.
 */
export async function importThresholdSet(
  db: SqlDatabase,
  set: ThresholdSet,
  activatedAt: string = new Date().toISOString(),
): Promise<boolean> {
  const existing = await db.getFirstAsync<{ version: string }>(
    'SELECT version FROM threshold_sets WHERE version = ?',
    [set.version],
  );

  if (existing !== null) {
    return false;
  }

  await db.runAsync(
    'INSERT INTO threshold_sets (version, payload_json, checksum, source, activated_at) VALUES (?, ?, ?, ?, ?)',
    [set.version, JSON.stringify(set), contentChecksum(set), set.source, activatedAt],
  );

  return true;
}

/** Versiones de umbrales guardadas en la base, de la más reciente a la más antigua. */
export async function listStoredThresholdSets(
  db: SqlDatabase,
): Promise<{ version: string; checksum: string; source: string; activatedAt: string }[]> {
  const rows = await db.getAllAsync<{
    version: string;
    checksum: string;
    source: string;
    activated_at: string;
  }>(
    'SELECT version, checksum, source, activated_at FROM threshold_sets ORDER BY activated_at DESC',
  );

  return rows.map((row) => ({
    version: row.version,
    checksum: row.checksum,
    source: row.source,
    activatedAt: row.activated_at,
  }));
}
