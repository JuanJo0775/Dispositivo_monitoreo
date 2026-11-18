import { summarizeVariables, verdictForCell } from '@/domain/geo/cell-verdict';
import type { CellDiagnosisInput } from '@/domain/geo/cell-verdict';
import type {
  AptitudeClass,
  DiagnosisResult,
  DiagnosisVariable,
  VariableResult,
} from '@/domain/diagnosis/types';

/**
 * Pruebas del dictamen por celda.
 *
 * El dictamen sale solo de los diagnósticos guardados: la celda no promedia
 * clases, no elige la peor y no inventa un veredicto para una celda vacía.
 */

function diagnostico(
  classes: readonly AptitudeClass[],
  validity: DiagnosisResult['validity'] = 'valid',
  perVariable: readonly VariableResult[] = [],
): DiagnosisResult {
  return {
    validity,
    classes,
    index: { minimum: 0.6, parametric: 0.6 },
    perVariable,
    limitingFactors: [],
    alerts: [],
    evidence: {
      thresholdsVersion: '2026.11-v1',
      crop: 'cafe',
      cartographicUnit: 'chinchina',
      rules: [],
      assumptions: [],
      missing: [],
      sources: [],
    },
    versions: {
      engine: 'engine-v1',
      thresholds: '2026.11-v1',
      calibration: 'factory-v1',
      firmware: '0.1.0',
    },
    explanation: '',
  };
}

function variable(
  nombre: DiagnosisVariable,
  valor: number | null,
  unidad = '% v/v',
): VariableResult {
  return {
    variable: nombre,
    role: 'verdict',
    status: 'class',
    value: valor,
    unit: unidad,
    uncertainty: null,
    class: 'S1',
    possibleClasses: ['S1'],
    band: null,
    possibleBands: [],
    suitability: null,
    suitabilityInterval: null,
    confidence: null,
    reference: null,
    method: null,
    reason: null,
  };
}

function punto(id: string, diagnosis: DiagnosisResult | null, valid = true): CellDiagnosisInput {
  return { measurementId: id, valid, diagnosis };
}

describe('verdictForCell', () => {
  it('una celda sin mediciones queda sin_dato', () => {
    const dictamen = verdictForCell([]);

    expect(dictamen.state).toBe('sin_dato');
    expect(dictamen.classes).toEqual([]);
    expect(dictamen.groups).toEqual([]);
    expect(dictamen.validPoints).toBe(0);
    expect(dictamen.invalidPoints).toBe(0);
    expect(dictamen.reason).toBeNull();
  });

  it('una medición válida produce un_punto con las clases de su diagnóstico', () => {
    const dictamen = verdictForCell([punto('m1', diagnostico(['S2']))]);

    expect(dictamen.state).toBe('un_punto');
    expect(dictamen.classes).toEqual(['S2']);
    expect(dictamen.validPoints).toBe(1);
    expect(dictamen.invalidPoints).toBe(0);
  });

  it('dos mediciones con el mismo conjunto de clases producen resumen', () => {
    // El mismo par se declara en distinto orden: el dictamen lo ordena y lo
    // compara como conjunto para que dos puntos iguales cuenten como iguales.
    const dictamen = verdictForCell([
      punto('m1', diagnostico(['S2', 'S1'])),
      punto('m2', diagnostico(['S1', 'S2'])),
    ]);

    expect(dictamen.state).toBe('resumen');
    expect(dictamen.classes).toEqual(['S1', 'S2']);
    expect(dictamen.groups).toEqual([{ classes: ['S1', 'S2'], count: 2 }]);
    expect(dictamen.validPoints).toBe(2);
  });

  it('tres puntos S1 y uno S3 quedan no concluyentes con dos grupos, sin promedio', () => {
    const dictamen = verdictForCell([
      punto('m1', diagnostico(['S1'])),
      punto('m2', diagnostico(['S1'])),
      punto('m3', diagnostico(['S1'])),
      punto('m4', diagnostico(['S3'])),
    ]);

    expect(dictamen.state).toBe('no_concluyente');
    expect(dictamen.classes).toEqual([]);
    expect(dictamen.groups).toEqual([
      { classes: ['S1'], count: 3 },
      { classes: ['S3'], count: 1 },
    ]);
    expect(dictamen.reason).toBe('clases_distintas');
    expect(dictamen.validPoints).toBe(4);
  });

  it('un punto con dos clases posibles no se colapsa a una', () => {
    const dictamen = verdictForCell([punto('m1', diagnostico(['S1', 'S2']))]);

    expect(dictamen.state).toBe('un_punto');
    expect(dictamen.classes).toEqual(['S1', 'S2']);
  });

  it('una medición sin diagnóstico no se descarta: deja la celda no concluyente', () => {
    const dictamen = verdictForCell([punto('m1', null)]);

    expect(dictamen.state).toBe('no_concluyente');
    expect(dictamen.reason).toBe('sin_diagnostico');
    expect(dictamen.classes).toEqual([]);
    expect(dictamen.groups).toEqual([]);
    expect(dictamen.validPoints).toBe(1);
  });

  it('un diagnóstico bloqueado deja la celda no concluyente con su motivo', () => {
    const dictamen = verdictForCell([punto('m1', diagnostico(['N'], 'blocked'))]);

    expect(dictamen.state).toBe('no_concluyente');
    expect(dictamen.reason).toBe('diagnostico_bloqueado');
    expect(dictamen.classes).toEqual([]);
  });

  it('un diagnóstico con datos insuficientes deja la celda no concluyente', () => {
    const dictamen = verdictForCell([punto('m1', diagnostico([], 'insufficient_data'))]);

    expect(dictamen.state).toBe('no_concluyente');
    expect(dictamen.reason).toBe('datos_insuficientes');
    expect(dictamen.classes).toEqual([]);
  });

  it('las mediciones inválidas no entran al dictamen pero se cuentan', () => {
    const dictamen = verdictForCell([
      punto('m1', diagnostico(['S1'])),
      punto('m2', diagnostico(['S1']), false),
      punto('m3', diagnostico(['S3']), false),
    ]);

    expect(dictamen.state).toBe('un_punto');
    expect(dictamen.classes).toEqual(['S1']);
    expect(dictamen.validPoints).toBe(1);
    expect(dictamen.invalidPoints).toBe(2);
  });
});

describe('summarizeVariables', () => {
  it('resume la humedad de tres puntos con mediana y mínimo–máximo', () => {
    // Valores 32, 40 y 45: la mediana es 40 y el promedio sería 39, así que la
    // prueba distingue una mediana de un promedio. El punto de pH no tiene
    // humedad y no debe sumar al conteo de la humedad.
    const resumen = summarizeVariables([
      diagnostico(['S1'], 'valid', [variable('humidity', 32)]),
      diagnostico(['S1'], 'valid', [variable('humidity', 40)]),
      diagnostico(['S1'], 'valid', [variable('humidity', 45)]),
      diagnostico(['S1'], 'valid', [variable('ph', 5.4, 'adimensional')]),
    ]);

    expect(resumen.map((variableResumen) => variableResumen.variable)).toEqual(['humidity', 'ph']);
    expect(resumen[0]).toEqual({
      variable: 'humidity',
      unit: '% v/v',
      median: 40,
      min: 32,
      max: 45,
      points: 3,
    });
  });
});
