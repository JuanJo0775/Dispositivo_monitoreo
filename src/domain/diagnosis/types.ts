import type { CaptureFlags, CapturePayload } from '@/domain/capture/types';

/** Clase de aptitud del suelo (tabla 40 del documento de Objetivo 1). */
export type AptitudeClass = 'S1' | 'S2' | 'S3' | 'N';

/**
 * Papel de una variable en el veredicto.
 *
 * - `verdict`: entra en la ley del mínimo y sostiene la clase final.
 * - `indicative`: se calcula y se muestra, pero la fuente la reserva a variabilidad relativa.
 * - `reference`: no hay umbral comparable; se muestra el dato con su motivo.
 */
export type VariableRole = 'verdict' | 'indicative' | 'reference';

/** Estado del resultado de una variable. */
export type VariableStatus = 'class' | 'interval' | 'band' | 'alert' | 'reference';

/** Confianza con que la fuente respalda la comparación de una variable. */
export type Confidence = 'alta' | 'media' | 'baja' | 'estimada';

/** Variables que el motor sabe producir. */
export type DiagnosisVariable =
  'humidity' | 'ph' | 'ec' | 'n' | 'nSensor' | 'p' | 'k' | 'temperature' | 'organicMatter' | 'cic';

/** Resultado de una variable dentro del diagnóstico. */
export interface VariableResult {
  readonly variable: DiagnosisVariable;
  readonly role: VariableRole;
  readonly status: VariableStatus;
  readonly value: number | null;
  readonly unit: string;
  readonly uncertainty: number | null;
  readonly class: AptitudeClass | null;
  readonly possibleClasses: readonly AptitudeClass[];
  readonly band: string | null;
  readonly possibleBands: readonly string[];
  readonly suitability: number | null;
  readonly suitabilityInterval: { readonly lower: number; readonly upper: number } | null;
  readonly confidence: Confidence | null;
  readonly reference: string | null;
  readonly method: string | null;
  readonly reason: string | null;
}

/** Alerta del diagnóstico. */
export interface DiagnosisAlert {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'blocking';
  readonly message: string;
}

/** Variable que fijó la clase final por ser la más limitante. */
export interface LimitingFactor {
  readonly variable: DiagnosisVariable;
  readonly suitability: number;
  readonly class: AptitudeClass;
}

/** Evidencia: con qué se calculó y qué falta. */
export interface DiagnosisEvidence {
  readonly thresholdsVersion: string;
  readonly crop: string | null;
  readonly cartographicUnit: string | null;
  readonly rules: readonly string[];
  readonly assumptions: readonly string[];
  readonly missing: readonly string[];
  readonly sources: readonly string[];
}

/** Las cuatro versiones que exige el proyecto para que un diagnóstico sea válido. */
export interface DiagnosisVersions {
  readonly engine: string;
  readonly thresholds: string;
  readonly calibration: string;
  readonly firmware: string | null;
}

/** Contexto del lote en el momento de la medición. */
export interface DiagnosisContext {
  readonly crop: string;
  readonly cartographicUnit: string | null;
  readonly depthCm: number;
  readonly lastFertilizationDate: string | null;
  readonly altitudeM: number | null;
  readonly drainage: string | null;
  readonly plantingDensityHa: number | null;
  readonly shadingPct: number | null;
}

/** Índices de aptitud: el mínimo (ley del mínimo) y el paramétrico. */
export interface DiagnosisIndex {
  /** Índice mínimo: el de la variable más limitante (ecuación 37). */
  readonly minimum: number;
  /** Índice paramétrico (ecuación 38); nulo si no hay con qué calcularlo. */
  readonly parametric: number | null;
}

/** Resultado del motor de diagnóstico. */
export interface DiagnosisResult {
  readonly validity: 'valid' | 'blocked' | 'insufficient_data';
  readonly classes: readonly AptitudeClass[];
  readonly index: DiagnosisIndex;
  readonly perVariable: readonly VariableResult[];
  readonly limitingFactors: readonly LimitingFactor[];
  readonly alerts: readonly DiagnosisAlert[];
  readonly evidence: DiagnosisEvidence;
  readonly versions: DiagnosisVersions;
  readonly explanation: string;
}

/** Entrada del motor: valores medidos, contexto y versiones. */
export interface DiagnosisInput {
  readonly measuredAtUtc: string;
  readonly payload: CapturePayload;
  readonly flags: CaptureFlags;
  readonly context: DiagnosisContext;
  readonly calibrationVersion: string;
  readonly firmwareVersion: string | null;
}
