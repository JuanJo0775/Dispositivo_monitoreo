import {
  RECORD_HEADERS,
  bitsFromFlags,
  decodeRecord,
  encodeRecord,
  flagsFromBits,
  parseRecordHeader,
  type StickRecord,
} from '@/domain/protocol/record-codec';

const REGISTRO_COMPLETO: StickRecord = {
  idRegistro: 7,
  deviceId: 'ESP32-A1B2C3',
  fecha: '2026-11-12',
  horaUtc: '14:35:07',
  lat: 4.712345,
  lon: -75.654321,
  altM: 1532.4,
  velKmh: 3.2,
  sats: 11,
  hdop: 1.2,
  edadFixS: 4,
  profCm: 20,
  configId: 3,
  cultivo: 'café',
  loteId: 'L-01',
  fertFecha: '2026-09-15',
  humedadPct: 28.4,
  tempC: 21.7,
  ph: 6.2,
  ceUsCm: 412.5,
  nMgKg: 12,
  pMgKg: 8,
  kMgKg: 145,
  banderas: 63,
  batPct: 87,
  fwVer: '0.1.0',
};

/** Sustituye una celda de una línea ya codificada, sin tocar el orden de columnas. */
function conCelda(linea: string, indice: number, valor: string): string {
  const celdas = linea.split(',');
  celdas[indice] = valor;
  return celdas.join(',');
}

describe('RECORD_HEADERS', () => {
  it('publica las columnas del contrato en orden', () => {
    expect(RECORD_HEADERS.join(',')).toBe(
      'id_registro,device_id,fecha,hora_utc,lat,lon,alt_m,vel_kmh,sats,hdop,edad_fix_s,' +
        'prof_cm,config_id,cultivo,lote_id,fert_fecha,humedad_pct,temp_c,ph,ce_uscm,n_mgkg,' +
        'p_mgkg,k_mgkg,banderas,bat_pct,fw_ver',
    );
  });
});

describe('encodeRecord', () => {
  it('ida y vuelta de un registro completo', () => {
    const linea = encodeRecord(REGISTRO_COMPLETO);

    expect(linea.split(',')).toHaveLength(RECORD_HEADERS.length);
    expect(decodeRecord(linea)).toEqual(REGISTRO_COMPLETO);
  });

  it('escribe los números con punto decimal', () => {
    const linea = encodeRecord(REGISTRO_COMPLETO);

    expect(linea).toContain('4.712345');
    expect(linea).toContain('-75.654321');
    expect(linea).not.toContain('4,712345');
  });

  it('deja vacío un dato ausente y lo devuelve como null, nunca como cero', () => {
    const registro: StickRecord = {
      ...REGISTRO_COMPLETO,
      lat: null,
      lon: null,
      ph: null,
      ceUsCm: null,
      nMgKg: null,
      pMgKg: null,
      kMgKg: null,
      fertFecha: null,
    };

    const linea = encodeRecord(registro);
    const celdas = linea.split(',');

    expect(celdas[4]).toBe('');
    expect(celdas[18]).toBe('');
    expect(celdas[15]).toBe('');

    const vuelto = decodeRecord(linea);
    expect(vuelto.lat).toBeNull();
    expect(vuelto.lon).toBeNull();
    expect(vuelto.ph).toBeNull();
    expect(vuelto.ceUsCm).toBeNull();
    expect(vuelto.nMgKg).toBeNull();
    expect(vuelto.pMgKg).toBeNull();
    expect(vuelto.kMgKg).toBeNull();
    expect(vuelto.fertFecha).toBeNull();
    expect(vuelto.humedadPct).toBe(28.4);
  });

  it('no escribe ceros por defecto en un registro sin datos', () => {
    const registro: StickRecord = {
      idRegistro: 1,
      deviceId: null,
      fecha: null,
      horaUtc: null,
      lat: null,
      lon: null,
      altM: null,
      velKmh: null,
      sats: null,
      hdop: null,
      edadFixS: null,
      profCm: null,
      configId: null,
      cultivo: null,
      loteId: null,
      fertFecha: null,
      humedadPct: null,
      tempC: null,
      ph: null,
      ceUsCm: null,
      nMgKg: null,
      pMgKg: null,
      kMgKg: null,
      banderas: null,
      batPct: null,
      fwVer: null,
    };

    const linea = encodeRecord(registro);

    expect(linea).not.toContain('0');
    expect(linea.split(',')).toHaveLength(RECORD_HEADERS.length);
    expect(decodeRecord(linea)).toEqual(registro);
  });
});

