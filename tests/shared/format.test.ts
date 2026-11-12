import {
  formatDateTimeLocal,
  formatMeasure,
  formatNumber,
  MISSING_VALUE_TEXT,
} from '@/shared/format';

describe('formatNumber', () => {
  it('usa coma decimal y punto de miles', () => {
    expect(formatNumber(1234.5)).toBe('1.234,5');
  });

  it('no agrega decimales innecesarios', () => {
    expect(formatNumber(38)).toBe('38');
  });
});

describe('formatMeasure', () => {
  it('agrega la unidad', () => {
    expect(formatMeasure(38, '% v/v')).toBe('38 % v/v');
  });

  it('muestra «sin dato» cuando el valor es nulo', () => {
    expect(formatMeasure(null, '% v/v')).toBe(MISSING_VALUE_TEXT);
  });

  it('no muestra cero para un dato ausente', () => {
    expect(formatMeasure(null, '°C')).not.toContain('0');
  });
});

describe('formatDateTimeLocal', () => {
  it('convierte UTC a hora de Colombia (UTC−5)', () => {
    expect(formatDateTimeLocal('2026-11-12T17:05:00Z')).toBe('12/11/2026, 12:05');
  });

  it('cruza de día cuando corresponde', () => {
    expect(formatDateTimeLocal('2026-11-13T02:30:00Z')).toBe('12/11/2026, 21:30');
  });
});
