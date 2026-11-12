import type { SQLiteDatabase } from 'expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';

import { applyMigrations, pendingMigrations } from './migrations';
import type { SqlBindValue, SqlDatabase } from './sql-database';
import { createSqliteStores } from './sqlite-stores';

export const DATABASE_NAME = 'monitoreo.db';

/** Adapta `expo-sqlite` al contrato mínimo que usan los almacenes. */
export function adaptSqlDatabase(db: SQLiteDatabase): SqlDatabase {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params: SqlBindValue[] = []) => db.runAsync(sql, params),
    getAllAsync: <T>(sql: string, params: SqlBindValue[] = []) => db.getAllAsync<T>(sql, params),
    getFirstAsync: <T>(sql: string, params: SqlBindValue[] = []) =>
      db.getFirstAsync<T>(sql, params),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

/**
 * Abre la base local, activa WAL y aplica las migraciones pendientes.
 *
 * La base es la única fuente de verdad de la app: no hay red ni servidor que
 * reconciliar. `foreign_keys` se activa en cada conexión porque SQLite lo
 * olvida entre aperturas.
 */
export async function openDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await applyMigrations(adaptSqlDatabase(db));
  return db;
}

export { applyMigrations, createSqliteStores, pendingMigrations };
