import type { Measurement } from '@/domain/measurement/types';

/** Columnas del CSV. Se mantienen estables: cambiarlas rompe análisis externos. */
export const CSV_HEADER = [
  'id_medicion',
  'device_id',
  'id_registro',
  'fecha_utc',
  'lat',
  'lon',
  'alt_m',
  'vel_kmh',
  'sats',
  'hdop',
  'edad_fix_s',
  'prof_cm',
  'cultivo',
  'fert_fecha',
  'humedad_pct',
  'temp_c',
  'ph',
  'ce_uscm',
  'n_mgkg',
  'p_mgkg',
  'k_mgkg',
  'bat_pct',
  'valido',
  'motivos_invalidez',
  'notas',
  'umbrales_version',
  'calibracion_version',
] as const;

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | null): string {
  if (value === null) {
    return '';
  }
  return escapeCell(String(value));
}

function splitCaptureId(captureId: string): { deviceId: string; sequence: string } {
  const separator = captureId.lastIndexOf(':');

  if (separator === -1) {
    return { deviceId: captureId, sequence: '' };
  }

  return {
    deviceId: captureId.slice(0, separator),
    sequence: captureId.slice(separator + 1),
  };
}

/**
 * Convierte mediciones en CSV UTF-8 con BOM y saltos LF.
 *
 * Reglas: un nulo es celda vacía (nunca 0), los acentos se conservan y cada
 * fila lleva las versiones de umbrales y calibración que produjeron el dato.
 */
export function toCsv(
  measurements: readonly Measurement[],
  thresholdsVersion: string,
  calibrationVersion: string,
): string {
  const lines = [CSV_HEADER.join(',')];

  for (const measurement of measurements) {
    const { deviceId, sequence } = splitCaptureId(measurement.captureId);
    const { payload } = measurement;

    const row = [
      cell(measurement.id),
      cell(deviceId),
      cell(sequence),
      cell(measurement.capturedAtUtc),
      cell(payload.latitude),
      cell(payload.longitude),
      cell(payload.altitudeM),
      cell(payload.speedKmh),
      cell(payload.satellites),
      cell(payload.hdop),
      cell(payload.fixAgeS),
      cell(payload.depthCm),
      cell(payload.cropCode),
      cell(payload.lastFertilizationDate),
      cell(payload.humidityPct),
      cell(payload.temperatureC),
      cell(payload.ph),
      cell(payload.ecUsCm),
      cell(payload.nMgKg),
      cell(payload.pMgKg),
      cell(payload.kMgKg),
      cell(payload.batteryPct),
      cell(measurement.valid ? 'si' : 'no'),
      cell(measurement.invalidReasons.join('|')),
      cell(measurement.notes),
      cell(thresholdsVersion),
      cell(calibrationVersion),
    ];

    lines.push(row.join(','));
  }

  return `\uFEFF${lines.join('\n')}`;
}
