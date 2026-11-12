/** Estado de la sesión en el bastón: enviada, aceptada o vencida. */
export type SessionStatus = 'sent' | 'accepted' | 'expired';

/**
 * Sesión de medición: la configuración que se envía al bastón y con la que se
 * interpreta lo que este devuelve.
 */
export interface Session {
  readonly id: string;
  readonly plotId: string;
  readonly configId: number;
  readonly cropPrimary: string;
  readonly cropSecondary: string | null;
  readonly depthCm: number;
  readonly cartographicUnit: string;
  readonly lastFertilizationDate: string | null;
  readonly thresholdsVersion: string;
  readonly firmwareVersion: string | null;
  readonly sentAt: string;
  readonly acceptedAt: string | null;
  readonly status: SessionStatus;
}

/** Almacén de sesiones de medición. */
export interface SessionStore {
  insert(session: Session): Promise<void>;
  get(id: string): Promise<Session | null>;
  /** La sesión viva del bastón: la que ocupa el `config_id` vigente. */
  findByConfigId(configId: number): Promise<Session | null>;
  listByPlot(plotId: string): Promise<Session[]>;
}
