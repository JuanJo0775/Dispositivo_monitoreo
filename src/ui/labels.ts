import type { AptitudeClass, DiagnosisVariable, VariableRole } from '@/domain/diagnosis/types';

/**
 * Rótulos en español del dominio del diagnóstico.
 *
 * Viven aparte de las pantallas para que la tarjeta, la leyenda, la hoja de la
 * celda y la lista de puntos digan exactamente lo mismo.
 */

/** Nombre de cada clase de aptitud. */
export const CLASS_LABELS: Record<AptitudeClass, string> = {
  S1: 'Apto',
  S2: 'Moderadamente apto',
  S3: 'Marginalmente apto',
  N: 'No apto',
};

/** Nombre de cada variable. */
export const VARIABLE_LABELS: Record<DiagnosisVariable, string> = {
  humidity: 'Humedad',
  ph: 'pH',
  ec: 'Conductividad',
  n: 'Nitrógeno',
  nSensor: 'Nitrógeno de la sonda',
  p: 'Fósforo',
  k: 'Potasio',
  temperature: 'Temperatura',
  organicMatter: 'Materia orgánica',
  cic: 'Capacidad de intercambio',
};

/** Papel de la variable en el veredicto, en texto. */
export const ROLE_LABELS: Record<VariableRole, string> = {
  verdict: 'entra en el veredicto',
  indicative: 'informativo',
  reference: 'solo referencia',
};
