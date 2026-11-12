import type { AptitudeClass } from '@/domain/diagnosis/types';

/**
 * Funciones de aptitud del suelo.
 *
 * Implementan las ecuaciones 34 a 36 y 39 del documento de Objetivo 1 y las clases de la tabla 40.
 * Son funciones puras: no dependen de React Native, de la base ni del bastón.
 */

/** Banda de una variable: óptimo conocido y límites absolutos de daño. */
export interface BandDefinition {
  /** Límite inferior y superior de la banda óptima. */
  readonly optimal: readonly [number, number];
  /** Límite absoluto inferior: fuera de él la aptitud es cero. */
  readonly absoluteLower: number;
  /** Límite absoluto superior: fuera de él la aptitud es cero. */
  readonly absoluteUpper: number;
}

/**
 * Aptitud de una variable de banda (ecuaciones 34 y 35).
 *
 * Vale 1 dentro de la banda óptima, baja linealmente hasta 0 en los límites absolutos y vale 0
 * fuera de ellos.
 */
export function bandSuitability(value: number, band: BandDefinition): number {
  const [optimalLower, optimalUpper] = band.optimal;

  if (value <= band.absoluteLower || value >= band.absoluteUpper) {
    return 0;
  }

  if (value < optimalLower) {
    return (value - band.absoluteLower) / (optimalLower - band.absoluteLower);
  }

  if (value > optimalUpper) {
    return (band.absoluteUpper - value) / (band.absoluteUpper - optimalUpper);
  }

  return 1;
}

/**
 * Aptitud de una variable monótona creciente (ecuación 36).
 *
 * Vale 0,5 en el límite bajo-medio y 1 en el medio-alto; por encima del medio-alto vale 1. Por
 * debajo del límite bajo-medio se extiende la recta hasta cero en contenido cero: ese es un
 * supuesto documentado del corte 1 (`creciente_desde_cero`).
 */
export function increasingSuitability(
  value: number,
  lowMedium: number,
  mediumHigh: number,
): number {
  if (value >= mediumHigh) {
    return 1;
  }

  if (value >= lowMedium) {
    return 0.5 + (0.5 * (value - lowMedium)) / (mediumHigh - lowMedium);
  }

  if (lowMedium <= 0) {
    return 0;
  }

  return (0.5 * value) / lowMedium;
}

/**
 * Intervalo de aptitud que produce la incertidumbre de la lectura (ecuación 39).
 *
 * Se evalúa la función en los dos extremos del intervalo y se toman el mínimo y el máximo, porque
 * en las variables de banda la función no es monótona.
 */
export function suitabilityInterval(
  value: number,
  uncertainty: number,
  suitabilityOf: (candidate: number) => number,
): { lower: number; upper: number } {
  const below = suitabilityOf(value - uncertainty);
  const above = suitabilityOf(value + uncertainty);

  return {
    lower: Math.min(below, above),
    upper: Math.max(below, above),
  };
}

/** Clase de aptitud de un valor de índice (tabla 40). */
export function classFromSuitability(suitability: number): AptitudeClass {
  if (suitability >= 0.75) {
    return 'S1';
  }

  if (suitability >= 0.5) {
    return 'S2';
  }

  if (suitability >= 0.25) {
    return 'S3';
  }

  return 'N';
}

const CLASS_ORDER: readonly AptitudeClass[] = ['S1', 'S2', 'S3', 'N'];

/**
 * Clases posibles a partir de un intervalo de aptitud.
 *
 * Si el intervalo cae en una sola clase, devuelve esa clase. Si cruza, devuelve todas las
 * posibles y **no elige**: la decisión la toma la persona.
 */
export function classesFromInterval(interval: { lower: number; upper: number }): AptitudeClass[] {
  const lowerClass = classFromSuitability(interval.lower);
  const upperClass = classFromSuitability(interval.upper);

  if (lowerClass === upperClass) {
    return [lowerClass];
  }

  const first = CLASS_ORDER.indexOf(upperClass);
  const last = CLASS_ORDER.indexOf(lowerClass);

  return CLASS_ORDER.slice(Math.min(first, last), Math.max(first, last) + 1);
}

/** Cómo cae una lectura dentro de una banda publicada. */
export type BandMembership = 'optimo' | 'por_debajo' | 'por_encima' | 'cumple_minimo';

/**
 * Compara una lectura con una banda publicada sin calcular aptitud.
 *
 * Se usa cuando la fuente publica la banda óptima pero no los límites absolutos: en ese caso la
 * variable puede decir si la lectura está dentro de la banda, pero no recibir una clase.
 */
export function bandMembership(
  value: number,
  band: { optimal?: readonly [number, number]; optimalFrom?: number },
): BandMembership {
  if (band.optimal !== undefined) {
    const [lower, upper] = band.optimal;

    if (value < lower) {
      return 'por_debajo';
    }

    if (value > upper) {
      return 'por_encima';
    }

    return 'optimo';
  }

  if (band.optimalFrom !== undefined) {
    return value >= band.optimalFrom ? 'cumple_minimo' : 'por_debajo';
  }

  return 'optimo';
}

/** Banda de fertilidad de una variable monótona creciente. */
export function increasingBand(
  value: number,
  lowMedium: number,
  mediumHigh: number,
): 'bajo' | 'medio' | 'alto' {
  if (value < lowMedium) {
    return 'bajo';
  }

  if (value < mediumHigh) {
    return 'medio';
  }

  return 'alto';
}
