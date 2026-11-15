import type {
  PlotSpace,
  PlotSpaceCell,
  PlotSpacePoint,
} from '@/application/map/describe-plot-space';
import type { Grid, GridCell } from '@/domain/geo/grid';
import { projectToLocal, unprojectFromLocal } from '@/domain/geo/projection';

import {
  borderColorForClasses,
  cellBorderColor,
  cellFillColor,
  fillColorForClasses,
} from './map-colors';

/**
 * Geometría del mapa: de la malla en metros a GeoJSON en grados.
 *
 * La malla vive en el plano local del lote (metros); MapLibre dibuja en
 * longitud/latitud. La conversión usa el mismo origen que usó la malla, así
 * celdas y puntos caen donde se midieron y no donde “deberían” caer.
 */

/** Coordenada de MapLibre: `[longitud, latitud]`. */
export type LonLat = [number, number];

/** Caja geográfica: `[oeste, sur, este, norte]`, como la espera MapLibre. */
export type LonLatBounds = [west: number, south: number, east: number, north: number];

/** Propiedades de una celda dibujada. */
interface CellProperties {
  readonly id: string;
  readonly fill: string;
  readonly border: string;
}

/** Propiedades de un punto dibujado. */
interface PointProperties {
  readonly id: string;
  /** `true` si la posición es imprecisa: se dibuja como anillo hueco. */
  readonly hollow: boolean;
  readonly fill: string;
  readonly border: string;
}

/** Anillo cerrado de una celda, en grados. */
export function cellRing(grid: Grid, cell: GridCell): LonLat[] {
  const { minX, minY, maxX, maxY } = cell.bounds;

  const esquinas = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: minY },
  ];

  return esquinas.map((esquina) => {
    const punto = unprojectFromLocal(grid.origin, esquina);

    return [punto.longitude, punto.latitude] as LonLat;
  });
}

/** Celdas del espacio como una colección de polígonos. */
export function cellFeatures(space: PlotSpace): GeoJSON.FeatureCollection {
  const grid = space.grid;

  if (grid === null) {
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: space.cells.map((celda) => ({
      type: 'Feature' as const,
      id: celda.cell.id,
      properties: {
        id: celda.cell.id,
        fill: cellFillColor(celda.verdict),
        border: cellBorderColor(celda.verdict),
      } satisfies CellProperties,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [cellRing(grid, celda.cell)],
      },
    })),
  };
}

/**
 * Puntos con posición como una colección de puntos.
 *
 * Los que no tienen posición no se dibujan: se listan y se cuentan aparte.
 */
export function pointFeatures(space: PlotSpace): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: space.points.flatMap((punto) => {
      const latLon = punto.position.latLon;

      if (latLon === null) {
        return [];
      }

      return [
        {
          type: 'Feature' as const,
          id: punto.measurement.id,
          properties: {
            id: punto.measurement.id,
            hollow: punto.position.quality === 'imprecisa',
            fill: pointFillColor(punto),
            border: pointBorderColor(punto),
          } satisfies PointProperties,
          geometry: {
            type: 'Point' as const,
            coordinates: [latLon.longitude, latLon.latitude],
          },
        },
      ];
    }),
  };
}

/** Relleno del punto: la clase mejor, o el gris de “no concluyente” si no hay clase. */
function pointFillColor(punto: PlotSpacePoint): string {
  return fillColorForClasses(punto.diagnosis?.classes ?? []);
}

/** Borde del punto: el de la peor clase cuando hay dos. */
function pointBorderColor(punto: PlotSpacePoint): string {
  return borderColorForClasses(punto.diagnosis?.classes ?? []);
}

/**
 * Caja que debe encuadrar el mapa.
 *
 * Sale de la malla, que ya contiene todos los puntos con posición. Se agranda
 * un poco para que ni la malla ni sus puntos queden pegados al borde.
 */
