/** Almacén de ajustes de la aplicación, en pares de clave y valor. */
export interface SettingsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  list(): Promise<Record<string, string>>;
}
