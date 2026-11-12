import {
  countOutcome,
  ingestSyncedRecord,
  type SyncCounters,
} from '@/application/sync/ingest-synced-records';
import type { SyncSummary } from '@/application/sync/sync-from-stick';
import { parseRecordHeader, type StickRecord } from '@/domain/protocol/record-codec';
import type { UnitOfWork } from '@/ports/stores/unit-of-work';

export interface ImportCsvDeps {
  readonly uow: UnitOfWork;
  readonly clock: () => string;
  readonly newId: () => string;
}

/**
 * Parte el contenido del archivo en filas.
 *
 * Respeta las comillas: una celda entrecomillada puede traer comas y saltos de
 * línea dentro, y eso no parte la fila.
 */
function splitRows(contents: string): string[] {
  const rows: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents.charAt(index);

    if (char === '"') {
      if (quoted && contents.charAt(index + 1) === '"') {
        current += '""';
        index += 1;
        continue;
      }

      quoted = !quoted;
      current += char;
      continue;
    }

    if (!quoted && (char === '\n' || char === '\r')) {
      rows.push(current);
      current = '';

      if (char === '\r' && contents.charAt(index + 1) === '\n') {
        index += 1;
      }

      continue;
    }

    current += char;
  }

  if (current !== '') {
    rows.push(current);
  }

  return rows;
}

/** Crea los contadores del resumen en cero. */
function emptyCounters(): SyncCounters {
  return { received: 0, imported: 0, duplicates: 0, conflicts: 0, errors: 0 };
}

/**
 * Importa a mano el archivo CSV de la microSD.
 *
 * Usa el mismo códec, el mismo pipeline y la misma deduplicación que la
 * sincronización por BLE (RF-APP-042): un id repetido se ignora y un id
 * repetido con otro contenido conserva el primero y se avisa (RF-APP-040).
 *
 * Una línea inválida cuenta como error y no detiene la importación. Aquí no
 * hay bastón al que confirmar, así que `lastConfirmedSequence` es el último
 * `id_registro` procesado.
 */
export async function importCsvFromStick(
  contents: string,
  deps: ImportCsvDeps,
): Promise<SyncSummary> {
  const rows = splitRows(contents.replace(/^\uFEFF/, ''));
  const header = rows[0];

  if (header === undefined) {
    return {
      received: 0,
      imported: 0,
      duplicates: 0,
      conflicts: 0,
      errors: 0,
      lastConfirmedSequence: 0,
    };
  }

  // El encabezado tiene que ser el del contrato; si no, el archivo no es del
  // bastón y no se puede interpretar.
  parseRecordHeader(header);

  const counters = emptyCounters();
  let lastSequence = 0;

  for (const row of rows.slice(1)) {
    if (row.trim() === '') {
      continue;
    }

    let record: StickRecord | undefined;

    try {
      [record] = parseRecordHeader(`${header}\n${row}`);
    } catch {
      counters.received += 1;
      counters.errors += 1;
      continue;
    }

    if (record === undefined) {
      continue;
    }

    counters.received += 1;

    const outcome = await ingestSyncedRecord(
      { line: row, deviceId: null, origin: 'import' },
      { uow: deps.uow, clock: deps.clock, newId: deps.newId },
    );

    countOutcome(counters, outcome);

    if (outcome !== 'error') {
      lastSequence = Math.max(lastSequence, record.idRegistro ?? 0);
    }
  }

  return {
    received: counters.received,
    imported: counters.imported,
    duplicates: counters.duplicates,
    conflicts: counters.conflicts,
    errors: counters.errors,
    lastConfirmedSequence: lastSequence,
  };
}
