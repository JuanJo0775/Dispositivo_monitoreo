import type { CapturePayload } from '@/domain/capture/types';
import { ACCEPTABLE_HDOP_MAX, GOOD_HDOP_MAX, readPosition } from '@/domain/geo/position';

/** Payload del bastón con todos los campos; cada prueba cambia solo lo que le importa. */
function payload(overrides: Partial<CapturePayload> = {}): CapturePayload {
  return {
    latitude: -34.6,
    longitude: -58.4,
    altitudeM: 12,
    speedKmh: 0,
    satellites: 9,
    hdop: 1.5,
    fixAgeS: 2,
    depthCm: 20,
    cropCode: null,
    plotCode: null,
    lastFertilizationDate: null,
    humidityPct: null,
    temperatureC: null,
    ph: null,
    ecUsCm: null,
    nMgKg: null,
    pMgKg: null,
    kMgKg: null,
    batteryPct: 87,
    firmwareVersion: '0.1.0',
    ...overrides,
  };
}

describe('readPosition', () => {
  it('con la bandera en true y HDOP 1,5 la calidad es buena', () => {
    const posicion = readPosition(payload({ hdop: 1.5 }), true);

    expect(posicion.quality).toBe('buena');
    expect(posicion.latLon).toEqual({ latitude: -34.6, longitude: -58.4 });
    expect(GOOD_HDOP_MAX).toBe(2);
  });

  it('con HDOP 3 la calidad es aceptable', () => {
    const posicion = readPosition(payload({ hdop: 3 }), true);

    expect(posicion.quality).toBe('aceptable');
    expect(ACCEPTABLE_HDOP_MAX).toBe(5);
  });

  it('con HDOP 7 la calidad es imprecisa', () => {
    const posicion = readPosition(payload({ hdop: 7 }), true);

    expect(posicion.quality).toBe('imprecisa');
    expect(posicion.latLon).not.toBeNull();
  });

  it('sin HDOP la calidad es aceptable y no se afirma una precisión que no se conoce', () => {
    const posicion = readPosition(payload({ hdop: null }), true);

    expect(posicion.quality).toBe('aceptable');
    expect(posicion.hdop).toBeNull();
    expect(posicion.latLon).not.toBeNull();
  });

  it('con la bandera en false y coordenadas presentes no hay posición', () => {
    const posicion = readPosition(payload({ latitude: -34.6, longitude: -58.4 }), false);

    expect(posicion.quality).toBe('ninguna');
    expect(posicion.latLon).toBeNull();
  });

  it('sin coordenadas no hay posición', () => {
    const posicion = readPosition(payload({ latitude: null, longitude: null }), true);

    expect(posicion.quality).toBe('ninguna');
    expect(posicion.latLon).toBeNull();
  });

  it('con coordenadas 0,0 no hay posición', () => {
    const posicion = readPosition(payload({ latitude: 0, longitude: 0 }), true);

    expect(posicion.quality).toBe('ninguna');
    expect(posicion.latLon).toBeNull();
  });

  it('el HDOP sale tal cual, sin convertirlo a metros', () => {
    const posicion = readPosition(payload({ hdop: 3.4, satellites: 7, fixAgeS: 11 }), true);

    expect(posicion.hdop).toBe(3.4);
    expect(posicion.satellites).toBe(7);
    expect(posicion.fixAgeS).toBe(11);
  });
});
