import type { SqlDatabase } from './sql-database';

/** Una migración de esquema, aplicada en orden y nunca editada después de publicarse. */
export interface Migration {
  readonly version: number;
  readonly sql: string;
}

/**
 * Migraciones de la base local.
 *
 * Reglas:
 * - Una migración publicada no se modifica; se agrega otra.
 * - El esquema guarda crudos y derivados en tablas separadas.
 * - `captures` es inmutable: solo se inserta y se lee.
 * - Los datos de un lote se pueden borrar lógicamente (`deleted_at`), nunca en cascada.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS farms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plots (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL REFERENCES farms(id),
        name TEXT NOT NULL,
        area_ha REAL,
        crop_primary TEXT,
        crop_secondary TEXT,
        depth_cm INTEGER,
        last_fertilization_date TEXT,
        drainage TEXT,
        shading TEXT,
        density TEXT,
        altitude_m REAL,
        slope REAL,
        notes TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS captures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        flags_json TEXT NOT NULL,
        captured_at_utc TEXT NOT NULL,
        received_at_utc TEXT NOT NULL,
        origin TEXT NOT NULL,
        config_id INTEGER NOT NULL DEFAULT 0,
        plot_id TEXT REFERENCES plots(id),
        created_at TEXT NOT NULL,
        UNIQUE (device_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS measurements (
        id TEXT PRIMARY KEY,
        capture_id TEXT NOT NULL UNIQUE,
        plot_id TEXT REFERENCES plots(id),
        payload_json TEXT NOT NULL,
        captured_at_utc TEXT NOT NULL,
        valid INTEGER NOT NULL,
        invalid_reasons_json TEXT NOT NULL,
        notes TEXT,
        photo_path TEXT,
        discarded_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_captures_device_sequence
        ON captures (device_id, sequence);

      CREATE INDEX IF NOT EXISTS idx_measurements_date
        ON measurements (captured_at_utc DESC);

      CREATE INDEX IF NOT EXISTS idx_measurements_plot_date
        ON measurements (plot_id, captured_at_utc DESC);

      CREATE INDEX IF NOT EXISTS idx_plots_farm
        ON plots (farm_id);
    `,
  },
];

/** Migraciones que faltan aplicar, dada la última versión registrada. */
export function pendingMigrations(currentVersion: number): Migration[] {
  return MIGRATIONS.filter((migration) => migration.version > currentVersion);
}

/**
 * Aplica las migraciones que falten y devuelve cuántas aplicó.
 *
 * Cada migración corre en su propia transacción: si una falla, la base queda
 * en la última versión consistente y se informa, sin dejar el esquema a medias.
 */
export async function applyMigrations(db: SqlDatabase): Promise<number> {
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);',
  );

  const row = await db.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  const currentVersion = row?.version ?? 0;
  const pending = pendingMigrations(currentVersion);

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
        migration.version,
        new Date().toISOString(),
      ]);
    });
  }

  return pending.length;
}
