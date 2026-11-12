import type {
  CaptureFlags,
  CaptureOrigin,
  CapturePayload,
  RawCapture,
} from '@/domain/capture/types';
import type {
  AptitudeClass,
  Confidence,
  DiagnosisAlert,
  DiagnosisEvidence,
  DiagnosisIndex,
  DiagnosisResult,
  DiagnosisVariable,
  LimitingFactor,
  VariableResult,
  VariableRole,
  VariableStatus,
} from '@/domain/diagnosis/types';
import type { Drainage, Farm, Plot } from '@/domain/farm/types';
import type { Measurement } from '@/domain/measurement/types';
import type { CaptureStore } from '@/ports/stores/capture-store';
import type { DiagnosisStore, StoredDiagnosis } from '@/ports/stores/diagnosis-store';
import type { FarmStore } from '@/ports/stores/farm-store';
import type { MeasurementFilter, MeasurementStore } from '@/ports/stores/measurement-store';
import type { Session, SessionStore, SessionStatus } from '@/ports/stores/session-store';
import type { SettingsStore } from '@/ports/stores/settings-store';
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

interface FarmRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface PlotRow {
  id: string;
  farm_id: string;
  name: string;
  crop_primary: string | null;
  crop_secondary: string | null;
  depth_cm: number | null;
  cartographic_unit: string | null;
  last_fertilization_date: string | null;
  drainage: string | null;
  shading: string | null;
  density: string | null;
  planting_density_ha: number | null;
  altitude_m: number | null;
  slope: number | null;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  plot_id: string;
  config_id: number;
  crop_primary: string;
  crop_secondary: string | null;
  depth_cm: number;
  cartographic_unit: string;
  last_fertilization_date: string | null;
  thresholds_version: string;
  firmware_version: string | null;
  sent_at: string;
  accepted_at: string | null;
  status: string;
}

interface DiagnosisRow {
  id: string;
  measurement_id: string;
  engine_version: string;
  thresholds_version: string;
  calibration_version: string;
  firmware_version: string | null;
  context_snapshot_json: string;
  classes_json: string;
  limiting_factors_json: string;
  alerts_json: string;
  evidence_json: string;
  uncertainty_json: string;
  variables_json: string;
  explanation: string;
  created_at: string;
}

interface SettingRow {
  key: string;
  value: string;
}

/** Vocabularios cerrados: un valor desconocido no se inventa, se descarta. */
const APTITUDE_CLASS = new Map<string, AptitudeClass>([
  ['S1', 'S1'],
  ['S2', 'S2'],
  ['S3', 'S3'],
  ['N', 'N'],
]);

const SESSION_STATUS = new Map<string, SessionStatus>([
  ['sent', 'sent'],
  ['accepted', 'accepted'],
  ['expired', 'expired'],
]);

const DRAINAGE = new Map<string, Drainage>([
  ['bien_drenado', 'bien_drenado'],
  ['moderado', 'moderado'],
  ['deficiente', 'deficiente'],
  ['encharcado', 'encharcado'],
]);

const VARIABLE_ROLE = new Map<string, VariableRole>([
  ['verdict', 'verdict'],
  ['indicative', 'indicative'],
  ['reference', 'reference'],
]);

const VARIABLE_STATUS = new Map<string, VariableStatus>([
  ['class', 'class'],
  ['interval', 'interval'],
  ['band', 'band'],
  ['alert', 'alert'],
  ['reference', 'reference'],
]);

const CONFIDENCE = new Map<string, Confidence>([
  ['alta', 'alta'],
  ['media', 'media'],
  ['baja', 'baja'],
  ['estimada', 'estimada'],
]);

const ALERT_SEVERITY = new Map<string, DiagnosisAlert['severity']>([
  ['info', 'info'],
  ['warning', 'warning'],
  ['blocking', 'blocking'],
]);

const DIAGNOSIS_VARIABLE = new Map<string, DiagnosisVariable>([
  ['humidity', 'humidity'],
  ['ph', 'ph'],
  ['ec', 'ec'],
  ['n', 'n'],
  ['nSensor', 'nSensor'],
  ['p', 'p'],
  ['k', 'k'],
  ['temperature', 'temperature'],
  ['organicMatter', 'organicMatter'],
  ['cic', 'cic'],
]);

const VALIDITY = new Map<string, DiagnosisResult['validity']>([
  ['valid', 'valid'],
  ['blocked', 'blocked'],
  ['insufficient_data', 'insufficient_data'],
]);

