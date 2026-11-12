/**
 * Estimaciones y conversiones de unidades del motor.
 *
 * Todas salen de ecuaciones publicadas en `docs/requirements/objetivo-1-umbrales-ecuaciones-motor.md`:
 * ecuación 1 (capacidad de campo por densidad aparente), ecuación 4 (N total desde materia
 * orgánica), ecuación 5 (CIC desde materia orgánica), ecuación 8 (gravimétrico a volumétrico),
 * ecuación 12 (agua disponible en porcentaje), ecuación 15 (compensación térmica de la CE) y la
 * tabla 6 (factores de conversión).
 */

/** Factores de conversión publicados en la tabla 6. */
export const CONVERSION_FACTORS = {
  /** 1 cmol de carga por kg de potasio equivale a 390,98 mg/kg. */
  kMgKgPerCmolKg: 390.98,
  caMgKgPerCmolKg: 200.39,
  mgMgKgPerCmolKg: 121.53,
  naMgKgPerCmolKg: 229.9,
  alMgKgPerCmolKg: 89.94,
  /** 1 dS/m equivale a 1.000 µS/cm. */
  usCmPerDsM: 1000,
} as const;

/**
 * Capacidad de campo en función de la densidad aparente (ecuación 1).
 *
 * `log10(CC) = 2,36 − 0,79 × Da`, para suelos derivados de ceniza volcánica.
 */
export function fieldCapacityFromDensity(da: number): number {
  return 10 ** (2.36 - 0.79 * da);
}

/** Capacidad de campo volumétrica a partir de la gravimétrica (ecuación 8). */
export function volumetricCapacityField(ccGravPct: number, da: number): number {
  return ccGravPct * da;
}

/**
 * Nitrógeno total estimado a partir de la materia orgánica (ecuación 4).
 *
 * `N = 0,01644 + 0,045277 × MO − 0,00063493 × MO²`, con la MO en porcentaje. Está calibrada para
 * la zona cafetera colombiana.
 */
export function estimateNitrogenTotalPct(moPct: number): number {
  return 0.01644 + 0.045277 * moPct - 0.00063493 * moPct * moPct;
}

/** Capacidad de intercambio catiónica estimada desde la materia orgánica (ecuación 5). */
export function estimateCicCmolKg(moPct: number): number {
  return 10.26 + 1.25 * moPct;
}

/** Agua aprovechable como porcentaje del agua disponible (ecuación 12). */
export function availableWaterPct(thetaV: number, ccV: number, pmpV: number): number {
  return ((thetaV - pmpV) / (ccV - pmpV)) * 100;
}

/**
 * Conductividad compensada a 25 °C (ecuación 15), expresada en dS/m.
 *
 * `CE25 = CE_T / (1 + 0,02 × (T − 25))`, con la CE del sensor en µS/cm.
 */
export function compensateEc(ecUsCm: number, temperatureC: number): number {
  const ecDsM = ecUsCm / CONVERSION_FACTORS.usCmPerDsM;

  return ecDsM / (1 + 0.02 * (temperatureC - 25));
}

/** Convierte cmol de carga por kg a mg/kg con el factor de la tabla 6. */
export function cmolKgToMgKg(value: number, factor: number): number {
  return value * factor;
}
