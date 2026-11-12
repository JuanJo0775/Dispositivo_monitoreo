import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { SessionConfig } from '@/domain/session/types';
import type { Clock } from '@/ports/clock';
import type { FarmStore } from '@/ports/stores/farm-store';
import type { Session, SessionStore } from '@/ports/stores/session-store';
import type { SettingsStore } from '@/ports/stores/settings-store';
import type { StickGateway } from '@/ports/stick-gateway';

export interface StartSessionInput {
  /** Lote donde se va a medir. */
  readonly plotId: string;
  /** Cultivo principal, con la clave con la que está en el set de umbrales. */
  readonly cropPrimary: string;
  /** Cultivo secundario, si el lote tiene uno. */
  readonly cropSecondary?: string | null;
  /** Profundidad de muestreo en centímetros; si no se informa, la del lote. */
  readonly depthCm?: number | null;
  /** Unidad cartográfica; si no se informa, la del lote. */
  readonly cartographicUnit?: string | null;
  /** Última fertilización, en formato `AAAA-MM-DD`; si no se informa, la del lote. */
  readonly lastFertilizationDate?: string | null;
}

export interface StartSessionDeps {
  readonly farms: FarmStore;
  readonly sessions: SessionStore;
  readonly settings: SettingsStore;
  readonly gateway: StickGateway;
  readonly clock: Clock;
  readonly thresholds: ThresholdSet;
  readonly newId: () => string;
}

/** Clave de ajustes donde vive el contador de `config_id`. */
export const NEXT_CONFIG_ID_KEY = 'next_config_id';

/** Profundidad de muestreo por defecto, en centímetros. */
export const DEFAULT_SESSION_DEPTH_CM = 20;

/**
 * Inicia una sesión de medición: arma la configuración, la guarda y la
 * escribe al bastón.
 *
 * El `config_id` lo asigna la app con un contador que vive en los ajustes:
 * es lo que garantiza que cada configuración tenga un identificador único,
 * aunque la app se reinicie. La sesión se guarda antes de escribir al bastón
 * (guardar → escribir), para que el bastón nunca referencie una
 * configuración que la app no conoce.
 */
export async function startSession(
  input: StartSessionInput,
  deps: StartSessionDeps,
): Promise<Session> {
  const plot = await deps.farms.getPlot(input.plotId);

  if (plot === null) {
    throw new Error('El lote que se quiere medir no existe.');
  }

  const cropPrimary = input.cropPrimary.trim();

  if (cropPrimary.length === 0 || deps.thresholds.crops[cropPrimary] === undefined) {
    throw new Error(
      `No hay umbrales para el cultivo «${cropPrimary}»: no se puede iniciar la sesión.`,
    );
  }

  const cartographicUnit = input.cartographicUnit ?? plot.cartographicUnit;

  if (cartographicUnit === null || cartographicUnit.trim().length === 0) {
    throw new Error(
      'El lote no tiene unidad cartográfica: sin ella no hay umbrales de humedad ni de materia orgánica.',
    );
  }

  const configId = await reserveConfigId(deps.settings);
  const now = deps.clock.now();

  const session: Session = {
    id: deps.newId(),
    plotId: plot.id,
    configId,
    cropPrimary,
    cropSecondary: input.cropSecondary !== undefined ? input.cropSecondary : plot.cropSecondary,
    depthCm: input.depthCm ?? plot.depthCm ?? DEFAULT_SESSION_DEPTH_CM,
    cartographicUnit,
    lastFertilizationDate:
      input.lastFertilizationDate !== undefined
        ? input.lastFertilizationDate
        : plot.lastFertilizationDate,
    thresholdsVersion: deps.thresholds.version,
    firmwareVersion: deps.gateway.status().firmwareVersion,
    sentAt: now,
    acceptedAt: null,
    status: 'sent',
  };

  const config: SessionConfig = {
    configId,
    plotId: plot.id,
    cropPrimary: session.cropPrimary,
    cropSecondary: session.cropSecondary,
    depthCm: session.depthCm,
    cartographicUnit: session.cartographicUnit,
    lastFertilizationDate: session.lastFertilizationDate,
    thresholdsVersion: session.thresholdsVersion,
    createdAtUtc: now,
  };

  await deps.sessions.insert(session);
  await deps.gateway.writeConfig(config);

  return session;
}

/**
 * Reserva el siguiente `config_id` y deja el contador apuntando al siguiente.
 *
 * El contador se avanza antes de guardar la sesión: así, si el guardado o la
 * escritura al bastón fallan, el identificador no se vuelve a usar.
 */
async function reserveConfigId(settings: SettingsStore): Promise<number> {
  const stored = await settings.get(NEXT_CONFIG_ID_KEY);
  const parsed = stored === null ? Number.NaN : Number.parseInt(stored, 10);
  const configId = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;

  await settings.set(NEXT_CONFIG_ID_KEY, String(configId + 1));

  return configId;
}
