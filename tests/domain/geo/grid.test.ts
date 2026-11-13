import { MAX_CELLS, MAX_ASPECT, MIN_ASPECT, buildGrid, cellForPoint } from '@/domain/geo/grid';
import { boxHeight, boxWidth, projectToLocal, unprojectFromLocal } from '@/domain/geo/projection';
import type { Grid, GridCell } from '@/domain/geo/grid';
import type { LatLon, LocalPoint } from '@/domain/geo/types';

/**
 * Pruebas de la malla automática.
 *
 * Los puntos se arman en metros alrededor de un origen y se desproyectan a
 * lat/lon; la malla vuelve a proyectarlos con la latitud media, que coincide
 * con la del origen mientras la dispersión sea simétrica.
 */

const ORIGEN: LatLon = { latitude: -34.6, longitude: -58.4 };

function punto(x: number, y: number): LatLon {
  return unprojectFromLocal(ORIGEN, { x, y });
}

/** Cuatro esquinas de una dispersión de `ancho` × `alto` metros. */
function dispersion(ancho: number, alto: number): LatLon[] {
  const mitadAncho = ancho / 2;
  const mitadAlto = alto / 2;

  return [
    punto(-mitadAncho, -mitadAlto),
    punto(mitadAncho, -mitadAlto),
    punto(mitadAncho, mitadAlto),
    punto(-mitadAncho, mitadAlto),
  ];
}

function malla(puntos: readonly LatLon[], objetivo?: number): Grid {
  const grid = buildGrid(puntos, objetivo);

  if (grid === null) {
    throw new Error('se esperaba una malla');
  }

  return grid;
}

function primeraCelda(grid: Grid): GridCell {
  const [celda] = grid.cells;

  if (celda === undefined) {
    throw new Error('se esperaba al menos una celda');
  }

  return celda;
}

function aspecto(celda: GridCell): number {
  const ancho = boxWidth(celda.bounds);
  const alto = boxHeight(celda.bounds);

  return Math.max(ancho, alto) / Math.min(ancho, alto);
}

