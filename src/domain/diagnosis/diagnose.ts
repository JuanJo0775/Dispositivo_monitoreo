import { formatNumber } from '@/shared/format';
import { ENGINE_VERSION } from '@/shared/versions';

import {
  availableWaterPct,
  compensateEc,
  estimateCicCmolKg,
  estimateNitrogenTotalPct,
} from './estimates';
import {
  bandMembership,
  bandSuitability,
  classesFromInterval,
  classFromSuitability,
  increasingBand,
  increasingSuitability,
  suitabilityInterval,
} from './suitability';
import type { CartographicUnit, ThresholdSet, VariableThreshold } from './threshold-set';
import type {
  AptitudeClass,
  DiagnosisAlert,
  DiagnosisEvidence,
  DiagnosisInput,
  DiagnosisResult,
  DiagnosisVariable,
  LimitingFactor,
  VariableResult,
} from './types';

/**
 * Motor de diagnóstico del suelo.
 *
 * Es TypeScript puro: no sabe nada de SQLite, de React Native ni del bastón. Recibe la lectura y
 * el contexto del lote, y devuelve clases, intervalos, factor limitante, alertas y evidencia.
 *
 * El orden de evaluación es el de la sección 13.5 del documento de Objetivo 1: primero la validez
 * del dato, después las restricciones duras, luego la carga de la unidad cartográfica, las
 * conversiones, las estimaciones indirectas, la aptitud por variable y por último el factor
 * limitante y las clases.
 */

/** Días por debajo de los cuales la fertilización reciente invalida la lectura. */
const FERTILIZATION_RESIDUAL_DAYS = 90;

/** Días de la ventana de muestreo recomendada (3 a 4 meses tras la fertilización). */
const SAMPLING_WINDOW_MAX_DAYS = 120;

/** Densidad de siembra recomendada para el plátano (tabla 39). */
const BANANA_DENSITY_MIN = 1500;
const BANANA_DENSITY_MAX = 2500;

const MS_PER_DAY = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);

  if (Number.isNaN(from) || Number.isNaN(to)) {
    return null;
  }

  return (to - from) / MS_PER_DAY;
}

function block(alerts: DiagnosisAlert[], code: string, message: string): void {
  alerts.push({ code, severity: 'blocking', message });
}

function warn(alerts: DiagnosisAlert[], code: string, message: string): void {
  alerts.push({ code, severity: 'warning', message });
}

function note(alerts: DiagnosisAlert[], code: string, message: string): void {
  alerts.push({ code, severity: 'info', message });
}

/** Incertidumbre de una lectura según el modelo publicado en el set. */
function uncertaintyFor(
  threshold: VariableThreshold | undefined,
  value: number,
  unit: CartographicUnit | undefined,
): number | null {
  const uncertainty = threshold?.uncertainty;

  if (uncertainty === undefined) {
    return null;
  }

  if (uncertainty.model === 'absolute') {
    return uncertainty.value;
  }

  if (uncertainty.model === 'relative') {
    const percent =
      uncertainty.percentAbove !== undefined &&
      uncertainty.abovePct !== undefined &&
      value > uncertainty.abovePct
        ? uncertainty.percentAbove
        : uncertainty.percent;

    return (value * percent) / 100;
  }

  if (unit !== undefined) {
    return (value * unit.nRouteDiffPct) / 100;
  }

  return null;
}

function missingValue(
  variable: DiagnosisVariable,
  threshold: VariableThreshold | undefined,
  reason: string,
  reference: string | null,
): VariableResult {
  return {
    variable,
    role: threshold?.role ?? 'reference',
    status: 'reference',
    value: null,
    unit: threshold?.unit ?? '',
    uncertainty: null,
    class: null,
    possibleClasses: [],
    band: null,
    possibleBands: [],
    suitability: null,
    suitabilityInterval: null,
    confidence: threshold?.confidence ?? null,
    reference,
    method: threshold?.method ?? null,
    reason,
  };
}

/**
 * Diagnostica una medición.
 *
 * @param input lectura, banderas y contexto del lote.
 * @param thresholds set de umbrales versionado con el que se interpreta.
 */