/**
 * Clave reservada dentro de `context_snapshot_json`.
 *
 * La validez y los índices del resultado no tienen columna propia: viajan con la copia inmutable
 * del contexto y se retiran al leer, de manera que el contexto que devuelve el almacén es
 * exactamente el que se guardó.
 */
const RESERVED_CONTEXT_KEY = '__diagnostico';

/** Datos del resultado que viajan en la copia del contexto. */
interface DiagnosisMeta {
  readonly validity: DiagnosisResult['validity'];
  readonly index: DiagnosisIndex;
}

/** Incertidumbre de una variable: lo único que la tabla de incertidumbre guarda por variable. */
interface VariableUncertainty {
  readonly variable: DiagnosisVariable;
  readonly uncertainty: number | null;
  readonly suitabilityInterval: { readonly lower: number; readonly upper: number } | null;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Lista de JSON; si el valor no es una lista, se devuelve una lista vacía. */
function parseList(value: string): unknown[] {
  const parsed = parseJson(value);

  return Array.isArray(parsed) ? (parsed as unknown[]) : [];
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as unknown[]).filter((item): item is string => typeof item === 'string');
}

function toAptitudeClass(value: unknown): AptitudeClass | null {
  return typeof value === 'string' ? (APTITUDE_CLASS.get(value) ?? null) : null;
}

function toAptitudeClasses(value: unknown): AptitudeClass[] {
  const classes: AptitudeClass[] = [];

  for (const item of toStringList(value)) {
    const aptitudeClass = APTITUDE_CLASS.get(item);

    if (aptitudeClass !== undefined) {
      classes.push(aptitudeClass);
    }
  }

  return classes;
}

function toInterval(value: unknown): { readonly lower: number; readonly upper: number } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const interval = value as { lower?: unknown; upper?: unknown };

  if (typeof interval.lower !== 'number' || typeof interval.upper !== 'number') {
    return null;
  }

  return { lower: interval.lower, upper: interval.upper };
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

function toFarm(row: FarmRow): Farm {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPlot(row: PlotRow): Plot {
  return {
    id: row.id,
    farmId: row.farm_id,
    name: row.name,
    cropPrimary: row.crop_primary,
    cropSecondary: row.crop_secondary,
    depthCm: row.depth_cm,
    cartographicUnit: row.cartographic_unit,
    lastFertilizationDate: row.last_fertilization_date,
    drainage: row.drainage === null ? null : (DRAINAGE.get(row.drainage) ?? null),
    shading: row.shading,
    density: row.density,
    plantingDensityHa: row.planting_density_ha,
    altitudeM: row.altitude_m,
    slope: row.slope,
    notes: row.notes,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    plotId: row.plot_id,
    configId: row.config_id,
    cropPrimary: row.crop_primary,
    cropSecondary: row.crop_secondary,
    depthCm: row.depth_cm,
    cartographicUnit: row.cartographic_unit,
    lastFertilizationDate: row.last_fertilization_date,
    thresholdsVersion: row.thresholds_version,
    firmwareVersion: row.firmware_version,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    status: SESSION_STATUS.get(row.status) ?? 'expired',
  };
}

function toVariableResults(value: string): VariableResult[] {
  const items = parseList(value) as VariableResult[];

  return items.map((item) => ({
    ...item,
    variable: DIAGNOSIS_VARIABLE.get(item.variable) ?? item.variable,
    role: VARIABLE_ROLE.get(item.role) ?? 'reference',
    status: VARIABLE_STATUS.get(item.status) ?? 'reference',
    class: toAptitudeClass(item.class),
    possibleClasses: toAptitudeClasses(item.possibleClasses),
    possibleBands: toStringList(item.possibleBands),
    suitabilityInterval: toInterval(item.suitabilityInterval),
    confidence: item.confidence === null ? null : (CONFIDENCE.get(item.confidence) ?? null),
  }));
}

function toLimitingFactors(value: string): LimitingFactor[] {
  const items = parseList(value) as LimitingFactor[];

  return items.map((item) => ({
    ...item,
    class: toAptitudeClass(item.class) ?? 'N',
  }));
}

function toAlerts(value: string): DiagnosisAlert[] {
  const items = parseList(value) as DiagnosisAlert[];

  return items.map((item) => ({
    ...item,
    severity: ALERT_SEVERITY.get(item.severity) ?? 'info',
  }));
}

function toEvidence(value: string): DiagnosisEvidence {
  const parsed = parseJson(value);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      thresholdsVersion: '',
      crop: null,
      cartographicUnit: null,
      rules: [],
      assumptions: [],
      missing: [],
      sources: [],
    };
  }

  const evidence = parsed as Partial<DiagnosisEvidence>;

  return {
    thresholdsVersion:
      typeof evidence.thresholdsVersion === 'string' ? evidence.thresholdsVersion : '',
    crop: typeof evidence.crop === 'string' ? evidence.crop : null,
    cartographicUnit:
      typeof evidence.cartographicUnit === 'string' ? evidence.cartographicUnit : null,
    rules: toStringList(evidence.rules),
    assumptions: toStringList(evidence.assumptions),
    missing: toStringList(evidence.missing),
    sources: toStringList(evidence.sources),
  };
}

