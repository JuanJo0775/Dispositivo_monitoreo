import { ingestCapture } from '@/application/capture/ingest-capture';
import type { CaptureOrigin, CapturePayload, RawCapture } from '@/domain/capture/types';
import { decodeRecord, flagsFromBits, type StickRecord } from '@/domain/protocol/record-codec';
import type { UnitOfWork } from '@/ports/stores/unit-of-work';

/** Qué pasó con un registro que llegó del bastón o de la microSD. */
export type SyncedRecordOutcome = 'imported' | 'duplicate' | 'conflict' | 'error';

export interface IngestSyncedRecordInput {
  /** Línea CSV del contrato, sin encabezado. */
  readonly line: string;
  /** Bastón al que se le pide el registro; el `device_id` del registro manda. */
  readonly deviceId?: string | null;
  /** De dónde viene el registro: la sincronización o la importación manual. */
  readonly origin?: CaptureOrigin;
}

export interface IngestSyncedRecordDeps {
  readonly uow: UnitOfWork;
  readonly clock: () => string;
  readonly newId: () => string;
}

/** Contadores del resumen de una sincronización o de una importación. */
export interface SyncCounters {
  received: number;
  imported: number;
  duplicates: number;
  conflicts: number;
  errors: number;
}

/** Suma el resultado de un registro a los contadores del resumen. */
export function countOutcome(counters: SyncCounters, outcome: SyncedRecordOutcome): void {
  if (outcome === 'imported') {
    counters.imported += 1;
    return;
  }

  if (outcome === 'duplicate') {
    counters.duplicates += 1;
    return;
  }

  if (outcome === 'conflict') {
    counters.conflicts += 1;
    return;
  }

  counters.errors += 1;
}

/** Arma el payload de la captura con las columnas del contrato. */
function toPayload(record: StickRecord): CapturePayload {
  return {
    latitude: record.lat,
    longitude: record.lon,
    altitudeM: record.altM,
    speedKmh: record.velKmh,
    satellites: record.sats,
    hdop: record.hdop,
    fixAgeS: record.edadFixS,
    depthCm: record.profCm,
    cropCode: record.cultivo,
    plotCode: record.loteId,
    lastFertilizationDate: record.fertFecha,
    humidityPct: record.humedadPct,
    temperatureC: record.tempC,
    ph: record.ph,
    ecUsCm: record.ceUsCm,
    nMgKg: record.nMgKg,
    pMgKg: record.pMgKg,
    kMgKg: record.kMgKg,
    batteryPct: record.batPct,
    firmwareVersion: record.fwVer,
  };
}

/**
 * Instante de captura, en UTC.
 *
 * Con la fecha y la hora del bastón se arma el ISO; si falta la hora se toma
 * el inicio del día y, si falta la fecha, el momento en que llegó el registro.
 */
function toCapturedAtUtc(record: StickRecord, fallback: string): string {
  if (record.fecha === null) {
    return fallback;
  }

  const hora = record.horaUtc === null ? '00:00:00' : record.horaUtc;

  return `${record.fecha}T${hora}Z`;
}

/**
 * JSON canónico: las claves en orden alfabético y sin comillas.
 *
 * Sirve para comparar el contenido de dos capturas sin depender del orden en
 * que las claves se escribieron.
 */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

/**
 * ¿El registro guardado es el mismo que el que llega?
 *
 * Se comparan el payload y las banderas: si el id ya está y el contenido
 * cambia, se conserva el primero y la app avisa (RF-APP-040).
 */
function sameContent(stored: RawCapture, incoming: RawCapture): boolean {
  return (
    canonicalJson(stored.payload) === canonicalJson(incoming.payload) &&
    canonicalJson(stored.flags) === canonicalJson(incoming.flags)
  );
}

/**
 * Convierte una línea del bastón en captura y la guarda.
 *
 * La captura entra por el mismo camino que la captura en vivo: la misma
 * transacción, la misma validación y la misma medición derivada. Lo que cambia
 * es el resultado:
 *
 * - `imported`: el registro era nuevo y quedó guardado.
 * - `duplicate`: el id ya estaba y el contenido es el mismo; se ignora.
 * - `conflict`: el id ya estaba con otro contenido; se conserva el primero.
 * - `error`: la línea no es un registro del contrato, o no trae identidad.
 */
export async function ingestSyncedRecord(
  input: IngestSyncedRecordInput,
  deps: IngestSyncedRecordDeps,
): Promise<SyncedRecordOutcome> {
  let record: StickRecord;

  try {
    record = decodeRecord(input.line);
  } catch {
    return 'error';
  }

  const deviceId = record.deviceId ?? input.deviceId ?? null;
  const sequence = record.idRegistro;

  if (deviceId === null || sequence === null) {
    return 'error';
  }

  const receivedAtUtc = deps.clock();
  const capture: RawCapture = {
    deviceId,
    sequence,
    payload: toPayload(record),
    capturedAtUtc: toCapturedAtUtc(record, receivedAtUtc),
    receivedAtUtc,
    origin: input.origin ?? 'stick',
    flags: flagsFromBits(record.banderas ?? 0),
    configId: record.configId ?? 0,
    plotId: null,
  };

  const stored = await deps.uow.run(async (stores) =>
    stores.captures.findByDeviceSequence(capture.deviceId, capture.sequence),
  );

  if (stored !== null) {
    return sameContent(stored, capture) ? 'duplicate' : 'conflict';
  }

  const result = await ingestCapture(
    { capture, plotId: null },
    { uow: deps.uow, clock: deps.clock, newId: deps.newId },
  );

  return result.status === 'saved' ? 'imported' : 'duplicate';
}
