import type { ErasedUserData, UserDataStore } from '@/ports/stores/user-data-store';

/** Registros que el doble dice haber borrado. */
const NADA: ErasedUserData = {
  farms: 0,
  plots: 0,
  captures: 0,
  measurements: 0,
  diagnoses: 0,
  sessions: 0,
  syncStates: 0,
  mapPackages: 0,
};

export interface InMemoryUserDataStore extends UserDataStore {
  /** Cuántas veces se pidió el borrado. */
  readonly calls: number;
}

/**
 * Doble del borrado de datos personales.
 *
 * Devuelve los conteos sembrados y cuenta las llamadas; no borra nada real.
 * Sirve para probar la pantalla y el caso de uso sin SQLite.
 */
export function makeInMemoryUserDataStore(
  seed: Partial<ErasedUserData> = {},
): InMemoryUserDataStore {
  const erased: ErasedUserData = { ...NADA, ...seed };
  let calls = 0;

  return {
    get calls() {
      return calls;
    },
    async eraseAll() {
      calls += 1;
      return erased;
    },
  };
}
