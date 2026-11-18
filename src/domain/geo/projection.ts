import type { LatLon, LocalBox, LocalPoint } from './types';

/**
 * Proyección local del lote: lat/lon ↔ metros.
 *
 * Equirectangular con el origen en `origin`:
 *
 * ```
 * x = R · cos(lat0) · Δλ
 * y = R · Δφ
 * ```
 *
 * Con `lat0` la latitud del origen y los ángulos en radianes. A escala de
 * lote el error frente a una proyección geodésica completa es despreciable,
 * así que el dominio no arrastra dependencias.
 */

/** Radio medio de la Tierra, en metros. */
export const EARTH_RADIUS_M = 6371008.8;

/** Cuántos radianes tiene un grado. */
const RADIANES_POR_GRADO = Math.PI / 180;

/** Proyecta un punto geográfico al plano local, en metros. */
export function projectToLocal(origin: LatLon, point: LatLon): LocalPoint {
  const lat0 = origin.latitude * RADIANES_POR_GRADO;
  const deltaLatitud = (point.latitude - origin.latitude) * RADIANES_POR_GRADO;
  const deltaLongitud = (point.longitude - origin.longitude) * RADIANES_POR_GRADO;

  return {
    x: EARTH_RADIUS_M * Math.cos(lat0) * deltaLongitud,
    y: EARTH_RADIUS_M * deltaLatitud,
  };
}

/** Devuelve el punto geográfico de una posición del plano local. */
export function unprojectFromLocal(origin: LatLon, local: LocalPoint): LatLon {
  const lat0 = origin.latitude * RADIANES_POR_GRADO;

  return {
    latitude: origin.latitude + local.y / EARTH_RADIUS_M / RADIANES_POR_GRADO,
    longitude: origin.longitude + local.x / (EARTH_RADIUS_M * Math.cos(lat0)) / RADIANES_POR_GRADO,
  };
}

/** Caja envolvente de los puntos; `null` si no hay ninguno. */
export function boundingBox(points: readonly LocalPoint[]): LocalBox | null {
  const primero = points[0];

  if (primero === undefined) {
    return null;
  }

  let minX = primero.x;
  let minY = primero.y;
  let maxX = primero.x;
  let maxY = primero.y;

  for (const punto of points) {
    minX = Math.min(minX, punto.x);
    minY = Math.min(minY, punto.y);
    maxX = Math.max(maxX, punto.x);
    maxY = Math.max(maxY, punto.y);
  }

  return { minX, minY, maxX, maxY };
}

/** Ancho de la caja, en metros. */
export function boxWidth(box: LocalBox): number {
  return box.maxX - box.minX;
}

/** Alto de la caja, en metros. */
export function boxHeight(box: LocalBox): number {
  return box.maxY - box.minY;
}

/** Área de la caja, en metros cuadrados. */
export function boxArea(box: LocalBox): number {
  return boxWidth(box) * boxHeight(box);
}
