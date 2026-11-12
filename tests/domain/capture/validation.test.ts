import { isPositionValid, validateCapture } from '@/domain/capture/validation';

import { makeCapture } from '../../helpers/captures';

describe('validateCapture', () => {
  it('acepta una captura completa y en rango', () => {
    const result = validateCapture(makeCapture());

    expect(result.valid).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('marca humedad fuera de 0..100 sin borrar el registro', () => {
    const result = validateCapture(makeCapture({ humidityPct: 140 }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('humidity_out_of_range');
  });

  it('acepta valores nulos y los reporta como ausentes, no como cero', () => {
    const result = validateCapture(makeCapture({ ph: null }));

    expect(result.valid).toBe(true);
    expect(result.reasons).toContain('ph_missing');
  });

  it('invalida una captura de ensayo para diagnóstico productivo', () => {
    const result = validateCapture(makeCapture({}, { simulated: true }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('simulated_data');
  });

  it('invalida cuando la sonda reporta falla, aunque los valores parezcan normales', () => {
    const result = validateCapture(makeCapture({}, { probeOk: false }));

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('probe_fault');
  });

  it('acumula todos los motivos de invalidez', () => {
    const result = validateCapture(
      makeCapture({ humidityPct: -1, ph: 15, ecUsCm: 99999 }, { probeOk: false }),
    );

    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'humidity_out_of_range',
        'ph_out_of_range',
        'ec_out_of_range',
        'probe_fault',
      ]),
    );
  });
});

describe('isPositionValid', () => {
  it('rechaza 0,0 aunque la bandera diga válida', () => {
    const capture = makeCapture({ latitude: 0, longitude: 0 });

    expect(isPositionValid(capture.payload, capture.flags)).toBe(false);
  });

  it('rechaza una posición con la bandera en falso', () => {
    const capture = makeCapture({}, { positionValid: false });

    expect(isPositionValid(capture.payload, capture.flags)).toBe(false);
  });

  it('rechaza coordenadas nulas', () => {
    const capture = makeCapture({ latitude: null, longitude: null });

    expect(isPositionValid(capture.payload, capture.flags)).toBe(false);
  });

  it('acepta una posición válida dentro de rango', () => {
    const capture = makeCapture();

    expect(isPositionValid(capture.payload, capture.flags)).toBe(true);
  });
});
