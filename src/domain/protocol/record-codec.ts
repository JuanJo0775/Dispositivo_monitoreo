import type { CaptureFlags } from '@/domain/capture/types';

/**
 * Encabezados del registro de captura del contrato ESP32 ↔ App v0.1.
 *
 * El orden es parte del contrato: el archivo de la microSD y el mensaje BLE
 * usan exactamente estas columnas, en este orden.
 */
export const RECORD_HEADERS = [
  'id_registro',
  'device_id',
  'fecha',
  'hora_utc',
  'lat',
  'lon',
  'alt_m',
  'vel_kmh',
  'sats',
  'hdop',
  'edad_fix_s',
  'prof_cm',
  'config_id',
  'cultivo',
  'lote_id',
  'fert_fecha',
  'humedad_pct',
  'temp_c',
  'ph',
  'ce_uscm',
  'n_mgkg',
  'p_mgkg',
  'k_mgkg',
  'banderas',
  'bat_pct',
  'fw_ver',
] as const;

/**
 * Un registro de captura tal como viaja en el contrato: una línea CSV con
 * los encabezados de `RECORD_HEADERS`.
 *
 * Un dato sin valor es `null` y se escribe como celda vacía. Nunca se
 * inventa un valor por defecto (regla del contrato).
 */
export interface StickRecord {
  idRegistro: number | null;
  deviceId: string | null;
  fecha: string | null;
  horaUtc: string | null;
  lat: number | null;
  lon: number | null;
  altM: number | null;
  velKmh: number | null;
  sats: number | null;
  hdop: number | null;
  edadFixS: number | null;
  profCm: number | null;
  configId: number | null;
  cultivo: string | null;
  loteId: string | null;
  fertFecha: string | null;
  humedadPct: number | null;
  tempC: number | null;
  ph: number | null;
  ceUsCm: number | null;
  nMgKg: number | null;
  pMgKg: number | null;
  kMgKg: number | null;
  banderas: number | null;
  batPct: number | null;
  fwVer: string | null;
}

/** Bits de las banderas del contrato: b0 a b5. */
const FLAG_BITS = {
  positionValid: 1 << 0,
  recentFix: 1 << 1,
  probeOk: 1 << 2,
  ecOverThreshold: 1 << 3,
  timeValid: 1 << 4,
  simulated: 1 << 5,
} as const;

/** Encabezado de una columna, para los mensajes de error. */
function headerAt(index: number): string {
  return RECORD_HEADERS[index] ?? `columna ${index + 1}`;
}

/**
 * Escapa una celda según RFC 4180: si trae coma, comilla o salto de línea,
 * va entre comillas dobles y sus comillas internas se duplican.
 */
function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/** Escribe una celda: `null` es celda vacía y los números van con punto decimal. */
function encodeCell(value: number | string | null, index: number): string {
  if (value === null) {
    return '';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(
        `La columna "${headerAt(index)}" no puede llevar el valor ${value}: no es un número finito.`,
      );
    }

    return String(value);
  }

  return escapeCell(value);
}

/**
 * Convierte un registro en su línea CSV, sin salto de línea final.
 *
 * Los números se escriben con punto decimal (así es el archivo de la
 * microSD) y un dato ausente es una celda vacía, nunca `0`.
 */
export function encodeRecord(record: StickRecord): string {
  const values: readonly (number | string | null)[] = [
    record.idRegistro,
    record.deviceId,
    record.fecha,
    record.horaUtc,
    record.lat,
    record.lon,
    record.altM,
    record.velKmh,
    record.sats,
    record.hdop,
    record.edadFixS,
    record.profCm,
    record.configId,
    record.cultivo,
    record.loteId,
    record.fertFecha,
    record.humedadPct,
    record.tempC,
    record.ph,
    record.ceUsCm,
    record.nMgKg,
    record.pMgKg,
    record.kMgKg,
    record.banderas,
    record.batPct,
    record.fwVer,
  ];

  return values.map((value, index) => encodeCell(value, index)).join(',');
}

/** Lee una celda de texto: vacía o solo con espacios es un dato ausente. */
function textCell(cell: string | undefined): string | null {
  if (cell === undefined || cell.trim() === '') {
    return null;
  }

  return cell;
}

/**
 * Lee una celda numérica.
 *
 * Acepta la coma decimal (algunos Lectores de la microSD la usan) y la
 * convierte a punto; el valor se conserva exacto. Un texto que no es número
 * es un error: el archivo del bastón no debería traerlo.
 */
function numberCell(cell: string | undefined, index: number): number | null {
  const text = textCell(cell);

  if (text === null) {
    return null;
  }

  const normalized = text.trim().replace(',', '.');

  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(normalized)) {
    throw new Error(
      `El valor "${text}" de la columna "${headerAt(index)}" no es un número válido.`,
    );
  }

  return Number(normalized);
}

