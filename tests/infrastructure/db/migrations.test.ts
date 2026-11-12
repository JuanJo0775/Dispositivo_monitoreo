import { MIGRATIONS, pendingMigrations } from '@/infrastructure/db/migrations';

const allSql = MIGRATIONS.map((migration) => migration.sql).join('\n');

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
});
