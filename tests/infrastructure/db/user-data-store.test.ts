import { applyMigrations } from '@/infrastructure/db/migrations';
import { createSqliteStores } from '@/infrastructure/db/sqlite-stores';

import { makeTestSqlDatabase } from '../../helpers/test-sql-database';

const HORA = '2026-11-15T10:00:00Z';

async function contar(db: ReturnType<typeof makeTestSqlDatabase>, table: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);

  return row?.n ?? 0;
}

describe('borrado de datos personales en SQLite', () => {
  it('vacía todas las tablas de la persona y conserva umbrales y aviso de privacidad', async () => {
    const db = makeTestSqlDatabase();
    await db.execAsync('PRAGMA foreign_keys = ON');
    await applyMigrations(db);

    await db.execAsync(`
      INSERT INTO farms (id, name, created_at, updated_at)
        VALUES ('farm-1', 'Finca', '${HORA}', '${HORA}');
      INSERT INTO plots (id, farm_id, name, created_at, updated_at)
        VALUES ('plot-1', 'farm-1', 'Lote', '${HORA}', '${HORA}');
      INSERT INTO sessions
        (id, plot_id, config_id, crop_primary, depth_cm, cartographic_unit, thresholds_version,
         sent_at, status)
        VALUES ('session-1', 'plot-1', 7, 'cafe', 20, 'chinchina', '2026.11-v1', '${HORA}', 'accepted');
      INSERT INTO captures
        (device_id, sequence, payload_json, flags_json, captured_at_utc, received_at_utc, origin,
         config_id, plot_id, created_at)
        VALUES ('stick-1', 1, '{}', '{}', '${HORA}', '${HORA}', 'ble', 7, 'plot-1', '${HORA}');
      INSERT INTO measurements
        (id, capture_id, plot_id, payload_json, captured_at_utc, valid, invalid_reasons_json,
         created_at)
        VALUES ('m-1', 'stick-1:1', 'plot-1', '{}', '${HORA}', 1, '[]', '${HORA}');
      INSERT INTO diagnoses
        (id, measurement_id, engine_version, thresholds_version, calibration_version,
         context_snapshot_json, classes_json, limiting_factors_json, alerts_json, evidence_json,
         uncertainty_json, explanation, created_at)
        VALUES ('d-1', 'm-1', 'engine-v1', '2026.11-v1', 'factory-v1', '{}', '["S1"]', '[]', '[]',
                '{}', '{}', 'explicación', '${HORA}');
      INSERT INTO sync_state (device_id, last_confirmed_sequence, status, updated_at)
        VALUES ('stick-1', 1, 'idle', '${HORA}');
      INSERT INTO map_packages (id, file_name, path, size_bytes, imported_at)
        VALUES ('pkg-1', 'x.pmtiles', 'file:///maps/x.pmtiles', 100, '${HORA}');
      INSERT INTO settings (key, value) VALUES ('privacy_notice_ack', '1');
      INSERT INTO settings (key, value) VALUES ('trial_mode', '1');
      INSERT INTO settings (key, value) VALUES ('next_config_id', '8');
      INSERT INTO threshold_sets (version, payload_json, checksum, source, activated_at)
        VALUES ('2026.11-v1', '{}', 'suma', 'prueba', '${HORA}');
    `);

    const stores = createSqliteStores(db);
    const erased = await stores.userData.eraseAll();

    expect(erased).toEqual({
      farms: 1,
      plots: 1,
      captures: 1,
      measurements: 1,
      diagnoses: 1,
      sessions: 1,
      syncStates: 1,
      mapPackages: 1,
    });

    for (const table of [
      'farms',
      'plots',
      'captures',
      'measurements',
      'diagnoses',
      'sessions',
      'sync_state',
      'map_packages',
    ]) {
      expect(await contar(db, table)).toBe(0);
    }

    expect(await contar(db, 'threshold_sets')).toBe(1);

    const settings = await db.getAllAsync<{ key: string }>('SELECT key FROM settings ORDER BY key');

    expect(settings.map((row) => row.key)).toEqual(['privacy_notice_ack']);
  });

  it('si una tabla falla, no borra nada', async () => {
    const db = makeTestSqlDatabase();
    await applyMigrations(db);
    await db.runAsync(
      "INSERT INTO farms (id, name, created_at, updated_at) VALUES ('farm-1', 'Finca', ?, ?)",
      [HORA, HORA],
    );

    // Una tabla que no existe hace fallar el DELETE dentro de la transacción.
    await db.execAsync('DROP TABLE map_packages');

    const stores = createSqliteStores(db);

    await expect(stores.userData.eraseAll()).rejects.toThrow();

    expect(await contar(db, 'farms')).toBe(1);
  });
});