/** Construye el registro a partir de las celdas, en el orden del contrato. */
function decodeCells(cells: readonly string[]): StickRecord {
  if (cells.length !== RECORD_HEADERS.length) {
    throw new Error(
      `La línea del registro tiene ${cells.length} columnas y el contrato exige ${RECORD_HEADERS.length}.`,
    );
  }

  if ((cells[0] ?? '').trim() === RECORD_HEADERS[0]) {
    throw new Error('La línea de encabezados no es un registro de datos.');
  }

  return {
    idRegistro: numberCell(cells[0], 0),
    deviceId: textCell(cells[1]),
    fecha: textCell(cells[2]),
    horaUtc: textCell(cells[3]),
    lat: numberCell(cells[4], 4),
    lon: numberCell(cells[5], 5),
    altM: numberCell(cells[6], 6),
    velKmh: numberCell(cells[7], 7),
    sats: numberCell(cells[8], 8),
    hdop: numberCell(cells[9], 9),
    edadFixS: numberCell(cells[10], 10),
    profCm: numberCell(cells[11], 11),
    configId: numberCell(cells[12], 12),
    cultivo: textCell(cells[13]),
    loteId: textCell(cells[14]),
    fertFecha: textCell(cells[15]),
    humedadPct: numberCell(cells[16], 16),
    tempC: numberCell(cells[17], 17),
    ph: numberCell(cells[18], 18),
    ceUsCm: numberCell(cells[19], 19),
    nMgKg: numberCell(cells[20], 20),
    pMgKg: numberCell(cells[21], 21),
    kMgKg: numberCell(cells[22], 22),
    banderas: numberCell(cells[23], 23),
    batPct: numberCell(cells[24], 24),
    fwVer: textCell(cells[25]),
  };
}

/**
 * Convierte una línea CSV de datos en un registro.
 *
 * La línea se lee con el orden de `RECORD_HEADERS`; no se espera la línea de
 * encabezados. Falla, en español, si la línea no tiene el número de columnas
 * del contrato.
 */
export function decodeRecord(line: string): StickRecord {
  return decodeCells(parseCsvLine(line));
}

/**
 * Parte un texto CSV en registros de celdas (RFC 4180).
 *
 * Respeta las comillas: una coma dentro de una celda entrecomillada no
 * separa columnas y una comilla interna se recupera como comilla simple.
 */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let cells: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  while (index < text.length) {
    const char = text.charAt(index);

    if (quoted) {
      if (char === '"') {
        if (text.charAt(index + 1) === '"') {
          field += '"';
          index += 2;
          continue;
        }

        quoted = false;
        index += 1;
        continue;
      }

      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }

    if (char === ',') {
      cells.push(field);
      field = '';
      index += 1;
      continue;
    }

    if (char === '\n' || char === '\r') {
      cells.push(field);
      records.push(cells);
      cells = [];
      field = '';
      index += char === '\r' && text.charAt(index + 1) === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field !== '' || cells.length > 0) {
    cells.push(field);
    records.push(cells);
  }

  return records;
}

/** Parte una sola línea CSV de datos. */
function parseCsvLine(line: string): string[] {
  const records = parseCsvRecords(line);
  const first = records[0];

  if (first === undefined) {
    throw new Error('La línea del registro está vacía.');
  }

  if (records.length > 1) {
    throw new Error('La línea del registro trae saltos de línea dentro de las celdas.');
  }

  return first;
}

/** Una fila totalmente vacía es una línea en blanco del archivo. */
function isBlankRow(cells: readonly string[]): boolean {
  return cells.every((cell) => cell.trim() === '');
}

/**
 * Lee un CSV con encabezado y devuelve sus registros.
 *
 * La primera línea debe ser el encabezado del contrato; las líneas vacías se
 * saltan. Si el encabezado no es el del contrato, falla en español.
 */
export function parseRecordHeader(contents: string): StickRecord[] {
  const rows = parseCsvRecords(contents.replace(/^\uFEFF/, '')).filter(
    (cells) => !isBlankRow(cells),
  );
  const [header, ...data] = rows;

  if (header === undefined) {
    return [];
  }

  const expected = RECORD_HEADERS.join(',');

  if (header.map((cell) => cell.trim()).join(',') !== expected) {
    throw new Error(
      `El encabezado del CSV no coincide con el contrato del registro: se esperaba "${expected}".`,
    );
  }

  return data.map((cells) => decodeCells(cells));
}

/**
 * Convierte los bits de las banderas del contrato en banderas legibles.
 *
 * b0 posición válida, b1 fix reciente, b2 sonda OK, b3 CE sobre umbral,
 * b4 hora válida, b5 dato simulado.
 */
export function flagsFromBits(bits: number): CaptureFlags {
  const value = Number.isFinite(bits) ? Math.trunc(bits) : 0;

  return {
    positionValid: (value & FLAG_BITS.positionValid) !== 0,
    recentFix: (value & FLAG_BITS.recentFix) !== 0,
    probeOk: (value & FLAG_BITS.probeOk) !== 0,
    ecOverThreshold: (value & FLAG_BITS.ecOverThreshold) !== 0,
    timeValid: (value & FLAG_BITS.timeValid) !== 0,
    simulated: (value & FLAG_BITS.simulated) !== 0,
  };
}

/** Convierte las banderas legibles en los bits que van en la columna `banderas`. */
export function bitsFromFlags(flags: CaptureFlags): number {
  let bits = 0;

  if (flags.positionValid) {
    bits |= FLAG_BITS.positionValid;
  }

  if (flags.recentFix) {
    bits |= FLAG_BITS.recentFix;
  }

  if (flags.probeOk) {
    bits |= FLAG_BITS.probeOk;
  }

  if (flags.ecOverThreshold) {
    bits |= FLAG_BITS.ecOverThreshold;
  }

  if (flags.timeValid) {
    bits |= FLAG_BITS.timeValid;
  }

  if (flags.simulated) {
    bits |= FLAG_BITS.simulated;
  }

  return bits;
}
