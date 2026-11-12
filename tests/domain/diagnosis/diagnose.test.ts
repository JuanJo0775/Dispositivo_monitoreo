import { diagnose } from '@/domain/diagnosis/diagnose';
import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { DiagnosisContext, DiagnosisInput } from '@/domain/diagnosis/types';
import type { CaptureFlags, CapturePayload } from '@/domain/capture/types';

import rawSet from '../../../assets/thresholds/2026.11-v1.json';
import { DEFAULT_FLAGS, DEFAULT_PAYLOAD } from '../../helpers/captures';

const thresholds = parseThresholdSet(rawSet);

interface InputOverrides {
  payload?: Partial<CapturePayload>;
  flags?: Partial<CaptureFlags>;
  context?: Partial<DiagnosisContext>;
  measuredAtUtc?: string;
}

function makeInput(overrides: InputOverrides = {}): DiagnosisInput {
  return {
    measuredAtUtc: overrides.measuredAtUtc ?? '2026-11-12T17:05:00Z',
    payload: { ...DEFAULT_PAYLOAD, ...overrides.payload },
    flags: { ...DEFAULT_FLAGS, ...overrides.flags },
    context: {
      crop: 'cafe',
      cartographicUnit: 'chinchina',
      depthCm: 20,
      lastFertilizationDate: '2026-07-15',
      altitudeM: 1550,
      drainage: 'bien_drenado',
      plantingDensityHa: null,
      shadingPct: null,
      ...overrides.context,
    },
    calibrationVersion: 'factory-v1',
    firmwareVersion: '0.1.0',
  };
}

function variableOf(result: ReturnType<typeof diagnose>, name: string) {
  const found = result.perVariable.find((variable) => variable.variable === name);

  if (found === undefined) {
    throw new Error(`El diagnóstico no produjo la variable ${name}`);
  }

  return found;
}

describe('diagnose: variables y veredicto', () => {
  it('calcula la humedad con el umbral de la unidad cartográfica y del cultivo', () => {
    const result = diagnose(makeInput(), thresholds);
    const humidity = variableOf(result, 'humidity');

    expect(result.validity).toBe('valid');
    expect(humidity.role).toBe('verdict');
    expect(humidity.status).toBe('class');
    expect(humidity.class).toBe('S1');
    expect(humidity.band).toBe('por debajo del umbral sin estrés');
    expect(humidity.reference).toContain('40,2');
  });

  it('devuelve el pH como intervalo cuando la incertidumbre cruza la banda', () => {
    const result = diagnose(makeInput(), thresholds);
    const ph = variableOf(result, 'ph');

    expect(ph.status).toBe('interval');
    expect(ph.class).toBeNull();
    expect(ph.possibleClasses).toEqual(['S1', 'S2']);
    expect(ph.confidence).toBe('media');
  });

  it('estima el nitrógeno desde la materia orgánica y lo marca como estimado', () => {
    const result = diagnose(makeInput(), thresholds);
    const nitrogen = variableOf(result, 'n');

    expect(nitrogen.role).toBe('verdict');
    expect(nitrogen.confidence).toBe('estimada');
    expect(nitrogen.value).toBeCloseTo(0.535, 3);
    expect(nitrogen.method).toContain('Ecuación 4');
  });

  it('deja el nitrógeno de la sonda como referencia fuera de rango y de fracción', () => {
    const result = diagnose(makeInput(), thresholds);
    const sensor = variableOf(result, 'nSensor');

    expect(sensor.role).toBe('reference');
    expect(sensor.reason).toBe('fuera_de_rango_y_de_fraccion');
    expect(sensor.reference).toContain('3.400 mg/kg');
  });

  it('no puede elegir clase de fósforo y lo dice', () => {
    const result = diagnose(makeInput(), thresholds);
    const phosphorus = variableOf(result, 'p');

    expect(phosphorus.role).toBe('indicative');
    expect(phosphorus.status).toBe('interval');
    expect(phosphorus.reason).toBe('no_se_puede_elegir_clase');
    expect(phosphorus.possibleBands.length).toBeGreaterThan(1);
  });

  it('muestra el potasio como indicativo con su intervalo', () => {
    const result = diagnose(makeInput(), thresholds);
    const potassium = variableOf(result, 'k');

    expect(potassium.role).toBe('indicative');
    expect(potassium.possibleBands.length).toBeGreaterThan(1);
    expect(potassium.method).toContain('Acetato');
  });

  it('trata la conductividad como alerta agronómica, no como enclavamiento', () => {
    const result = diagnose(makeInput({ payload: { ecUsCm: 1500, temperatureC: 25 } }), thresholds);
    const ec = variableOf(result, 'ec');

    expect(result.validity).toBe('valid');
    expect(ec.status).toBe('alert');
    expect(result.alerts.map((alert) => alert.code)).toContain('ce_sobre_umbral');
  });

  it('fija el factor limitante por la ley del mínimo', () => {
    const result = diagnose(makeInput(), thresholds);

    expect(result.limitingFactors.length).toBeGreaterThan(0);
    const suitability = result.limitingFactors.map((factor) => factor.suitability);

    expect([...suitability].sort((a, b) => a - b)).toEqual(suitability);
  });

  it('guarda las cuatro versiones del diagnóstico', () => {
    const result = diagnose(makeInput(), thresholds);

    expect(result.versions).toEqual({
      engine: 'engine-v1',
      thresholds: '2026.11-v1',
      calibration: 'factory-v1',
      firmware: '0.1.0',
    });
  });

  it('deja los supuestos y los vacíos por escrito en la evidencia', () => {
    const result = diagnose(makeInput(), thresholds);

    expect(result.evidence.assumptions).toContain('humedad_limites_fisicos');
    expect(result.evidence.assumptions).toContain('creciente_desde_cero');
    expect(result.evidence.assumptions).toContain('indice_parametrico_advertencia');
    expect(result.evidence.missing.join(' ')).toContain('umbral de seguridad de CE');
    expect(result.evidence.sources.join(' ')).toContain('Objetivo 1 v2');
  });

  it('explica el resultado en lenguaje sencillo', () => {
    const result = diagnose(makeInput(), thresholds);

    expect(result.explanation).toContain('Café');
    expect(result.explanation.length).toBeGreaterThan(20);
  });
});

