import { DatabaseSync } from 'node:sqlite';

import type { SqlBindValue, SqlDatabase } from '@/infrastructure/db/sql-database';

export interface TestSqlDatabase extends SqlDatabase {
  close(): void;
}

type BindParam = string | number | null;

function toParams(params: SqlBindValue[]): BindParam[] {
  return params.map((param) => (typeof param === 'boolean' ? (param ? 1 : 0) : param));
}

/**
 * SQLite real en memoria para pruebas de infraestructura.
 *
 * Usa `node:sqlite` para no depender del emulador ni del módulo nativo: valida
 * el SQL, las restricciones y el mapeo de filas de verdad.
 */
export function makeTestSqlDatabase(): TestSqlDatabase {
  const db = new DatabaseSync(':memory:');

  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params = []) {
      db.prepare(sql).run(...toParams(params));
    },
    async getAllAsync<T>(sql: string, params: SqlBindValue[] = []) {
      return db.prepare(sql).all(...toParams(params)) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlBindValue[] = []) {
      const row = db.prepare(sql).get(...toParams(params));
      return (row ?? null) as T | null;
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}
