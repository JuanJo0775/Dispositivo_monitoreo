import type {
  CaptureFlags,
  CaptureOrigin,
  CapturePayload,
  RawCapture,
} from '@/domain/capture/types';
import type { Measurement } from '@/domain/measurement/types';
import type { CaptureStore } from '@/ports/stores/capture-store';
import type { MeasurementFilter, MeasurementStore } from '@/ports/stores/measurement-store';
import type { StoreTransaction, UnitOfWork } from '@/ports/stores/unit-of-work';

import type { SqlBindValue, SqlDatabase } from './sql-database';

interface CaptureRow {
  device_id: string;
  sequence: number;
  payload_json: string;
  flags_json: string;
  captured_at_utc: string;
  received_at_utc: string;
  origin: string;
  config_id: number;
  plot_id: string | null;
}

interface MeasurementRow {
  id: string;
  capture_id: string;
  plot_id: string | null;
  payload_json: string;
  captured_at_utc: string;
  valid: number;
  invalid_reasons_json: string;
  notes: string | null;
  photo_path: string | null;
  discarded_at: string | null;
  created_at: string;
}

function toRawCapture(row: CaptureRow): RawCapture {
  return {
    deviceId: row.device_id,
    sequence: row.sequence,
    payload: JSON.parse(row.payload_json) as CapturePayload,
    flags: JSON.parse(row.flags_json) as CaptureFlags,
    capturedAtUtc: row.captured_at_utc,
    receivedAtUtc: row.received_at_utc,
    origin: row.origin as CaptureOrigin,
    configId: row.config_id,
    plotId: row.plot_id,
  };
}

function toMeasurement(row: MeasurementRow): Measurement {
  return {
    id: row.id,
    captureId: row.capture_id,
    plotId: row.plot_id,
    payload: JSON.parse(row.payload_json) as CapturePayload,
    capturedAtUtc: row.captured_at_utc,
    valid: row.valid === 1,
    invalidReasons: JSON.parse(row.invalid_reasons_json) as string[],
    notes: row.notes,
    photoPath: row.photo_path,
    discardedAt: row.discarded_at,
    createdAt: row.created_at,
  };
}

const CAPTURE_COLUMNS =
  'device_id, sequence, payload_json, flags_json, captured_at_utc, received_at_utc, origin, config_id, plot_id';

const MEASUREMENT_COLUMNS =
  'id, capture_id, plot_id, payload_json, captured_at_utc, valid, invalid_reasons_json, notes, photo_path, discarded_at, created_at';

/** Almacenes respaldados por SQLite. La app real usa esta implementación. */
export function createSqliteStores(db: SqlDatabase): StoreTransaction & { uow: UnitOfWork } {
  const captures: CaptureStore = {
    async insertRaw(capture) {
      await db.runAsync(
        `INSERT INTO captures (${CAPTURE_COLUMNS}, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          capture.deviceId,
          capture.sequence,
          JSON.stringify(capture.payload),
          JSON.stringify(capture.flags),
          capture.capturedAtUtc,
          capture.receivedAtUtc,
          capture.origin,
          capture.configId,
          capture.plotId,
          capture.receivedAtUtc,
        ],
      );
    },

    async findByDeviceSequence(deviceId, sequence) {
      const row = await db.getFirstAsync<CaptureRow>(
        `SELECT ${CAPTURE_COLUMNS} FROM captures WHERE device_id = ? AND sequence = ?`,
        [deviceId, sequence],
      );

      return row === null ? null : toRawCapture(row);
    },
  };

  const measurements: MeasurementStore = {
    async insert(measurement) {
      await db.runAsync(
        `INSERT INTO measurements (${MEASUREMENT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          measurement.id,
          measurement.captureId,
          measurement.plotId,
          JSON.stringify(measurement.payload),
          measurement.capturedAtUtc,
          measurement.valid ? 1 : 0,
          JSON.stringify(measurement.invalidReasons),
          measurement.notes,
          measurement.photoPath,
          measurement.discardedAt,
          measurement.createdAt,
        ],
      );
    },

    async list(filter: MeasurementFilter = {}) {
      const conditions: string[] = [];
      const params: SqlBindValue[] = [];

      if (filter.plotId !== undefined) {
        conditions.push('plot_id = ?');
        params.push(filter.plotId);
      }

      if (filter.includeDiscarded !== true) {
        conditions.push('discarded_at IS NULL');
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await db.getAllAsync<MeasurementRow>(
        `SELECT ${MEASUREMENT_COLUMNS} FROM measurements ${where} ORDER BY captured_at_utc DESC`,
        params,
      );

      return rows.map(toMeasurement);
    },

    async get(id) {
      const row = await db.getFirstAsync<MeasurementRow>(
        `SELECT ${MEASUREMENT_COLUMNS} FROM measurements WHERE id = ?`,
        [id],
      );

      return row === null ? null : toMeasurement(row);
    },
  };

  const uow: UnitOfWork = {
    async run<T>(work: (stores: StoreTransaction) => Promise<T>): Promise<T> {
      let result: T | undefined;
      let hasResult = false;

      await db.withTransactionAsync(async () => {
        result = await work({ captures, measurements });
        hasResult = true;
      });

      if (!hasResult) {
        throw new Error('la transacción terminó sin resultado');
      }

      return result as T;
    },
  };

  return { captures, measurements, uow };
}