export function spaceBounds(space: PlotSpace): LonLatBounds | null {
  const grid = space.grid;

  if (grid === null) {
    const latLons = space.points.flatMap((punto) =>
      punto.position.latLon === null ? [] : [punto.position.latLon],
    );

    if (latLons.length === 0) {
      return null;
    }

    const latitudes = latLons.map((punto) => punto.latitude);
    const longitudes = latLons.map((punto) => punto.longitude);

    return boundsFromCorners(
      Math.min(...longitudes),
      Math.min(...latitudes),
      Math.max(...longitudes),
      Math.max(...latitudes),
    );
  }

  const suroeste = unprojectFromLocal(grid.origin, { x: grid.box.minX, y: grid.box.minY });
  const noreste = unprojectFromLocal(grid.origin, { x: grid.box.maxX, y: grid.box.maxY });

  return boundsFromCorners(
    suroeste.longitude,
    suroeste.latitude,
    noreste.longitude,
    noreste.latitude,
  );
}

/** Caja con un margen mínimo, para que un punto suelto no quede en zoom infinito. */
function boundsFromCorners(oeste: number, sur: number, este: number, norte: number): LonLatBounds {
  const margenLon = Math.max((este - oeste) * 0.1, 0.0002);
  const margenLat = Math.max((norte - sur) * 0.1, 0.0002);

  return [oeste - margenLon, sur - margenLat, este + margenLon, norte + margenLat];
}

/** Centro del espacio, para cuando el mapa necesita un punto y no una caja. */
export function spaceCenter(space: PlotSpace): LonLat {
  const bounds = spaceBounds(space);

  if (bounds === null) {
    // Sin puntos no hay lugar que mostrar; el lienzo queda neutro.
    return [0, 0];
  }

  const [oeste, sur, este, norte] = bounds;

  return [(oeste + este) / 2, (sur + norte) / 2];
}

/** Celda dibujada como porcentajes de la caja, para el croquis sin teselas. */
export interface PercentCell {
  readonly cell: PlotSpaceCell;
  readonly leftPct: number;
  readonly topPct: number;
  readonly widthPct: number;
  readonly heightPct: number;
}

/** Relación ancho/alto del área medida, para que el croquis no deforme la malla. */
export function spaceAspectRatio(space: PlotSpace): number {
  const caja = space.grid?.box;

  if (caja === undefined) {
    return 1;
  }

  const ancho = caja.maxX - caja.minX;
  const alto = caja.maxY - caja.minY;

  if (ancho <= 0 || alto <= 0) {
    return 1;
  }

  return ancho / alto;
}

/** Celdas en porcentajes de la caja; la malla viene alineada a los ejes. */
export function percentCells(space: PlotSpace): PercentCell[] {
  const grid = space.grid;

  if (grid === null) {
    return [];
  }

  const ancho = grid.box.maxX - grid.box.minX;
  const alto = grid.box.maxY - grid.box.minY;

  if (ancho <= 0 || alto <= 0) {
    return [];
  }

  return space.cells.map((celda) => ({
    cell: celda,
    leftPct: ((celda.cell.bounds.minX - grid.box.minX) / ancho) * 100,
    topPct: ((grid.box.maxY - celda.cell.bounds.maxY) / alto) * 100,
    widthPct: ((celda.cell.bounds.maxX - celda.cell.bounds.minX) / ancho) * 100,
    heightPct: ((celda.cell.bounds.maxY - celda.cell.bounds.minY) / alto) * 100,
  }));
}

/** Punto dibujado como porcentajes de la caja, para el croquis sin teselas. */
export interface PercentPoint {
  readonly point: PlotSpacePoint;
  readonly leftPct: number;
  readonly topPct: number;
}

/** Puntos con posición en porcentajes de la caja. */
export function percentPoints(space: PlotSpace): PercentPoint[] {
  const grid = space.grid;

  if (grid === null) {
    return [];
  }

  const ancho = grid.box.maxX - grid.box.minX;
  const alto = grid.box.maxY - grid.box.minY;

  if (ancho <= 0 || alto <= 0) {
    return [];
  }

  return space.points.flatMap((punto) => {
    const latLon = punto.position.latLon;

    if (latLon === null) {
      return [];
    }

    const local = projectToLocal(grid.origin, latLon);

    return [
      {
        point: punto,
        leftPct: ((local.x - grid.box.minX) / ancho) * 100,
        topPct: ((grid.box.maxY - local.y) / alto) * 100,
      },
    ];
  });
}
