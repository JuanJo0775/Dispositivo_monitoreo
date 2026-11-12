import {
  bandMembership,
  bandSuitability,
  classesFromInterval,
  classFromSuitability,
  increasingBand,
  increasingSuitability,
  suitabilityInterval,
} from '@/domain/diagnosis/suitability';

const HUMEDAD = {
  optimal: [40.2, 48.3] as const,
  absoluteLower: 0,
  absoluteUpper: 100,
};

describe('bandSuitability', () => {
  it('vale 1 dentro de la banda óptima', () => {
    expect(bandSuitability(45, HUMEDAD)).toBe(1);
  });

  it('vale 1 justo en el límite óptimo', () => {
    expect(bandSuitability(40.2, HUMEDAD)).toBe(1);
    expect(bandSuitability(48.3, HUMEDAD)).toBe(1);
  });

  it('baja linealmente por debajo de la banda', () => {
    expect(bandSuitability(30, HUMEDAD)).toBeCloseTo(30 / 40.2, 6);
  });

  it('baja linealmente por encima de la banda', () => {
    expect(bandSuitability(60, HUMEDAD)).toBeCloseTo((100 - 60) / (100 - 48.3), 6);
  });

  it('vale 0 en los límites absolutos y fuera de ellos', () => {
    expect(bandSuitability(0, HUMEDAD)).toBe(0);
    expect(bandSuitability(100, HUMEDAD)).toBe(0);
    expect(bandSuitability(-5, HUMEDAD)).toBe(0);
    expect(bandSuitability(120, HUMEDAD)).toBe(0);
  });
});

describe('increasingSuitability', () => {
  it('vale 0,5 en el límite bajo-medio y 1 en el medio-alto', () => {
    expect(increasingSuitability(10, 10, 20)).toBe(0.5);
    expect(increasingSuitability(20, 20, 30)).toBeCloseTo(0.5, 6);
    expect(increasingSuitability(30, 10, 20)).toBe(1);
  });

  it('sube en la mitad de la banda', () => {
    expect(increasingSuitability(15, 10, 20)).toBeCloseTo(0.75, 6);
  });

  it('vale 1 por encima del límite medio-alto', () => {
    expect(increasingSuitability(25, 10, 20)).toBe(1);
  });

  it('baja hasta cero en contenido cero', () => {
    expect(increasingSuitability(0, 10, 20)).toBe(0);
    expect(increasingSuitability(5, 10, 20)).toBeCloseTo(0.25, 6);
  });
});

describe('suitabilityInterval', () => {
  it('toma el mínimo y el máximo de los dos extremos', () => {
    const interval = suitabilityInterval(49, 2, (value) => bandSuitability(value, HUMEDAD));

    expect(interval.lower).toBeCloseTo((100 - 51) / (100 - 48.3), 6);
    expect(interval.upper).toBe(1);
  });

  it('queda en uno cuando la banda no se cruza', () => {
    const interval = suitabilityInterval(45, 3, (value) => bandSuitability(value, HUMEDAD));

    expect(interval).toEqual({ lower: 1, upper: 1 });
  });
});

describe('classFromSuitability', () => {
  it('reparte las clases en los límites exactos de la tabla 40', () => {
    expect(classFromSuitability(0.75)).toBe('S1');
    expect(classFromSuitability(0.7499)).toBe('S2');
    expect(classFromSuitability(0.5)).toBe('S2');
    expect(classFromSuitability(0.4999)).toBe('S3');
    expect(classFromSuitability(0.25)).toBe('S3');
    expect(classFromSuitability(0.2499)).toBe('N');
    expect(classFromSuitability(0)).toBe('N');
  });
});

describe('classesFromInterval', () => {
  it('devuelve una sola clase cuando el intervalo no cruza', () => {
    expect(classesFromInterval({ lower: 0.8, upper: 0.9 })).toEqual(['S1']);
  });

  it('devuelve todas las clases posibles y no elige', () => {
    expect(classesFromInterval({ lower: 0.3, upper: 0.8 })).toEqual(['S1', 'S2', 'S3']);
    expect(classesFromInterval({ lower: 0.1, upper: 0.6 })).toEqual(['S2', 'S3', 'N']);
  });

  it('ordena las clases de mejor a peor', () => {
    expect(classesFromInterval({ lower: 0.2, upper: 0.9 })).toEqual(['S1', 'S2', 'S3', 'N']);
  });
});

describe('bandMembership', () => {
  it('dice si la lectura está dentro de la banda', () => {
    expect(bandMembership(5.2, { optimal: [5, 5.5] })).toBe('optimo');
    expect(bandMembership(4.8, { optimal: [5, 5.5] })).toBe('por_debajo');
    expect(bandMembership(5.8, { optimal: [5, 5.5] })).toBe('por_encima');
  });

  it('acepta un solo límite inferior óptimo', () => {
    expect(bandMembership(4, { optimalFrom: 3.5 })).toBe('cumple_minimo');
    expect(bandMembership(3, { optimalFrom: 3.5 })).toBe('por_debajo');
  });
});

describe('increasingBand', () => {
  it('reparte la banda de fertilidad', () => {
    expect(increasingBand(5, 10, 20)).toBe('bajo');
    expect(increasingBand(15, 10, 20)).toBe('medio');
    expect(increasingBand(25, 10, 20)).toBe('alto');
  });
});
