/**
 * Tipos de la proyección local del lote.
 *
 * El plano local es equirectangular: `x` hacia el este y `y` hacia el norte,
 * en metros, con el origen en la esquina o punto que elige la pantalla. A
 * escala de lote el error de la proyección es despreciable.
 *
 * Módulo de TypeScript puro: sin React Native, Expo ni SQLite.
 */

/** Punto geográfico en grados decimales. */
export interface LatLon {
  latitude: number;
  longitude: number;
}

/** Punto del plano local, en metros. */
export interface LocalPoint {
  x: number;
  y: number;
}

/** Caja envolvente alineada a los ejes, en metros del plano local. */
export interface LocalBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
