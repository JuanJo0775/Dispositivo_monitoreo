import {
  countOutcome,
  ingestSyncedRecord,
  type SyncCounters,
} from '@/application/sync/ingest-synced-records';
import type { StickSync } from '@/ports/stick-sync';
import type { SyncStateStore } from '@/ports/stores/sync-state-store';
import type { UnitOfWork } from '@/ports/stores/unit-of-work';

/** Resultado de una sincronización o de una importación. */
export interface SyncSummary {
  readonly received: number;
  readonly imported: number;
  readonly duplicates: number;
  readonly conflicts: number;
  readonly errors: number;
  readonly lastConfirmedSequence: number;
}

export interface SyncFromStickDeps {
  /** La vía hacia el bastón: pide bloques y confirma el último id. */
  readonly sync: StickSync;
  /** El estado de sincronización, para reanudar y para mostrar el progreso. */
  readonly syncState: SyncStateStore;
  readonly uow: UnitOfWork;
  readonly clock: () => string;
  readonly newId: () => string;
}

/** Crea los contadores del resumen en cero. */
function emptyCounters(): SyncCounters {
  return { received: 0, imported: 0, duplicates: 0, conflicts: 0, errors: 0 };
}

/**
 * Sincroniza la microSD del bastón con la base local.
 *
 * El flujo es siempre el mismo: se pide desde el último id confirmado, cada
 * registro entra por el pipeline de ingesta, y solo después de guardado se
 * confirma el bloque al bastón (RF-APP-039). El progreso se cuenta por
 * registros confirmados, no por paquetes (RF-APP-041).
 *
 * Si algo falla, el estado queda en `error` y el error se propaga: la
 * sincronización reanuda desde el último id confirmado la próxima vez.
 */
export async function syncFromStick(
  input: { deviceId: string; fromSequence?: number },
  deps: SyncFromStickDeps,
): Promise<SyncSummary> {
  const { deviceId } = input;
  const previous = await deps.syncState.get(deviceId);
  const lastConfirmed = previous?.lastConfirmedSequence ?? 0;
  const fromSequence = input.fromSequence ?? lastConfirmed + 1;

  const counters = emptyCounters();
  let confirmed = lastConfirmed;

  await deps.syncState.save({
    deviceId,
    lastConfirmedSequence: confirmed,
    status: 'syncing',
    updatedAt: deps.clock(),
  });

  try {
    await deps.sync.syncFrom(deviceId, fromSequence, async (chunk) => {
      for (const line of chunk.records) {
        counters.received += 1;

        const outcome = await ingestSyncedRecord(
          { line, deviceId, origin: 'stick' },
          { uow: deps.uow, clock: deps.clock, newId: deps.newId },
        );

        countOutcome(counters, outcome);
      }

      confirmed = Math.max(confirmed, chunk.lastSequence);

      await deps.syncState.save({
        deviceId,
        lastConfirmedSequence: confirmed,
        status: 'syncing',
        updatedAt: deps.clock(),
      });

      // El bastón no borra nada de su microSD hasta recibir esta confirmación.
      await deps.sync.confirmRecords(deviceId, confirmed);
    });
  } catch (error) {
    try {
      await deps.syncState.save({
        deviceId,
        lastConfirmedSequence: confirmed,
        status: 'error',
        updatedAt: deps.clock(),
      });
    } catch {
      // Si el estado tampoco se puede guardar, manda el error original.
    }

    throw error;
  }

  await deps.syncState.save({
    deviceId,
    lastConfirmedSequence: confirmed,
    status: 'idle',
    updatedAt: deps.clock(),
  });

  return {
    received: counters.received,
    imported: counters.imported,
    duplicates: counters.duplicates,
    conflicts: counters.conflicts,
    errors: counters.errors,
    lastConfirmedSequence: confirmed,
  };
}