function toValidity(value: unknown): DiagnosisResult['validity'] {
  return typeof value === 'string'
    ? (VALIDITY.get(value) ?? 'insufficient_data')
    : 'insufficient_data';
}

function toIndex(value: unknown): DiagnosisIndex {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { minimum: 0, parametric: null };
  }

  const index = value as { minimum?: unknown; parametric?: unknown };

  return {
    minimum: typeof index.minimum === 'number' ? index.minimum : 0,
    parametric: typeof index.parametric === 'number' ? index.parametric : null,
  };
}

/**
 * Validez deducida de lo guardado, para las filas que no traen la copia reservada.
 *
 * El motor bloquea con una alerta de severidad `blocking` y no da veredicto cuando ninguna
 * variable con umbral comparable pudo compararse.
 */
function inferValidity(
  alerts: DiagnosisAlert[],
  perVariable: VariableResult[],
): DiagnosisResult['validity'] {
  if (alerts.some((alert) => alert.severity === 'blocking')) {
    return 'blocked';
  }

  const comparable = perVariable.filter(
    (variable) => variable.role === 'verdict' && variable.suitability !== null,
  );

  return comparable.length === 0 ? 'insufficient_data' : 'valid';
}

/** Índice deducido de los factores limitantes, para las filas sin la copia reservada. */
function inferIndex(limitingFactors: LimitingFactor[]): DiagnosisIndex {
  return { minimum: limitingFactors[0]?.suitability ?? 0, parametric: null };
}

/** Arma la copia del contexto con la validez y los índices del resultado. */
function toContextSnapshotJson(diagnosis: StoredDiagnosis): string {
  const meta: DiagnosisMeta = {
    validity: diagnosis.result.validity,
    index: diagnosis.result.index,
  };

  return JSON.stringify({ ...diagnosis.contextSnapshot, [RESERVED_CONTEXT_KEY]: meta });
}

/** Lee la copia del contexto y separa la parte reservada. */
function readContextSnapshot(value: string): {
  context: Record<string, unknown>;
  meta: DiagnosisMeta | null;
} {
  const parsed = parseJson(value);
  const context: Record<string, unknown> =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  const raw = context[RESERVED_CONTEXT_KEY];

  delete context[RESERVED_CONTEXT_KEY];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { context, meta: null };
  }

  const meta = raw as { validity?: unknown; index?: unknown };

  return { context, meta: { validity: toValidity(meta.validity), index: toIndex(meta.index) } };
}

function toStoredDiagnosis(row: DiagnosisRow): StoredDiagnosis {
  const { context, meta } = readContextSnapshot(row.context_snapshot_json);
  const perVariable = toVariableResults(row.variables_json);
  const alerts = toAlerts(row.alerts_json);
  const limitingFactors = toLimitingFactors(row.limiting_factors_json);

  const result: DiagnosisResult = {
    validity: meta?.validity ?? inferValidity(alerts, perVariable),
    classes: toAptitudeClasses(parseList(row.classes_json)),
    index: meta?.index ?? inferIndex(limitingFactors),
    perVariable,
    limitingFactors,
    alerts,
    evidence: toEvidence(row.evidence_json),
    versions: {
      engine: row.engine_version,
      thresholds: row.thresholds_version,
      calibration: row.calibration_version,
      firmware: row.firmware_version,
    },
    explanation: row.explanation,
  };

  return {
    id: row.id,
    measurementId: row.measurement_id,
    engineVersion: row.engine_version,
    thresholdsVersion: row.thresholds_version,
    calibrationVersion: row.calibration_version,
    firmwareVersion: row.firmware_version,
    contextSnapshot: context,
    result,
    explanation: row.explanation,
    createdAt: row.created_at,
  };
}

