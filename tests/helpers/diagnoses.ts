import type {
  AptitudeClass,
  DiagnosisAlert,
  DiagnosisResult,
  DiagnosisVariable,
  VariableResult,
} from '@/domain/diagnosis/types';

/** Diagnóstico de prueba con todas sus piezas; se sobrescribe lo que importa. */
export function makeDiagnosis(overrides: Partial<DiagnosisResult> = {}): DiagnosisResult {
  return {
    validity: 'valid',
    classes: ['S1'],
    index: { minimum: 0.8, parametric: 0.82 },
    perVariable: [],
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
    explanation: 'Diagnóstico de prueba.',
    ...overrides,
  };
}

/** Variable del diagnóstico con un valor medido; lo demás queda neutro. */
export function makeVariable(
  variable: DiagnosisVariable,
  value: number | null,
  unit = 'u',
): VariableResult {
  return {
    variable,
    role: 'verdict',
    status: 'class',
    value,
    unit,
    uncertainty: null,
    class: null,
    possibleClasses: [],
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

/** Alerta del motor, para agrupar por código y gravedad. */
export function makeAlert(
  code: string,
  severity: DiagnosisAlert['severity'] = 'warning',
  message = `Aviso ${code}`,
): DiagnosisAlert {
  return { code, severity, message };
}

/** Conjunto de clases de un dictamen, como lo devuelve el motor. */
export function classes(...clases: AptitudeClass[]): readonly AptitudeClass[] {
  return clases;
}