describe('diagnose: validez y restricciones duras', () => {
  it('bloquea el veredicto fuera de la franja altitudinal', () => {
    const result = diagnose(makeInput({ context: { altitudeM: 2500 } }), thresholds);

    expect(result.validity).toBe('blocked');
    expect(result.alerts.map((alert) => alert.code)).toContain('altitud_fuera_de_franja');
    expect(result.classes).toEqual([]);
  });

  it('avisa, sin bloquear, cuando la altitud solo se sale del óptimo', () => {
    const result = diagnose(
      makeInput({
        context: { crop: 'citricos', altitudeM: 2000 },
        payload: { cropCode: 'citricos' },
      }),
      thresholds,
    );

    expect(result.validity).not.toBe('blocked');
    expect(result.alerts.map((alert) => alert.code)).toContain('altitud_fuera_del_optimo');
  });

  it('bloquea el veredicto dentro del efecto residual de la fertilización', () => {
    const result = diagnose(
      makeInput({ context: { lastFertilizationDate: '2026-10-20' } }),
      thresholds,
    );

    expect(result.validity).toBe('blocked');
    expect(result.alerts.map((alert) => alert.code)).toContain('fuera_de_ventana_temporal');
  });

  it('avisa cuando no hay fecha de fertilización registrada', () => {
    const result = diagnose(makeInput({ context: { lastFertilizationDate: null } }), thresholds);

    expect(result.validity).not.toBe('blocked');
    expect(result.alerts.map((alert) => alert.code)).toContain('temporalidad_no_verificable');
  });

  it('bloquea el veredicto con drenaje deficiente en aguacate', () => {
    const result = diagnose(
      makeInput({
        context: { crop: 'aguacate', drainage: 'deficiente', altitudeM: 1200 },
      }),
      thresholds,
    );

    expect(result.validity).toBe('blocked');
    expect(result.alerts.map((alert) => alert.code)).toContain('drenaje_deficiente');
  });

  it('bloquea el veredicto cuando la sonda no respondió', () => {
    const result = diagnose(makeInput({ flags: { probeOk: false } }), thresholds);

    expect(result.validity).toBe('blocked');
    expect(result.alerts.map((alert) => alert.code)).toContain('sonda_con_falla');
  });

  it('marca el dato simulado sin bloquear el diagnóstico', () => {
    const result = diagnose(makeInput({ flags: { simulated: true } }), thresholds);

    expect(result.validity).toBe('valid');
    expect(result.alerts.map((alert) => alert.code)).toContain('dato_simulado');
  });

  it('avisa cuando el lote no tiene unidad cartográfica', () => {
    const result = diagnose(makeInput({ context: { cartographicUnit: null } }), thresholds);
    const humidity = variableOf(result, 'humidity');

    expect(humidity.reason).toBe('sin_unidad_cartografica');
    expect(result.alerts.map((alert) => alert.code)).toContain('sin_unidad_cartografica');
  });

  it('bloquea el veredicto de un cultivo sin umbrales', () => {
    const result = diagnose(makeInput({ context: { crop: 'arroz' } }), thresholds);

    expect(result.validity).toBe('blocked');
    expect(result.alerts.map((alert) => alert.code)).toContain('cultivo_sin_umbrales');
  });
});

describe('diagnose: pH sin límites absolutos', () => {
  it('lo deja como banda de referencia en los cultivos que no los tienen', () => {
    const result = diagnose(
      makeInput({ context: { crop: 'platano', altitudeM: 1200 } }),
      thresholds,
    );
    const ph = variableOf(result, 'ph');

    expect(ph.role).toBe('indicative');
    expect(ph.status).toBe('band');
    expect(ph.reason).toBe('sin_limites_absolutos_publicados');
    expect(ph.class).toBeNull();
  });

  it('avisa cuando el potasio del plátano queda bajo el nivel crítico', () => {
    const result = diagnose(
      makeInput({
        context: { crop: 'platano', altitudeM: 1200 },
        payload: { kMgKg: 90 },
      }),
      thresholds,
    );
    const potassium = variableOf(result, 'k');

    expect(potassium.status).toBe('alert');
    expect(potassium.band).toBe('por debajo del nivel crítico');
  });
});
