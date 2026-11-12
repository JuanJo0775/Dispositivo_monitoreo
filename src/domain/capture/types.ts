/** De dónde salió una captura. */
export type CaptureOrigin = 'stick' | 'manual' | 'import';

/**
 * Una lectura cruda del bastón, tal como viaja en el contrato ESP32 ↔ App v0.1.
 *
 * Todos los campos son `number | null` (o `string | null`): un dato ausente se
 * guarda como `null`, nunca como `0` ni como cadena vacía.
 */
export interface CapturePayload {
  /** Latitud en grados decimales (contrato: `lat`). */
  readonly latitude: number | null;
  /** Longitud en grados decimales (contrato: `lon`). */
  readonly longitude: number | null;
  /** Altitud en metros (contrato: `alt_m`). */
  readonly altitudeM: number | null;
  /** Velocidad en km/h (contrato: `vel_kmh`). */
  readonly speedKmh: number | null;
  /** Satélites visibles (contrato: `sats`). */
  readonly satellites: number | null;
  /** Dilución horizontal de precisión (contrato: `hdop`). */
  readonly hdop: number | null;
  /** Edad del último fix en segundos (contrato: `edad_fix_s`). */
  readonly fixAgeS: number | null;
  /** Profundidad de captura en cm (contrato: `prof_cm`). */
  readonly depthCm: number | null;
  /** Código corto del cultivo declarado en la sesión (contrato: `cultivo`). */
  readonly cropCode: string | null;
  /** Código corto del lote declarado en la sesión (contrato: `lote_id`). */
  readonly plotCode: string | null;
  /** Última fertilización declarada, AAAA-MM-DD (contrato: `fert_fecha`). */
  readonly lastFertilizationDate: string | null;
  /** Humedad del suelo en % v/v (contrato: `humedad_pct`). */
  readonly humidityPct: number | null;
  /** Temperatura en °C (contrato: `temp_c`). */
  readonly temperatureC: number | null;
  /** pH adimensional (contrato: `ph`). */
  readonly ph: number | null;
  /** Conductividad eléctrica en µS/cm (contrato: `ce_uscm`). */
  readonly ecUsCm: number | null;
  /** Nitrógeno del sensor en mg/kg; solo trazabilidad (contrato: `n_mgkg`). */
  readonly nMgKg: number | null;
  /** Fósforo en mg/kg (contrato: `p_mgkg`). */
  readonly pMgKg: number | null;
  /** Potasio en mg/kg (contrato: `k_mgkg`). */
  readonly kMgKg: number | null;
  /** Batería del bastón en % (contrato: `bat_pct`). */
  readonly batteryPct: number | null;
  /** Versión de firmware del bastón (contrato: `fw_ver`). */
  readonly firmwareVersion: string | null;
}

/**
 * Banderas del registro de captura (contrato: campo `banderas`, bits b0–b5).
 *
 * Un valor en `false` no pierde el dato: lo marca como no confiable.
 */
export interface CaptureFlags {
  /** b0: la posición del GPS es válida. */
  readonly positionValid: boolean;
  /** b1: el fix del GPS es reciente. */
  readonly recentFix: boolean;
  /** b2: la sonda respondió correctamente. */
  readonly probeOk: boolean;
  /** b3: la CE supera el umbral y N, P, K no son confiables. */
  readonly ecOverThreshold: boolean;
  /** b4: la hora del bastón es válida. */
  readonly timeValid: boolean;
  /** b5: dato simulado o de ensayo, no productivo. */
  readonly simulated: boolean;
}

/** Registro inmutable que llega del bastón o de una importación. */
export interface RawCapture {
  readonly deviceId: string;
  readonly sequence: number;
  readonly payload: CapturePayload;
  /** Instante de captura en UTC, ISO 8601. */
  readonly capturedAtUtc: string;
  /** Instante de recepción en la app, ISO 8601. */
  readonly receivedAtUtc: string;
  readonly origin: CaptureOrigin;
  readonly flags: CaptureFlags;
  /** Configuración de sesión activa en el bastón; 0 = sin configurar. */
  readonly configId: number;
  /** Lote asignado; `null` mientras la captura no tenga configuración. */
  readonly plotId: string | null;
}

/** Resultado de validar una captura contra los rangos del contrato. */
export interface CaptureValidationResult {
  readonly valid: boolean;
  readonly reasons: readonly string[];
}
