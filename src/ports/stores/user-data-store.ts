/** Cuántos registros de cada tipo se borraron al vaciar los datos de la persona. */
export interface ErasedUserData {
  readonly farms: number;
  readonly plots: number;
  readonly captures: number;
  readonly measurements: number;
  readonly diagnoses: number;
  readonly sessions: number;
  readonly syncStates: number;
  readonly mapPackages: number;
}

/**
 * Borrado de todos los datos personales guardados en la app.
 *
 * Es un puerto aparte porque el borrado cruza varias tablas y debe ser una
 * sola transacción: si algo falla, no queda media base vacía. No toca los
 * umbrales científicos ni la constancia de que la persona vio el aviso de
 * privacidad.
 */
export interface UserDataStore {
  /** Vacía fincas, lotes, capturas, mediciones, diagnósticos, sesiones y sincronización. */
  eraseAll(): Promise<ErasedUserData>;
}
