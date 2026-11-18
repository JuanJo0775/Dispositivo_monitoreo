import {
  boundingBox,
  boxArea,
  boxHeight,
  boxWidth,
  projectToLocal,
  unprojectFromLocal,
} from '@/domain/geo/projection';
import type { LocalBox, LocalPoint } from '@/domain/geo/types';

const ORIGEN = { latitude: -34.6, longitude: -58.4 };

/** Un grado de latitud con el radio medio: 111 194,9 m, es decir ~111,19 km. */
const UN_GRADO_DE_LATITUD_M = 111_194.9;

function cajaDe(puntos: readonly LocalPoint[]): LocalBox {
  const caja = boundingBox(puntos);

  if (caja === null) {
    throw new Error('se esperaba una caja envolvente');
  }

  return caja;
}

describe('projectToLocal', () => {
  it('ida y vuelta conserva las posiciones con error menor a 1 cm en un cuadrado de 100 m', () => {
    const esquinas: readonly LocalPoint[] = [
      { x: -50, y: -50 },
      { x: 50, y: -50 },
      { x: 50, y: 50 },
      { x: -50, y: 50 },
    ];

    for (const esquina of esquinas) {
      const ida = projectToLocal(ORIGEN, unprojectFromLocal(ORIGEN, esquina));

      expect(Math.abs(ida.x - esquina.x)).toBeLessThan(0.01);
      expect(Math.abs(ida.y - esquina.y)).toBeLessThan(0.01);
    }
  });

  it('toma el norte como y positivo', () => {
    const norte = projectToLocal(ORIGEN, { latitude: -34.599, longitude: -58.4 });

    expect(norte.y).toBeGreaterThan(0);
    expect(Math.abs(norte.x)).toBeLessThan(0.000001);
  });

  it('mide un grado de latitud como ~111,19 km con error menor a 1 m', () => {
    const unGrado = projectToLocal(ORIGEN, {
      latitude: ORIGEN.latitude + 1,
      longitude: ORIGEN.longitude,
    });

    expect(Math.abs(unGrado.y - UN_GRADO_DE_LATITUD_M)).toBeLessThan(1);
  });
});

describe('boundingBox', () => {
  it('devuelve null para una lista vacía', () => {
    expect(boundingBox([])).toBeNull();
  });

  it('calcula el ancho y el alto de la caja', () => {
    const caja = cajaDe([
      { x: -10, y: -5 },
      { x: 30, y: 20 },
      { x: 0, y: 0 },
    ]);

    expect(caja).toEqual({ minX: -10, minY: -5, maxX: 30, maxY: 20 });
    expect(boxWidth(caja)).toBe(40);
    expect(boxHeight(caja)).toBe(25);
  });

  it('calcula el área de la caja', () => {
    const caja = cajaDe([
      { x: -10, y: -5 },
      { x: 30, y: 20 },
    ]);

    expect(boxArea(caja)).toBe(1000);
  });
});
