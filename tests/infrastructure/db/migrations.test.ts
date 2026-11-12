import { applyMigrations, MIGRATIONS, pendingMigrations } from '@/infrastructure/db/migrations';

import { makeTestSqlDatabase, type TestSqlDatabase } from '../../helpers/test-sql-database';

const allSql = MIGRATIONS.map((migration) => migration.sql).join('\n');

const version1 = MIGRATIONS.find((migration) => migration.version === 1)?.sql ?? '';
const version2 = MIGRATIONS.find((migration) => migration.version === 2)?.sql ?? '';
const version3 = MIGRATIONS.find((migration) => migration.version === 3)?.sql ?? '';

describe('migraciones', () => {
  it('empieza en la versión 1 y es consecutiva', () => {
    expect(MIGRATIONS[0]?.version).toBe(1);
    MIGRATIONS.forEach((migration, index) => {
      expect(migration.version).toBe(index + 1);
    });
  });

  it('crea las tablas del corte 0', () => {
    for (const table of ['farms', 'plots', 'captures', 'measurements', 'schema_migrations']) {
      expect(allSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('define la identidad única de la captura como device_id + sequence', () => {
    expect(allSql).toMatch(/UNIQUE\s*\(\s*device_id\s*,\s*sequence\s*\)/i);
  });

  it('impide dos mediciones para la misma captura', () => {
    expect(allSql).toMatch(/capture_id\s+TEXT\s+NOT NULL\s+UNIQUE/i);
  });

  it('guarda los índices de consulta del historial', () => {
    expect(allSql).toContain('idx_measurements_date');
    expect(allSql).toContain('idx_measurements_plot_date');
  });

  it('calcula las migraciones pendientes según la versión aplicada', () => {
    expect(pendingMigrations(0)).toHaveLength(MIGRATIONS.length);
    expect(pendingMigrations(MIGRATIONS.length)).toHaveLength(0);
    expect(pendingMigrations(1).map((migration) => migration.version)).toEqual(
      MIGRATIONS.slice(1).map((migration) => migration.version),
    );
  });

  describe('versión 2', () => {
    it('publica las versiones en orden consecutive', () => {
      expect(MIGRATIONS.map((migration) => migration.version)).toEqual([1, 2, 3]);
    });

    it('crea las tablas de sesiones, umbrales, diagnósticos y ajustes', () => {
      for (const table of ['sessions', 'threshold_sets', 'diagnoses', 'settings']) {
        expect(version2).toContain(`CREATE TABLE ${table}`);
      }
    });

    it('agrega la unidad cartográfica al lote', () => {
      expect(version2).toMatch(/ALTER TABLE plots ADD COLUMN cartographic_unit TEXT/i);
    });

    it('agrega la sesión y las versiones a la medición', () => {
      expect(version2).toMatch(/ALTER TABLE measurements ADD COLUMN session_id TEXT/i);
      expect(version2).toMatch(/ALTER TABLE measurements ADD COLUMN thresholds_version TEXT/i);
      expect(version2).toMatch(/ALTER TABLE measurements ADD COLUMN calibration_version TEXT/i);
    });

    it('indexa los diagnósticos por medición y las sesiones por lote', () => {
      expect(version2).toContain('idx_diagnoses_measurement');
      expect(version2).toContain('idx_sessions_plot');
    });
  });

  describe('versión 1', () => {
    it('no se modifica al agregar la versión 2', () => {
      expect(version1).toContain('CREATE TABLE IF NOT EXISTS captures');
      expect(version1).toMatch(/UNIQUE\s*\(\s*device_id\s*,\s*sequence\s*\)/i);
    });

    it('no contiene nada de la versión 2', () => {
      expect(version1).not.toContain('cartographic_unit');
      expect(version1).not.toContain('CREATE TABLE sessions');
      expect(version1).not.toContain('CREATE TABLE diagnoses');
      expect(version1).not.toContain('CREATE TABLE settings');
    });
  });

  describe('versión 3', () => {
    it('agrega el detalle por variable al diagnóstico', () => {
      expect(version3).toMatch(
        /ALTER TABLE diagnoses ADD COLUMN variables_json TEXT NOT NULL DEFAULT '\[\]'/i,
      );
    });

    it('hace único el config_id de la sesión', () => {
      expect(version3).toMatch(
        /CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_config_id ON sessions \(config_id\)/i,
      );
    });

    it('no modifica las versiones ya publicadas', () => {
      expect(version2).not.toContain('variables_json');
      expect(version2).not.toContain('idx_sessions_config_id');
      expect(version1).not.toContain('variables_json');
      expect(version1).not.toContain('idx_sessions_config_id');
    });
  });

  describe('aplicación sobre SQLite real', () => {
    let db: TestSqlDatabase;

    beforeEach(async () => {
      db = makeTestSqlDatabase();
      await applyMigrations(db);
    });

    afterEach(() => {
      db.close();
    });

    it('deja el esquema en la última versión y no reaplica nada', async () => {
      await expect(applyMigrations(db)).resolves.toBe(0);

      const row = await db.getFirstAsync<{ version: number }>(
        'SELECT MAX(version) AS version FROM schema_migrations',
      );
      expect(row?.version).toBe(MIGRATIONS.length);
    });

    it('crea las tablas de la versión 2', async () => {
      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      );
      const names = tables.map((row) => row.name);

      for (const table of ['sessions', 'threshold_sets', 'diagnoses', 'settings']) {
        expect(names).toContain(table);
      }
    });

    it('agrega las columnas nuevas a lotes y mediciones', async () => {
      const plots = await db.getAllAsync<{ name: string }>('PRAGMA table_info(plots)');
      const measurements = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(measurements)',
      );

      expect(plots.map((row) => row.name)).toContain('cartographic_unit');
      expect(measurements.map((row) => row.name)).toContain('session_id');
      expect(measurements.map((row) => row.name)).toContain('thresholds_version');
      expect(measurements.map((row) => row.name)).toContain('calibration_version');
    });

    it('crea el índice de diagnósticos por medición', async () => {
      const indexes = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'diagnoses'",
      );

      expect(indexes.map((row) => row.name)).toContain('idx_diagnoses_measurement');
    });

    it('agrega el detalle por variable al diagnóstico', async () => {
      const diagnoses = await db.getAllAsync<{ name: string }>('PRAGMA table_info(diagnoses)');

      expect(diagnoses.map((row) => row.name)).toContain('variables_json');
    });

    it('hace único el config_id de la sesión', async () => {
      const indexes = await db.getAllAsync<{ name: string; unique: number }>(
        "PRAGMA index_list('sessions')",
      );
      const unico = indexes.find((row) => row.name === 'idx_sessions_config_id');

      expect(unico).toBeDefined();
      expect(unico?.unique).toBe(1);
    });
  });
});
