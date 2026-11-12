/** Valor que SQLite acepta como parámetro de una consulta. */
export type SqlBindValue = string | number | null | boolean;

/**
 * Contrato mínimo que necesitan los almacenes SQLite.
 *
 * `expo-sqlite` lo cumple; en pruebas se puede sustituir por un doble sin
 * arrastrar el módulo nativo. Las capas de dominio y aplicación no lo ven.
 */
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlBindValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: SqlBindValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlBindValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
