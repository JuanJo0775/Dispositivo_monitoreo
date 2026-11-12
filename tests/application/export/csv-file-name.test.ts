import { buildCsvFileName } from '@/application/export/csv-file-name';

describe('buildCsvFileName', () => {
  it('arma el nombre con fecha y hora en UTC', () => {
    expect(buildCsvFileName(new Date('2026-11-12T17:05:00Z'))).toBe('mediciones-20261112-1705.csv');
  });

  it('rellena con cero el mes, el día, la hora y el minuto', () => {
    expect(buildCsvFileName(new Date('2027-01-02T03:04:00Z'))).toBe('mediciones-20270102-0304.csv');
  });

  it('termina en .csv y no incluye dos puntos, que rompen el nombre en Android', () => {
    const name = buildCsvFileName(new Date('2026-11-12T17:05:00Z'));

    expect(name.endsWith('.csv')).toBe(true);
    expect(name).not.toContain(':');
  });

  it('no cambia el nombre dentro del mismo minuto', () => {
    const first = buildCsvFileName(new Date('2026-11-12T17:05:10Z'));
    const second = buildCsvFileName(new Date('2026-11-12T17:05:59Z'));

    expect(first).toBe(second);
  });

  it('cambia el nombre al pasar al siguiente minuto', () => {
    const first = buildCsvFileName(new Date('2026-11-12T17:05:59Z'));
    const second = buildCsvFileName(new Date('2026-11-12T17:06:00Z'));

    expect(first).not.toBe(second);
  });
});
