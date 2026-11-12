import { CSV_HEADER, toCsv } from '@/application/export/export-csv';

import { makeMeasurement } from '../../helpers/measurements';

describe('toCsv', () => {
  it('empieza con los encabezados estables del contrato', () => {
    const csv = toCsv([makeMeasurement()], 'th-1', 'factory-v1');
    const firstLine = csv.replace('\uFEFF', '').split('\n')[0];

    expect(firstLine).toBe(CSV_HEADER.join(','));
    expect(CSV_HEADER).toContain('humedad_pct');
    expect(CSV_HEADER).toContain('umbrales_version');
    expect(CSV_HEADER).toContain('calibracion_version');
  });

  it('incluye las versiones usadas en cada fila', () => {
    const csv = toCsv([makeMeasurement()], 'th-1', 'factory-v1');

    expect(csv).toContain('th-1');
    expect(csv).toContain('factory-v1');
  });

  it('exporta un valor nulo como celda vacía, nunca como 0', () => {
    const csv = toCsv([makeMeasurement({ humidityPct: null })], 'th-1', 'factory-v1');
    const rows = csv.replace('\uFEFF', '').split('\n');
    const cells = rows[1]?.split(',');

    expect(cells?.[CSV_HEADER.indexOf('humedad_pct')]).toBe('');
  });

  it('usa UTF-8 con BOM y salto de línea LF', () => {
    const csv = toCsv([makeMeasurement()], 'th-1', 'factory-v1');

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).not.toContain('\r\n');
  });

  it('exporta la fecha en UTC ISO', () => {
    const csv = toCsv(
      [makeMeasurement({}, { capturedAtUtc: '2026-11-12T17:05:00Z' })],
      'th-1',
      'factory-v1',
    );

    expect(csv).toContain('2026-11-12T17:05:00Z');
  });

  it('separa device_id e id_registro desde la clave de la captura', () => {
    const csv = toCsv([makeMeasurement({}, { captureId: 'stick-01:42' })], 'th-1', 'factory-v1');
    const cells = csv.replace('\uFEFF', '').split('\n')[1]?.split(',');

    expect(cells?.[CSV_HEADER.indexOf('device_id')]).toBe('stick-01');
    expect(cells?.[CSV_HEADER.indexOf('id_registro')]).toBe('42');
  });

  it('escapa comas y comillas dentro de un campo', () => {
    const csv = toCsv(
      [makeMeasurement({}, { notes: 'suelo compacto, "duro"' })],
      'th-1',
      'factory-v1',
    );

    expect(csv).toContain('"suelo compacto, ""duro"""');
  });

  it('exporta solo el encabezado cuando no hay mediciones', () => {
    const csv = toCsv([], 'th-1', 'factory-v1');

    expect(csv.replace('\uFEFF', '').split('\n')).toHaveLength(1);
  });
});