describe('banderas', () => {
  it('convierte los bits del contrato en banderas', () => {
    const flags = flagsFromBits(63);

    expect(flags.positionValid).toBe(true);
    expect(flags.recentFix).toBe(true);
    expect(flags.probeOk).toBe(true);
    expect(flags.ecOverThreshold).toBe(true);
    expect(flags.timeValid).toBe(true);
    expect(flags.simulated).toBe(true);
  });

  it('convierte las banderas en los bits del contrato', () => {
    const bits = bitsFromFlags({
      positionValid: true,
      recentFix: true,
      probeOk: true,
      ecOverThreshold: true,
      timeValid: true,
      simulated: true,
    });

    expect(bits).toBe(63);
  });

  it('deja en falso las banderas cuyo bit no está', () => {
    const flags = flagsFromBits(0);

    expect(flags.positionValid).toBe(false);
    expect(flags.recentFix).toBe(false);
    expect(flags.probeOk).toBe(false);
    expect(flags.ecOverThreshold).toBe(false);
    expect(flags.timeValid).toBe(false);
    expect(flags.simulated).toBe(false);
  });

  it('lleva el bit b5 del dato simulado en las dos direcciones', () => {
    const flags = flagsFromBits(32);

    expect(flags.simulated).toBe(true);
    expect(flags.positionValid).toBe(false);
    expect(flags.probeOk).toBe(false);

    expect(
      bitsFromFlags({
        positionValid: false,
        recentFix: false,
        probeOk: false,
        ecOverThreshold: false,
        timeValid: false,
        simulated: true,
      }),
    ).toBe(32);
  });
});

describe('decodeRecord', () => {
  it('conserva el valor exacto de un número con coma decimal', () => {
    const linea = conCelda(encodeRecord(REGISTRO_COMPLETO), 16, '"12,5"');

    const registro = decodeRecord(linea);

    expect(registro.humedadPct).toBe(12.5);
    expect(decodeRecord(encodeRecord(registro)).humedadPct).toBe(12.5);
  });

  it('escapa y recupera un texto con coma', () => {
    const registro: StickRecord = { ...REGISTRO_COMPLETO, loteId: 'Lote A, lote B' };

    const linea = encodeRecord(registro);

    expect(linea).toContain('"Lote A, lote B"');
    expect(decodeRecord(linea).loteId).toBe('Lote A, lote B');
  });

  it('escapa y recupera un texto con comillas', () => {
    const registro: StickRecord = { ...REGISTRO_COMPLETO, cultivo: 'café "especial"' };

    const linea = encodeRecord(registro);

    expect(linea).toContain('"café ""especial"""');
    expect(decodeRecord(linea).cultivo).toBe('café "especial"');
  });

  it('rechaza una línea con columnas de menos, en español', () => {
    expect(() => decodeRecord('7,ESP32-A1B2C3,2026-11-12')).toThrow(
      'La línea del registro tiene 3 columnas y el contrato exige 26.',
    );
  });

  it('rechaza una línea de encabezados', () => {
    expect(() => decodeRecord(RECORD_HEADERS.join(','))).toThrow(
      'La línea de encabezados no es un registro de datos.',
    );
  });

  it('rechaza un texto que no es número', () => {
    const linea = conCelda(encodeRecord(REGISTRO_COMPLETO), 18, 'no aplica');

    expect(() => decodeRecord(linea)).toThrow(
      'El valor "no aplica" de la columna "ph" no es un número válido.',
    );
  });
});

describe('parseRecordHeader', () => {
  it('lee un CSV con encabezado y dos registros, y salta las líneas vacías', () => {
    const csv = [
      RECORD_HEADERS.join(','),
      encodeRecord(REGISTRO_COMPLETO),
      '',
      encodeRecord({ ...REGISTRO_COMPLETO, idRegistro: 8, loteId: 'L-02' }),
      '',
    ].join('\n');

    const registros = parseRecordHeader(csv);

    expect(registros).toHaveLength(2);
    expect(registros[0]).toEqual(REGISTRO_COMPLETO);
    expect(registros[1]?.idRegistro).toBe(8);
    expect(registros[1]?.loteId).toBe('L-02');
  });

  it('devuelve vacío cuando el archivo no tiene registros', () => {
    expect(parseRecordHeader(`${RECORD_HEADERS.join(',')}\n`)).toEqual([]);
  });

  it('rechaza un encabezado que no es el del contrato, en español', () => {
    expect(() => parseRecordHeader('id_registro,device_id\n7,ESP32-A1B2C3\n')).toThrow(
      /El encabezado del CSV no coincide con el contrato del registro/,
    );
  });

  it('propaga el error de una línea con columnas de menos', () => {
    const csv = [RECORD_HEADERS.join(','), '7,ESP32-A1B2C3,2026-11-12'].join('\n');

    expect(() => parseRecordHeader(csv)).toThrow(
      'La línea del registro tiene 3 columnas y el contrato exige 26.',
    );
  });
});