describe('buildGrid', () => {
  it('una dispersión de 55 × 55 m produce 1 celda de 0,3025 ha', () => {
    const grid = malla(dispersion(55, 55));

    expect(grid.cells).toHaveLength(1);
    expect(grid.rows).toBe(1);
    expect(grid.columns).toBe(1);
    expect(grid.cellAreaHa).toBeCloseTo(0.3025, 4);
  });

  it('una dispersión de 100 × 100 m produce 2 celdas de 0,50 ha (50 × 100 m)', () => {
    const grid = malla(dispersion(100, 100));

    expect(grid.cells).toHaveLength(2);
    expect(grid.rows).toBe(1);
    expect(grid.columns).toBe(2);
    expect(grid.cellAreaHa).toBeCloseTo(0.5, 4);
    expect(boxWidth(primeraCelda(grid).bounds)).toBeCloseTo(50, 2);
    expect(boxHeight(primeraCelda(grid).bounds)).toBeCloseTo(100, 2);
  });

  it('una dispersión de 155 × 155 m produce 6 celdas de 0,4004 ha', () => {
    const grid = malla(dispersion(155, 155));

    expect(grid.cells).toHaveLength(6);
    expect(grid.rows).toBe(2);
    expect(grid.columns).toBe(3);
    expect(grid.cellAreaHa).toBeCloseTo(0.4004, 4);
  });

  it('una dispersión de 316 × 316 m produce 25 celdas de 0,3994 ha', () => {
    const grid = malla(dispersion(316, 316));

    expect(grid.cells).toHaveLength(25);
    expect(grid.rows).toBe(5);
    expect(grid.columns).toBe(5);
    expect(grid.cellAreaHa).toBeCloseTo(0.3994, 4);
  });

  it('dos puntos a 200 m producen 3 celdas de 0,4216 ha', () => {
    const grid = malla([punto(-100, 0), punto(100, 0)]);

    expect(grid.cells).toHaveLength(3);
    expect(grid.rows).toBe(1);
    expect(grid.columns).toBe(3);
    expect(grid.cellAreaHa).toBeCloseTo(0.4216, 4);
  });

  it('un solo punto produce una celda de 63,2 × 63,2 m (0,4 ha)', () => {
    const grid = malla([punto(0, 0)]);
    const celda = primeraCelda(grid);

    expect(grid.cells).toHaveLength(1);
    expect(boxWidth(celda.bounds)).toBeCloseTo(63.2, 1);
    expect(boxHeight(celda.bounds)).toBeCloseTo(63.2, 1);
    expect(grid.cellAreaHa).toBeCloseTo(0.4, 4);
  });

  it('devuelve null cuando no hay puntos', () => {
    expect(buildGrid([])).toBeNull();
  });

  it('identifica las celdas como r{fila}c{columna}', () => {
    const grid = malla(dispersion(100, 100));

    expect(grid.cells.map((celda) => celda.id)).toEqual(['r0c0', 'r0c1']);
  });

  it('mantiene la relación de aspecto de todas las celdas entre 0,4 y 2,5', () => {
    const casos: readonly (readonly LatLon[])[] = [
      dispersion(55, 55),
      dispersion(100, 100),
      dispersion(155, 155),
      dispersion(316, 316),
      dispersion(500, 80),
      [punto(-100, 0), punto(100, 0)],
    ];

    for (const caso of casos) {
      for (const celda of malla(caso).cells) {
        expect(aspecto(celda)).toBeGreaterThanOrEqual(MIN_ASPECT);
        expect(aspecto(celda)).toBeLessThanOrEqual(MAX_ASPECT);
      }
    }
  });

  it('una caja muy alargada cae a una sola fila de celdas alargadas sin inflar la caja', () => {
    // 200 × 5 m con objetivo de 0,05 ha: ningún par deja la celda dentro de la
    // banda de aspecto, así que se usa una sola fila (la orientación que más se
    // parece a la caja) y se acepta la celda alargada antes que inventar área.
    const grid = malla(dispersion(200, 5), 0.05);

    expect(grid.rows).toBe(1);
    expect(grid.columns).toBe(2);
    expect(grid.cells).toHaveLength(2);
    expect(grid.cellAreaHa).toBeCloseTo(0.05, 4);
    expect(boxWidth(grid.box)).toBeCloseTo(200, 2);
    expect(boxHeight(grid.box)).toBeCloseTo(5, 2);
    expect(aspecto(primeraCelda(grid))).toBeGreaterThan(MAX_ASPECT);
  });

  it('deja cada punto dentro de su celda', () => {
    const casos: readonly (readonly LatLon[])[] = [
      dispersion(55, 55),
      dispersion(100, 100),
      dispersion(155, 155),
      dispersion(316, 316),
      [punto(-100, 0), punto(100, 0)],
      [punto(0, 0)],
    ];

    for (const caso of casos) {
      const grid = malla(caso);

      for (const puntoDelCaso of caso) {
        const celda = cellForPoint(grid, puntoDelCaso);

        expect(celda).not.toBeNull();

        if (celda === null) {
          continue;
        }

        const local: LocalPoint = projectToLocal(grid.origin, puntoDelCaso);

        expect(local.x).toBeGreaterThanOrEqual(celda.bounds.minX - 1e-6);
        expect(local.x).toBeLessThanOrEqual(celda.bounds.maxX + 1e-6);
        expect(local.y).toBeGreaterThanOrEqual(celda.bounds.minY - 1e-6);
        expect(local.y).toBeLessThanOrEqual(celda.bounds.maxY + 1e-6);
      }
    }
  });

  it('ajusta el área objetivo y marca adjusted cuando hay más de 400 celdas', () => {
    const grid = malla(dispersion(2000, 2000));

    expect(grid.cells).toHaveLength(MAX_CELLS);
    expect(grid.adjusted).toBe(true);
    expect(grid.targetAreaHa).toBeCloseTo(1, 6);
    expect(grid.cellAreaHa).toBeCloseTo(1, 4);
  });
});

describe('cellForPoint', () => {
  it('devuelve null para un punto fuera de la caja', () => {
    const grid = malla(dispersion(100, 100));

    expect(cellForPoint(grid, punto(1000, 0))).toBeNull();
  });
});