export function diagnose(input: DiagnosisInput, thresholds: ThresholdSet): DiagnosisResult {
  const { payload, flags, context } = input;
  const cropKey = context.crop;
  const crop = thresholds.crops[cropKey];
  const unit =
    context.cartographicUnit === null
      ? undefined
      : thresholds.cartographicUnits[context.cartographicUnit];

  const alerts: DiagnosisAlert[] = [];
  const rules: string[] = [];
  const assumptions = new Set<string>();
  const sources = new Set<string>([thresholds.source]);

  // ---------------------------------------------------------------- Fase 1: validez del dato
  rules.push('validez_del_dato');

  if (!flags.probeOk) {
    block(
      alerts,
      'sonda_con_falla',
      'La sonda no respondió correctamente: no hay lectura confiable.',
    );
  }

  if (!flags.timeValid) {
    block(
      alerts,
      'hora_invalida',
      'La hora del bastón no es válida: la lectura no se puede ubicar en el tiempo.',
    );
  }

  if (flags.simulated) {
    note(
      alerts,
      'dato_simulado',
      'Estos datos vienen de una simulación o de una prueba de banco: sirven para verificar el equipo, no son datos de campo.',
    );
  }

  if (flags.ecOverThreshold) {
    warn(
      alerts,
      'ce_sobre_umbral_baston',
      'El bastón marcó la conductividad por encima de su umbral: las lecturas de N, P y K no son confiables.',
    );
  }

  // Validez temporal de nutrientes (tabla 31 y tabla 39).
  const elapsedDays =
    context.lastFertilizationDate === null
      ? null
      : daysBetween(context.lastFertilizationDate, input.measuredAtUtc);

  if (elapsedDays === null) {
    note(
      alerts,
      'temporalidad_no_verificable',
      'No hay fecha de última fertilización registrada: no se puede verificar la ventana de muestreo.',
    );
  } else if (elapsedDays < FERTILIZATION_RESIDUAL_DAYS) {
    rules.push('validez_temporal');
    block(
      alerts,
      'fuera_de_ventana_temporal',
      `La medición se tomó ${Math.round(elapsedDays)} días después de la fertilización, dentro del efecto residual: no se emite veredicto.`,
    );
  } else if (elapsedDays > SAMPLING_WINDOW_MAX_DAYS) {
    note(
      alerts,
      'muestreo_tardio',
      `La medición se tomó ${Math.round(elapsedDays)} días después de la fertilización, después de la ventana recomendada de 3 a 4 meses.`,
    );
  } else {
    rules.push('ventana_de_muestreo_ideal');
  }

  // ------------------------------------------------- Fase 2: restricciones duras del lote
  rules.push('restricciones_duras');

  if (crop === undefined) {
    block(
      alerts,
      'cultivo_sin_umbrales',
      `No hay umbrales publicados para el cultivo ${cropKey}: no se puede diagnosticar.`,
    );
  } else {
    const altitude = crop.altitude;

    if (altitude !== undefined && context.altitudeM !== null) {
      const belowMin =
        altitude.minM !== null && altitude.minM !== undefined && context.altitudeM < altitude.minM;
      const aboveMax =
        altitude.maxM !== null && altitude.maxM !== undefined && context.altitudeM > altitude.maxM;

      if (belowMin || aboveMax) {
        const message = `La altitud del lote (${context.altitudeM} m) está fuera de la franja de ${crop.label} (${altitude.minM ?? '—'} a ${altitude.maxM ?? '—'} m).`;

        if (altitude.blocking === false) {
          warn(alerts, 'altitud_fuera_del_optimo', message);
        } else {
          rules.push('compatibilidad_altitudinal');
          block(alerts, 'altitud_fuera_de_franja', message);
        }
      }
    }

    if (crop.drainage?.veto === true && context.drainage === 'deficiente') {
      rules.push('drenaje');
      block(
        alerts,
        'drenaje_deficiente',
        `El drenaje del lote es deficiente y para ${crop.label} la asfixia radicular es determinante: no se emite veredicto.`,
      );
    }

    if (
      cropKey === 'platano' &&
      context.plantingDensityHa !== null &&
      (context.plantingDensityHa < BANANA_DENSITY_MIN ||
        context.plantingDensityHa > BANANA_DENSITY_MAX)
    ) {
      warn(
        alerts,
        'densidad_fuera_de_rango',
        `La densidad de siembra (${context.plantingDensityHa} plantas/ha) está fuera del rango de 1.500 a 2.500 plantas/ha del plátano.`,
      );
    }

    if (context.depthCm !== 20) {
      note(
        alerts,
        'profundidad_distinta_de_20_cm',
        `La profundidad de muestreo es ${context.depthCm} cm y la profundidad de diagnóstico publicada es de 20 cm.`,
      );
    }
  }

  // ------------------------------- Fase 3: carga de parámetros de la unidad cartográfica
  rules.push('unidad_cartografica');

  if (context.cartographicUnit !== null && unit === undefined) {
    warn(
      alerts,
      'unidad_cartografica_desconocida',
      `La unidad cartográfica ${context.cartographicUnit} no está en el set de umbrales: la humedad no se puede comparar con su umbral.`,
    );
  }

  if (unit === undefined) {
    warn(
      alerts,
      'sin_unidad_cartografica',
      'El lote no tiene unidad cartográfica: sin ella no hay umbral de humedad ni estimación de nitrógeno.',
    );
  }

  // ------------------------------------------- Fase 6: aptitud por variable y su intervalo
  rules.push('aptitud_por_variable');

  const perVariable: VariableResult[] = [];
  const variables = crop?.variables ?? {};

  // Humedad: banda por unidad cartográfica y cultivo.
  {
    const threshold = variables.humidity;
    const value = payload.humidityPct;
    const stressThreshold = unit?.stressThresholdPct[cropKey];

    if (threshold === undefined) {
      perVariable.push(missingValue('humidity', undefined, 'sin_umbral', null));
    } else if (value === null) {
      perVariable.push(missingValue('humidity', threshold, 'sin_dato', threshold.source ?? null));
    } else if (unit === undefined) {
      perVariable.push(
        missingValue('humidity', threshold, 'sin_unidad_cartografica', threshold.source ?? null),
      );
    } else if (stressThreshold === undefined) {
      perVariable.push(missingValue('humidity', threshold, 'sin_umbral', threshold.source ?? null));
    } else {
      const optimal: [number, number] = [stressThreshold, unit.ccVolPct];
      const band = { optimal, absoluteLower: 0, absoluteUpper: 100 };
      const suitability = bandSuitability(value, band);
      const uncertainty = uncertaintyFor(threshold, value, unit) ?? 0;
      const interval = suitabilityInterval(value, uncertainty, (candidate) =>
        bandSuitability(candidate, band),
      );
      const possibleClasses = classesFromInterval(interval);
      const agua = availableWaterPct(value, unit.ccVolPct, unit.pmpVolPct);

      assumptions.add('humedad_limites_fisicos');
      sources.add(threshold.source ?? '');

      perVariable.push({
        variable: 'humidity',
        role: threshold.role,
        status: possibleClasses.length === 1 ? 'class' : 'interval',
        value,
        unit: threshold.unit,
        uncertainty,
        class: possibleClasses.length === 1 ? (possibleClasses[0] ?? null) : null,
        possibleClasses,
        band:
          value < stressThreshold
            ? 'por debajo del umbral sin estrés'
            : value > unit.ccVolPct
              ? 'saturado'
              : 'en banda sin estrés',
        possibleBands: [],
        suitability,
        suitabilityInterval: interval,
        confidence: threshold.confidence ?? null,
        reference: `Banda sin estrés ${formatNumber(stressThreshold)} a ${formatNumber(unit.ccVolPct)} % v/v (${unit.label}); agua disponible ${formatNumber(agua)} %`,
        method: threshold.method ?? null,
        reason: null,
      });
    }
  }

  // pH: banda publicada; solo el café tiene límites absolutos.
  {
    const threshold = variables.ph;
    const value = payload.ph;

    if (threshold === undefined) {
      perVariable.push(missingValue('ph', undefined, 'sin_umbral', null));
    } else if (value === null) {
      perVariable.push(missingValue('ph', threshold, 'sin_dato', threshold.source ?? null));
    } else if (threshold.kind !== 'band') {
      perVariable.push(missingValue('ph', threshold, 'sin_umbral', threshold.source ?? null));
    } else {
      const complete =
        threshold.optimal !== undefined &&
        threshold.absoluteLower !== undefined &&
        threshold.absoluteUpper !== undefined;
      const uncertainty = uncertaintyFor(threshold, value, unit);
      sources.add(threshold.source ?? '');

      if (complete) {
        const optimal = threshold.optimal as [number, number];
        const band = {
          optimal,
          absoluteLower: threshold.absoluteLower as number,
          absoluteUpper: threshold.absoluteUpper as number,
        };
        const suitability = bandSuitability(value, band);
        const interval = suitabilityInterval(value, uncertainty ?? 0, (candidate) =>
          bandSuitability(candidate, band),
        );
        const possibleClasses = classesFromInterval(interval);

        assumptions.add('ph_cafe_limite_inferior');
        assumptions.add('ph_cafe_limite_superior');

        perVariable.push({
          variable: 'ph',
          role: threshold.role,
          status: possibleClasses.length === 1 ? 'class' : 'interval',
          value,
          unit: threshold.unit,
          uncertainty,
          class: possibleClasses.length === 1 ? (possibleClasses[0] ?? null) : null,
          possibleClasses,
          band: bandMembership(value, threshold),
          possibleBands: [],
          suitability,
          suitabilityInterval: interval,
          confidence: threshold.confidence ?? null,
          reference: `Banda óptima ${formatNumber(optimal[0])} a ${formatNumber(optimal[1])}`,
          method: threshold.method ?? null,
          reason: null,
        });
      } else {
        const membership = bandMembership(value, threshold);

        perVariable.push({
          variable: 'ph',
          role: threshold.role,
          status: 'band',
          value,
          unit: threshold.unit,
          uncertainty,
          class: null,
          possibleClasses: [],
          band: membership,
          possibleBands: [],
          suitability: null,
          suitabilityInterval: null,
          confidence: threshold.confidence ?? null,
          reference:
            threshold.optimal !== undefined
              ? `Banda óptima ${formatNumber(threshold.optimal[0])} a ${formatNumber(threshold.optimal[1])}`
              : null,
          method: threshold.method ?? null,
          reason: 'sin_limites_absolutos_publicados',
        });
      }
    }
  }

  // Nitrógeno estimado desde la materia orgánica de la unidad cartográfica.
  {
    const threshold = variables.nEstimated;
    const value = unit === undefined ? null : estimateNitrogenTotalPct(unit.moPct);

    if (threshold === undefined) {
      perVariable.push(missingValue('n', undefined, 'sin_umbral', null));
    } else if (value === null) {
      perVariable.push(
        missingValue('n', threshold, 'sin_unidad_cartografica', threshold.source ?? null),
      );
    } else if (threshold.kind !== 'increasing') {
      sources.add(threshold.source ?? '');
      perVariable.push({
        variable: 'n',
        role: threshold.role,
        status: 'reference',
        value,
        unit: threshold.unit,
        uncertainty: null,
        class: null,
        possibleClasses: [],
        band: null,
        possibleBands: [],
        suitability: null,
        suitabilityInterval: null,
        confidence: threshold.confidence ?? null,
        reference: threshold.source ?? null,
        method: 'Estimado por la ecuación 4 desde la MO de la unidad cartográfica',
        reason: 'sin_umbral_publicado',
      });
    } else {
      const suitability = increasingSuitability(value, threshold.lowMedium, threshold.mediumHigh);
      const uncertainty = uncertaintyFor(threshold, value, unit) ?? 0;
      const interval = suitabilityInterval(value, uncertainty, (candidate) =>
        increasingSuitability(candidate, threshold.lowMedium, threshold.mediumHigh),
      );
      const possibleClasses = classesFromInterval(interval);

      assumptions.add('creciente_desde_cero');
      sources.add(threshold.source ?? '');

      perVariable.push({
        variable: 'n',
        role: threshold.role,
        status: possibleClasses.length === 1 ? 'class' : 'interval',
        value,
        unit: threshold.unit,
        uncertainty,
        class: possibleClasses.length === 1 ? (possibleClasses[0] ?? null) : null,
        possibleClasses,
        band: increasingBand(value, threshold.lowMedium, threshold.mediumHigh),
        possibleBands: [],
        suitability,
        suitabilityInterval: interval,
        confidence: threshold.confidence ?? null,
        reference: `Banda ${formatNumber(threshold.lowMedium)} a ${formatNumber(threshold.mediumHigh)} % de N total, estimada desde la materia orgánica de ${unit?.label ?? 'la unidad cartográfica'}`,
        method: 'Ecuación 4 (N total desde materia orgánica)',
        reason: null,
      });
    }
  }

  // Nitrógeno de la sonda: fuera de rango y de fracción (tabla 36).
  {
    const value = payload.nMgKg;

    if (value === null) {
      perVariable.push(missingValue('nSensor', undefined, 'sin_dato', null));
    } else {
      perVariable.push({
        variable: 'nSensor',
        role: 'reference',
        status: 'reference',
        value,
        unit: 'mg/kg',
        uncertainty: 40,
        class: null,
        possibleClasses: [],
        band: null,
        possibleBands: [],
        suitability: null,
        suitabilityInterval: null,
        confidence: 'baja',
        reference:
          'La sonda llega a 1.999 mg/kg y el umbral de café es 0,34 % de N total (3.400 mg/kg): fuera de rango y de fracción.',
        method: 'Estimación conductimétrica de la fracción mineral',
        reason: 'fuera_de_rango_y_de_fraccion',
      });
    }
  }

  // Fósforo: banda publicada, reservada a variabilidad relativa dentro del lote.
  {
    const threshold = variables.p;
    const value = payload.pMgKg;

    if (threshold === undefined) {
      perVariable.push(missingValue('p', undefined, 'sin_umbral', null));
    } else if (value === null) {
      perVariable.push(missingValue('p', threshold, 'sin_dato', threshold.source ?? null));
    } else if (threshold.kind !== 'increasing') {
      perVariable.push(missingValue('p', threshold, 'sin_umbral', threshold.source ?? null));
    } else {
      const uncertainty = uncertaintyFor(threshold, value, unit) ?? 0;
      const band = increasingBand(value, threshold.lowMedium, threshold.mediumHigh);
      const below = increasingBand(value - uncertainty, threshold.lowMedium, threshold.mediumHigh);
      const above = increasingBand(value + uncertainty, threshold.lowMedium, threshold.mediumHigh);
      const possibleBands = [...new Set([below, above])];
      sources.add(threshold.source ?? '');

      perVariable.push({
        variable: 'p',
        role: threshold.role,
        status: possibleBands.length === 1 ? 'band' : 'interval',
        value,
        unit: threshold.unit,
        uncertainty,
        class: null,
        possibleClasses: [],
        band,
        possibleBands,
        suitability: null,
        suitabilityInterval: null,
        confidence: threshold.confidence ?? null,
        reference: `Banda ${formatNumber(threshold.lowMedium)} a ${formatNumber(threshold.mediumHigh)} mg/kg (${threshold.method ?? 'método no publicado'})`,
        method: threshold.method ?? null,
        reason:
          possibleBands.length === 1
            ? 'comparado_con_otro_metodo_analitico'
            : 'no_se_puede_elegir_clase',
      });
    }
  }

  // Potasio: banda publicada o nivel crítico.
  {
    const threshold = variables.k;
    const value = payload.kMgKg;

    if (threshold === undefined) {
      perVariable.push(missingValue('k', undefined, 'sin_umbral', null));
    } else if (value === null) {
      perVariable.push(missingValue('k', threshold, 'sin_dato', threshold.source ?? null));
    } else if (threshold.kind === 'critical') {
      const uncertainty = uncertaintyFor(threshold, value, unit) ?? 0;
      const below = value - uncertainty < threshold.critical;
      sources.add(threshold.source ?? '');

      perVariable.push({
        variable: 'k',
        role: threshold.role,
        status: below ? 'alert' : 'band',
        value,
        unit: threshold.unit,
        uncertainty,
        class: null,
        possibleClasses: [],
        band: below ? 'por debajo del nivel crítico' : 'por encima del nivel crítico',
        possibleBands: [],
        suitability: null,
        suitabilityInterval: null,
        confidence: threshold.confidence ?? null,
        reference: `Nivel crítico ${formatNumber(threshold.critical)} mg/kg`,
        method: threshold.method ?? null,
        reason: below ? 'bajo_el_nivel_critico' : 'comparado_con_otro_metodo_analitico',
      });
    } else if (threshold.kind === 'increasing') {
      const uncertainty = uncertaintyFor(threshold, value, unit) ?? 0;
      const band = increasingBand(value, threshold.lowMedium, threshold.mediumHigh);
      const below = increasingBand(value - uncertainty, threshold.lowMedium, threshold.mediumHigh);
      const above = increasingBand(value + uncertainty, threshold.lowMedium, threshold.mediumHigh);
      const possibleBands = [...new Set([below, above])];
      sources.add(threshold.source ?? '');

      perVariable.push({
        variable: 'k',
        role: threshold.role,
        status: possibleBands.length === 1 ? 'band' : 'interval',
        value,
        unit: threshold.unit,
        uncertainty,
        class: null,
        possibleClasses: [],
        band,
        possibleBands,
        suitability: null,
        suitabilityInterval: null,
        confidence: threshold.confidence ?? null,
        reference: `Banda ${formatNumber(threshold.lowMedium)} a ${formatNumber(threshold.mediumHigh)} mg/kg (${threshold.method ?? 'método no publicado'})`,
        method: threshold.method ?? null,
        reason:
          possibleBands.length === 1
            ? 'comparado_con_otro_metodo_analitico'
            : 'no_se_puede_elegir_clase',
      });
    } else if (threshold.kind === 'band') {
      const uncertainty = uncertaintyFor(threshold, value, unit) ?? 0;
      const membership = bandMembership(value, threshold);
      sources.add(threshold.source ?? '');

      perVariable.push({
        variable: 'k',
        role: threshold.role,
        status: 'band',
        value,
        unit: threshold.unit,
        uncertainty,
        class: null,
        possibleClasses: [],
        band: membership,
        possibleBands: [],
        suitability: null,
        suitabilityInterval: null,
        confidence: threshold.confidence ?? null,
        reference:
          threshold.optimal !== undefined
            ? `Banda ${formatNumber(threshold.optimal[0])} a ${formatNumber(threshold.optimal[1])} mg/kg`
            : null,
        method: threshold.method ?? null,
        reason: 'comparado_con_otro_metodo_analitico',
      });
    } else {
      perVariable.push(missingValue('k', threshold, 'sin_umbral', threshold.source ?? null));
    }
  }

  // Conductividad eléctrica: alerta agronómica, nunca enclavamiento.
  {
    const threshold = variables.ec;
    const value = payload.ecUsCm;

    if (threshold === undefined || threshold.kind !== 'decreasing') {
      perVariable.push(missingValue('ec', threshold, 'sin_umbral', null));
    } else if (value === null) {
      perVariable.push(missingValue('ec', threshold, 'sin_dato', threshold.source ?? null));
    } else if (payload.temperatureC === null) {
      perVariable.push(
        missingValue('ec', threshold, 'sin_temperatura_para_compensar', threshold.source ?? null),
      );
    } else {
      const compensated = compensateEc(value, payload.temperatureC);
      const uncertainty = uncertaintyFor(threshold, compensated, unit);
      const over = compensated > threshold.alertAbove;
      sources.add(threshold.source ?? '');

      if (over) {
        warn(
          alerts,
          'ce_sobre_umbral',
          `La conductividad (${formatNumber(compensated)} dS/m) supera el umbral de ${formatNumber(threshold.alertAbove)} dS/m de este cultivo: es una alerta agronómica, no un enclavamiento.`,
        );
      }

      perVariable.push({
        variable: 'ec',
        role: threshold.role,
        status: over ? 'alert' : 'reference',
        value: compensated,
        unit: threshold.unit,
        uncertainty,
        class: null,
        possibleClasses: [],
        band: over ? 'por encima del umbral del cultivo' : 'por debajo del umbral del cultivo',
        possibleBands: [],
        suitability: null,
        suitabilityInterval: null,
        confidence: threshold.confidence ?? null,
        reference: `Afecta desde ${formatNumber(threshold.alertAbove)} dS/m (tabla 13 y 17)`,
        method: 'Compensación térmica a 25 °C (ecuación 15)',
        reason: 'uso_relativo_hasta_calibracion',
      });
    }
  }

  // Temperatura: no diagnostica.
  {
    const threshold = variables.temperature;
    const value = payload.temperatureC;

    if (value === null) {
      perVariable.push(missingValue('temperature', threshold, 'sin_dato', null));
    } else {
      perVariable.push({
        variable: 'temperature',
        role: 'reference',
        status: 'reference',
        value,
        unit: threshold?.unit ?? '°C',
        uncertainty: 0.5,
        class: null,
        possibleClasses: [],
        band: null,
        possibleBands: [],
        suitability: null,
        suitabilityInterval: null,
        confidence: null,
        reference: 'La temperatura del suelo no diagnostica: es covariable de control de calidad.',
        method: null,
        reason: 'no_diagnostica',
      });
    }
  }

  // Materia orgánica y CIC: vienen de la unidad cartográfica, no de la sonda.
  for (const [variable, estimate] of [
    ['organicMatter', unit === undefined ? null : unit.moPct],
    ['cic', unit === undefined ? null : estimateCicCmolKg(unit.moPct)],
  ] as const) {
    const threshold = variables[variable];

    if (threshold === undefined) {
      perVariable.push(missingValue(variable, undefined, 'sin_umbral', null));
      continue;
    }

    if (estimate === null) {
      perVariable.push(
        missingValue(variable, threshold, 'sin_unidad_cartografica', threshold.source ?? null),
      );
      continue;
    }

    if (threshold.kind !== 'band') {
      perVariable.push(missingValue(variable, threshold, 'sin_umbral', threshold.source ?? null));
      continue;
    }

    sources.add(threshold.source ?? '');
    perVariable.push({
      variable,
      role: threshold.role,
      status: 'band',
      value: estimate,
      unit: threshold.unit,
      uncertainty: null,
      class: null,
      possibleClasses: [],
      band: bandMembership(estimate, threshold),
      possibleBands: [],
      suitability: null,
      suitabilityInterval: null,
      confidence: threshold.confidence ?? null,
      reference:
        threshold.optimal !== undefined
          ? `Banda ${formatNumber(threshold.optimal[0])} a ${formatNumber(threshold.optimal[1])} ${threshold.unit}`
          : null,
      method: 'Estimado por unidad cartográfica',
      reason: 'estimado_por_unidad_cartografica',
    });
  }

  // ------------------------------------ Fase 7: factor limitante, índice y clases finales
  rules.push('ley_del_minimo');

  const blocked = alerts.some((alert) => alert.severity === 'blocking');

  const verdictVariables = perVariable.filter(
    (variable) => variable.role === 'verdict' && variable.suitability !== null,
  );

  const ordered = [...verdictVariables].sort((left, right) => {
    const difference = (left.suitability ?? 0) - (right.suitability ?? 0);

    return difference !== 0 ? difference : left.variable.localeCompare(right.variable);
  });

  const limitingResult = ordered[0];

  // Con una restricción dura activa el motor no puntúa: informa y se detiene.
  const limitingFactors: LimitingFactor[] = blocked
    ? []
    : ordered.map((variable) => ({
        variable: variable.variable,
        suitability: variable.suitability ?? 0,
        class:
          variable.suitabilityInterval === null
            ? 'N'
            : classFromSuitability(variable.suitabilityInterval.lower),
      }));

  const limiting = limitingFactors[0];
  const classes: readonly AptitudeClass[] = blocked ? [] : (limitingResult?.possibleClasses ?? []);
  const minimum = limiting?.suitability ?? 0;
  const parametric =
    blocked || verdictVariables.length < 2
      ? null
      : minimum *
        Math.sqrt(
          verdictVariables
            .filter((variable) => variable.variable !== limiting?.variable)
            .reduce((product, variable) => product * (variable.suitability ?? 0), 1),
        );

  if (parametric !== null) {
    assumptions.add('indice_parametrico_advertencia');
  }

  const validity = blocked
    ? 'blocked'
    : verdictVariables.length === 0
      ? 'insufficient_data'
      : 'valid';

  if (validity === 'insufficient_data') {
    warn(
      alerts,
      'sin_variables_aptas_para_veredicto',
      'Ninguna variable con umbral comparable pudo compararse: no hay veredicto de aptitud.',
    );
  }

  const evidence: DiagnosisEvidence = {
    thresholdsVersion: thresholds.version,
    crop: cropKey,
    cartographicUnit: context.cartographicUnit,
    rules: [...new Set(rules)],
    assumptions: [...assumptions],
    missing: [
      'umbral de seguridad de CE para el enclavamiento de nutrientes',
      'límites absolutos de pH para plátano, banano, aguacate y cítricos',
      'profundidad efectiva mínima por cultivo',
      'umbrales de temperatura del suelo por cultivo',
      'constantes de calibración por sonda',
    ],
    sources: [...sources].filter((source) => source.length > 0),
  };

  const explanation = buildExplanation({
    validity,
    classes,
    cropLabel: crop?.label ?? cropKey,
    limiting,
    perVariable,
    alerts,
  });

  return {
    validity,
    classes,
    index: { minimum, parametric },
    perVariable,
    limitingFactors,
    alerts,
    evidence,
    versions: {
      engine: ENGINE_VERSION,
      thresholds: thresholds.version,
      calibration: input.calibrationVersion,
      firmware: input.firmwareVersion,
    },
    explanation,
  };
}