/** Incertidumbre por variable: la tabla la guarda aparte del resultado completo. */
function toUncertaintyRows(perVariable: readonly VariableResult[]): VariableUncertainty[] {
  return perVariable.map((variable) => ({
    variable: variable.variable,
    uncertainty: variable.uncertainty,
    suitabilityInterval: variable.suitabilityInterval,
  }));
}

const CAPTURE_COLUMNS =
  'device_id, sequence, payload_json, flags_json, captured_at_utc, received_at_utc, origin, config_id, plot_id';

const MEASUREMENT_COLUMNS =
  'id, capture_id, plot_id, payload_json, captured_at_utc, valid, invalid_reasons_json, notes, photo_path, discarded_at, created_at';

const FARM_COLUMNS = 'id, name, created_at, updated_at';

const PLOT_COLUMNS =
  'id, farm_id, name, crop_primary, crop_secondary, depth_cm, cartographic_unit, last_fertilization_date, drainage, shading, density, planting_density_ha, altitude_m, slope, notes, deleted_at, created_at, updated_at';

const SESSION_COLUMNS =
  'id, plot_id, config_id, crop_primary, crop_secondary, depth_cm, cartographic_unit, last_fertilization_date, thresholds_version, firmware_version, sent_at, accepted_at, status';

const DIAGNOSIS_COLUMNS =
  'id, measurement_id, engine_version, thresholds_version, calibration_version, firmware_version, context_snapshot_json, classes_json, limiting_factors_json, alerts_json, evidence_json, uncertainty_json, variables_json, explanation, created_at';

/** Almacenes respaldados por SQLite: fincas, lotes, sesiones, diagnósticos y ajustes. */
export interface SqliteStores extends StoreTransaction {
  readonly farms: FarmStore;
  readonly sessions: SessionStore;
  readonly diagnoses: DiagnosisStore;
  readonly settings: SettingsStore;
  readonly uow: UnitOfWork;
}

