import type { CaptureFlags, CapturePayload, RawCapture, ValidationResult } from './types';

/** Campos numéricos del payload, para no comparar cadenas por error. */
type NumericPayloadField = {
  [K in keyof CapturePayload]: CapturePayload[K] extends number | null ? K : never;
}[keyof CapturePayload];

/**
 * Rangos físicos admitidos por el contrato ESP32 ↔ App v0.1.
 *
 * `max: null` significa sin techo publicado (solo se exige que no sea negativo).
 * El nombre del campo define el código del motivo: `humidity_out_of_range`.
 */
const RANGES: ReadonlyArray<{
  field: NumericPayloadField;
  code: string;
  min: number;
  max: number | null;
}> = [
  { field: 'humidityPct', code: 'humidity', min: 0, max: 100 },
  { field: 'temperatureC', code: 'temperature', min: -10, max: 60 },
  { field: 'ph', code: 'ph', min: 0, max: 14 },
  { field: 'ecUsCm', code: 'ec', min: 0, max: 20000 },
  { field: 'nMgKg', code: 'n', min: 0, max: null },
  { field: 'pMgKg', code: 'p', min: 0, max: null },
  { field: 'kMgKg', code: 'k', min: 0, max: null },
  { field: 'batteryPct', code: 'battery', min: 0, max: 100 },
];

/** Variables del suelo cuyo valor ausente se reporta explícitamente. */
const REPORTED_WHEN_MISSING = new Set<string>([
  'humidityPct',
  'temperatureC',
  'ph',
  'ecUsCm',
  'nMgKg',
  'pMgKg',
  'kMgKg',
]);

/**
 * Valida una captura sin descartarla.
 *
 * Una captura inválida se guarda igual: el requisito es excluirla de los
 * cálculos, no borrarla. Los valores nulos no invalidan; se reportan como
 * `<variable>_missing` para que la UI muestre «sin dato» en vez de cero.
 */
export function validateCapture(capture: RawCapture): ValidationResult {
  const reasons: string[] = [];
  const { payload, flags } = capture;

  for (const range of RANGES) {
    const value = payload[range.field];

    if (value === null) {
      if (REPORTED_WHEN_MISSING.has(range.field)) {
        reasons.push(`${range.code}_missing`);
      }
      continue;
    }

    const belowMin = value < range.min;
    const aboveMax = range.max !== null && value > range.max;

    if (belowMin || aboveMax) {
      reasons.push(`${range.code}_out_of_range`);
    }
  }

  if (!flags.probeOk) {
    reasons.push('probe_fault');
  }

  if (flags.simulated) {
    reasons.push('simulated_data');
  }

  if (!flags.timeValid) {
    reasons.push('time_unverified');
  }

  if (!flags.recentFix) {
    reasons.push('stale_fix');
  }

  if (flags.ecOverThreshold) {
    reasons.push('ec_interlock');
  }

  const invalidating = reasons.some(
    (reason) =>
      reason.endsWith('_out_of_range') || reason === 'probe_fault' || reason === 'simulated_data',
  );

  return { valid: !invalidating, reasons };
}

/**
 * Una posición es utilizable solo si la bandera lo dice y las coordenadas
 * existen y no son exactamente 0,0 (el valor que reporta un GPS sin fix).
 */
export function isPositionValid(payload: CapturePayload, flags: CaptureFlags): boolean {
  if (!flags.positionValid) {
    return false;
  }

  if (payload.latitude === null || payload.longitude === null) {
    return false;
  }

  return !(payload.latitude === 0 && payload.longitude === 0);
}