/** Explicación en lenguaje sencillo, con la evidencia que la sostiene. */
function buildExplanation(input: {
  validity: DiagnosisResult['validity'];
  classes: readonly AptitudeClass[];
  cropLabel: string;
  limiting: LimitingFactor | undefined;
  perVariable: readonly VariableResult[];
  alerts: readonly DiagnosisAlert[];
}): string {
  if (input.validity === 'blocked') {
    const bloqueo = input.alerts.find((alert) => alert.severity === 'blocking');

    return `No se emite veredicto: ${bloqueo?.message ?? 'hay una restricción dura activa.'}`;
  }

  if (input.validity === 'insufficient_data') {
    return 'No hay veredicto de aptitud: con estos datos no se puede comparar ninguna variable con su umbral.';
  }

  const classNames: Record<AptitudeClass, string> = {
    S1: 'apto',
    S2: 'moderadamente apto',
    S3: 'marginalmente apto',
    N: 'no apto',
  };

  const classText =
    input.classes.length === 0
      ? 'sin clase'
      : input.classes.length === 1
        ? classNames[input.classes[0] ?? 'N']
        : `entre ${input.classes.map((value) => classNames[value]).join(' y ')}`;

  const factor = input.limiting;
  const factorResult = input.perVariable.find((variable) => variable.variable === factor?.variable);
  const factorText =
    factor === undefined
      ? ''
      : ` El factor limitante es ${factorResult?.variable === 'humidity' ? 'la humedad' : factor.variable} (${factorResult?.value ?? 'sin dato'} ${factorResult?.unit ?? ''}).`;

  const indeterminados = input.perVariable.filter((variable) => variable.status === 'interval');
  const intervalText =
    indeterminados.length === 0
      ? ''
      : ` Con la incertidumbre del instrumento, ${indeterminados.map((variable) => variable.variable).join(', ')} queda entre dos clases: la app no elige por usted.`;

  return `El suelo es ${classText} para ${input.cropLabel}.${factorText}${intervalText}`;
}