/** Almacenes respaldados por SQLite. La app real usa esta implementación. */
export function createSqliteStores(db: SqlDatabase): SqliteStores {
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

  const farms: FarmStore = {
    async insertFarm(farm) {
      await db.runAsync(`INSERT INTO farms (${FARM_COLUMNS}) VALUES (?, ?, ?, ?)`, [
        farm.id,
        farm.name,
        farm.createdAt,
        farm.updatedAt,
      ]);
    },

    async updateFarm(farm) {
      await db.runAsync('UPDATE farms SET name = ?, updated_at = ? WHERE id = ?', [
        farm.name,
        farm.updatedAt,
        farm.id,
      ]);
    },

    async getFarm(id) {
      const row = await db.getFirstAsync<FarmRow>(
        `SELECT ${FARM_COLUMNS} FROM farms WHERE id = ?`,
        [id],
      );

      return row === null ? null : toFarm(row);
    },

    async listFarms() {
      const rows = await db.getAllAsync<FarmRow>(
        `SELECT ${FARM_COLUMNS} FROM farms ORDER BY name COLLATE NOCASE, id`,
      );

      return rows.map(toFarm);
    },

    async insertPlot(plot) {
      await db.runAsync(
        `INSERT INTO plots (${PLOT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plot.id,
          plot.farmId,
          plot.name,
          plot.cropPrimary,
          plot.cropSecondary,
          plot.depthCm,
          plot.cartographicUnit,
          plot.lastFertilizationDate,
          plot.drainage,
          plot.shading,
          plot.density,
          plot.plantingDensityHa,
          plot.altitudeM,
          plot.slope,
          plot.notes,
          plot.deletedAt,
          plot.createdAt,
          plot.updatedAt,
        ],
      );
    },

    async updatePlot(plot) {
      await db.runAsync(
        `UPDATE plots SET name = ?, crop_primary = ?, crop_secondary = ?, depth_cm = ?, cartographic_unit = ?, last_fertilization_date = ?, drainage = ?, shading = ?, density = ?, planting_density_ha = ?, altitude_m = ?, slope = ?, notes = ?, deleted_at = ?, updated_at = ? WHERE id = ?`,
        [
          plot.name,
          plot.cropPrimary,
          plot.cropSecondary,
          plot.depthCm,
          plot.cartographicUnit,
          plot.lastFertilizationDate,
          plot.drainage,
          plot.shading,
          plot.density,
          plot.plantingDensityHa,
          plot.altitudeM,
          plot.slope,
          plot.notes,
          plot.deletedAt,
          plot.updatedAt,
          plot.id,
        ],
      );
    },

    async getPlot(id) {
      const row = await db.getFirstAsync<PlotRow>(
        `SELECT ${PLOT_COLUMNS} FROM plots WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );

      return row === null ? null : toPlot(row);
    },

    async listPlots(farmId) {
      const rows =
        farmId === null
          ? await db.getAllAsync<PlotRow>(
              `SELECT ${PLOT_COLUMNS} FROM plots WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, id`,
            )
          : await db.getAllAsync<PlotRow>(
              `SELECT ${PLOT_COLUMNS} FROM plots WHERE farm_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE, id`,
              [farmId],
            );

      return rows.map(toPlot);
    },
  };

  const sessions: SessionStore = {
    async insert(session) {
      await db.runAsync(
        `INSERT INTO sessions (${SESSION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.plotId,
          session.configId,
          session.cropPrimary,
          session.cropSecondary,
          session.depthCm,
          session.cartographicUnit,
          session.lastFertilizationDate,
          session.thresholdsVersion,
          session.firmwareVersion,
          session.sentAt,
          session.acceptedAt,
          session.status,
        ],
      );
    },

    async get(id) {
      const row = await db.getFirstAsync<SessionRow>(
        `SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = ?`,
        [id],
      );

      return row === null ? null : toSession(row);
    },

    async findByConfigId(configId) {
      const row = await db.getFirstAsync<SessionRow>(
        `SELECT ${SESSION_COLUMNS} FROM sessions WHERE config_id = ?`,
        [configId],
      );

      return row === null ? null : toSession(row);
    },

    async listByPlot(plotId) {
      const rows = await db.getAllAsync<SessionRow>(
        `SELECT ${SESSION_COLUMNS} FROM sessions WHERE plot_id = ? ORDER BY sent_at DESC, id DESC`,
        [plotId],
      );

      return rows.map(toSession);
    },
  };

  const diagnoses: DiagnosisStore = {
    async insert(diagnosis) {
      await db.runAsync(
        `INSERT INTO diagnoses (${DIAGNOSIS_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          diagnosis.id,
          diagnosis.measurementId,
          diagnosis.engineVersion,
          diagnosis.thresholdsVersion,
          diagnosis.calibrationVersion,
          diagnosis.firmwareVersion,
          toContextSnapshotJson(diagnosis),
          JSON.stringify(diagnosis.result.classes),
          JSON.stringify(diagnosis.result.limitingFactors),
          JSON.stringify(diagnosis.result.alerts),
          JSON.stringify(diagnosis.result.evidence),
          JSON.stringify(toUncertaintyRows(diagnosis.result.perVariable)),
          JSON.stringify(diagnosis.result.perVariable),
          diagnosis.explanation,
          diagnosis.createdAt,
        ],
      );
    },

    async get(id) {
      const row = await db.getFirstAsync<DiagnosisRow>(
        `SELECT ${DIAGNOSIS_COLUMNS} FROM diagnoses WHERE id = ?`,
        [id],
      );

      return row === null ? null : toStoredDiagnosis(row);
    },

    async listByMeasurement(measurementId) {
      const rows = await db.getAllAsync<DiagnosisRow>(
        `SELECT ${DIAGNOSIS_COLUMNS} FROM diagnoses WHERE measurement_id = ? ORDER BY created_at ASC, rowid ASC`,
        [measurementId],
      );

      return rows.map(toStoredDiagnosis);
    },
  };

  const settings: SettingsStore = {
    async get(key) {
      const row = await db.getFirstAsync<SettingRow>(
        'SELECT key, value FROM settings WHERE key = ?',
        [key],
      );

      return row === null ? null : row.value;
    },

    async set(key, value) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    },

    async list() {
      const rows = await db.getAllAsync<SettingRow>('SELECT key, value FROM settings');
      const values: Record<string, string> = {};

      for (const row of rows) {
        values[row.key] = row.value;
      }

      return values;
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

  return { captures, measurements, farms, sessions, diagnoses, settings, uow };
}
