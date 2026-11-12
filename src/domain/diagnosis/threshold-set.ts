import { z } from 'zod';

/**
 * Set de umbrales: datos versionados de la ciencia.
 *
 * Los umbrales viven en `assets/thresholds/<version>.json`, nunca como constantes en el motor.
 * Cada valor guarda su fuente (tabla del documento de Objetivo 1) para que la evidencia del
 * diagnóstico pueda citarla.
 */

/** Papel de una variable en el veredicto: decide si mueve la clase final. */
export const variableRoleSchema = z.enum(['verdict', 'indicative', 'reference']);
export type VariableRole = z.infer<typeof variableRoleSchema>;

/** Confianza con que la fuente respalda la comparación de una variable. */
export const confidenceSchema = z.enum(['alta', 'media', 'baja', 'estimada']);
export type Confidence = z.infer<typeof confidenceSchema>;

/** Incertidumbre de la lectura, con el modelo con que se calcula. */
export const uncertaintySchema = z.discriminatedUnion('model', [
  z.object({
    model: z.literal('relative'),
    percent: z.number(),
    percentAbove: z.number().optional(),
    abovePct: z.number().optional(),
  }),
  z.object({
    model: z.literal('absolute'),
    value: z.number(),
  }),
  z.object({
    model: z.literal('unitRouteDifference'),
  }),
]);
export type Uncertainty = z.infer<typeof uncertaintySchema>;

const thresholdBase = {
  role: variableRoleSchema,
  unit: z.string().min(1),
  confidence: confidenceSchema.optional(),
  method: z.string().optional(),
  source: z.string().optional(),
  note: z.string().optional(),
  uncertainty: uncertaintySchema.optional(),
};

/** Variable con banda: óptimo conocido y, a veces, límites absolutos de daño. */
export const bandThresholdSchema = z.object({
  ...thresholdBase,
  kind: z.literal('band'),
  optimal: z.tuple([z.number(), z.number()]).optional(),
  optimalFrom: z.number().optional(),
  absoluteLower: z.number().optional(),
  absoluteUpper: z.number().optional(),
  fromCartographicUnit: z.boolean().optional(),
  managementThresholdFraction: z.number().optional(),
});
export type BandThreshold = z.infer<typeof bandThresholdSchema>;

/** Variable monótona creciente: el valor sube de una clase a otra. */
export const increasingThresholdSchema = z.object({
  ...thresholdBase,
  kind: z.literal('increasing'),
  lowMedium: z.number(),
  mediumHigh: z.number(),
});
export type IncreasingThreshold = z.infer<typeof increasingThresholdSchema>;

/** Variable monótona decreciente: el daño empieza en un umbral. */
export const decreasingThresholdSchema = z.object({
  ...thresholdBase,
  kind: z.literal('decreasing'),
  alertAbove: z.number(),
});
export type DecreasingThreshold = z.infer<typeof decreasingThresholdSchema>;

/** Variable con un nivel crítico, sin banda de clases. */
export const criticalThresholdSchema = z.object({
  ...thresholdBase,
  kind: z.literal('critical'),
  critical: z.number(),
});
export type CriticalThreshold = z.infer<typeof criticalThresholdSchema>;

/** Variable sin umbral publicado: se muestra, no participa del veredicto. */
export const noneThresholdSchema = z.object({
  ...thresholdBase,
  kind: z.literal('none'),
});
export type NoneThreshold = z.infer<typeof noneThresholdSchema>;

export const variableThresholdSchema = z.discriminatedUnion('kind', [
  bandThresholdSchema,
  increasingThresholdSchema,
  decreasingThresholdSchema,
  criticalThresholdSchema,
  noneThresholdSchema,
]);
export type VariableThreshold = z.infer<typeof variableThresholdSchema>;

export const cropThresholdSchema = z.object({
  label: z.string().min(1),
  altitude: z
    .object({
      minM: z.number().nullable(),
      maxM: z.number().nullable(),
      /** `false` cuando la franja es un óptimo y no una restricción dura. */
      blocking: z.boolean().optional(),
      source: z.string().min(1),
      note: z.string().nullable(),
    })
    .optional(),
  drainage: z
    .object({
      veto: z.boolean(),
      note: z.string().nullable(),
    })
    .optional(),
  depletionFraction: z.number(),
  rootDepthM: z.tuple([z.number(), z.number()]),
  variables: z.record(z.string(), variableThresholdSchema),
});
export type CropThreshold = z.infer<typeof cropThresholdSchema>;

export const cartographicUnitSchema = z.object({
  label: z.string().min(1),
  materialParental: z.string().optional(),
  moPct: z.number(),
  da: z.number(),
  ccGravPct: z.number(),
  pmpGravPct: z.number(),
  ccVolPct: z.number(),
  pmpVolPct: z.number(),
  caaVolPct: z.number(),
  nTotalPct: z.number(),
  nRouteDiffPct: z.number(),
  nMineralizedKgHaYear: z.number(),
  stressThresholdPct: z.record(z.string(), z.number()),
  source: z.string().optional(),
});
export type CartographicUnit = z.infer<typeof cartographicUnitSchema>;

export const thresholdSetSchema = z.object({
  schemaVersion: z.number().int().positive(),
  version: z.string().min(1),
  source: z.string().min(1),
  crops: z.record(z.string(), cropThresholdSchema),
  cartographicUnits: z.record(z.string(), cartographicUnitSchema),
  sampling: z.object({
    depthCm: z.number(),
    minSubsamples: z.number(),
    maxSubsamples: z.number(),
    pattern: z.string(),
    source: z.string().optional(),
  }),
  alerts: z.array(z.unknown()),
});
export type ThresholdSet = z.infer<typeof thresholdSetSchema>;

/** Valida un set desconocido. Lanza `ZodError` si no cumple el esquema. */
export function parseThresholdSet(raw: unknown): ThresholdSet {
  return thresholdSetSchema.parse(raw);
}

/**
 * Una banda solo permite calcular la aptitud (S) si tiene banda óptima y los dos límites
 * absolutos. Si falta alguno, la variable se puede comparar con su banda, pero no recibir una
 * clase.
 */
export function hasCompleteBandData(threshold: BandThreshold): boolean {
  return (
    threshold.optimal !== undefined &&
    threshold.absoluteLower !== undefined &&
    threshold.absoluteUpper !== undefined
  );
}
