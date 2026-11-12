import type { Session, SessionStore } from '@/ports/stores/session-store';

export interface InMemorySessionStore {
  /** Doble del puerto de sesiones. */
  readonly sessions: SessionStore;
  /** Sesiones guardadas, en el orden en que se insertaron. */
  readonly sessionRows: readonly Session[];
}

/**
 * Implementación en memoria de `SessionStore` para pruebas.
 *
 * `findByConfigId` devuelve la primera sesión con ese `config_id`, como hace
 * la tabla real, donde la columna es única.
 */
export function makeInMemorySessionStore(seed: readonly Session[] = []): InMemorySessionStore {
  const sessionRows: Session[] = [...seed];

  const sessions: SessionStore = {
    async insert(session) {
      sessionRows.push(session);
    },
    async get(id) {
      return sessionRows.find((row) => row.id === id) ?? null;
    },
    async findByConfigId(configId) {
      return sessionRows.find((row) => row.configId === configId) ?? null;
    },
    async listByPlot(plotId) {
      return sessionRows.filter((row) => row.plotId === plotId);
    },
  };

  return { sessions, sessionRows };
}
