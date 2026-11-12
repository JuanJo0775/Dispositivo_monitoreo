import type { DiagnosisStore, StoredDiagnosis } from '@/ports/stores/diagnosis-store';
import type { Session, SessionStore } from '@/ports/stores/session-store';
import type { SettingsStore } from '@/ports/stores/settings-store';

/** Almacén de sesiones en memoria, para pruebas de aplicación. */
export function makeInMemorySessionStore(seed: readonly Session[] = []) {
  const rows: Session[] = [...seed];

  const sessions: SessionStore = {
    async insert(session) {
      rows.push(session);
    },
    async get(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async findByConfigId(configId) {
      return rows.find((row) => row.configId === configId) ?? null;
    },
    async listByPlot(plotId) {
      return rows.filter((row) => row.plotId === plotId);
    },
  };

  return { sessions, sessionRows: rows };
}

/** Almacén de diagnósticos en memoria, para pruebas de aplicación. */
export function makeInMemoryDiagnosisStore(seed: readonly StoredDiagnosis[] = []) {
  const rows: StoredDiagnosis[] = [...seed];

  const diagnoses: DiagnosisStore = {
    async insert(diagnosis) {
      rows.push(diagnosis);
    },
    async get(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async listByMeasurement(measurementId) {
      return rows.filter((row) => row.measurementId === measurementId);
    },
  };

  return { diagnoses, diagnosisRows: rows };
}

/** Almacén de ajustes en memoria, para pruebas de aplicación. */
export function makeInMemorySettingsStore(seed: Record<string, string> = {}) {
  const rows: Record<string, string> = { ...seed };

  const settings: SettingsStore = {
    async get(key) {
      return rows[key] ?? null;
    },
    async set(key, value) {
      rows[key] = value;
    },
    async list() {
      return { ...rows };
    },
  };

  return { settings, settingRows: rows };
}
