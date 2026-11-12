/** Finca: unidad administrativa que agrupa lotes. */
export interface Farm {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Drenaje del lote. El aguacate con drenaje deficiente es una restricción dura. */
export type Drainage = 'bien_drenado' | 'moderado' | 'deficiente' | 'encharcado';

/**
 * Lote: porción de terreno de una finca donde se muestrea.
 *
 * `cartographicUnit` es el identificador de la unidad cartográfica del catálogo de umbrales; de
 * ella salen los umbrales de humedad y la materia orgánica con que se estima el nitrógeno.
 */
export interface Plot {
  readonly id: string;
  readonly farmId: string;
  readonly name: string;
  readonly cropPrimary: string | null;
  readonly cropSecondary: string | null;
  readonly depthCm: number | null;
  readonly cartographicUnit: string | null;
  readonly lastFertilizationDate: string | null;
  readonly drainage: Drainage | null;
  readonly shading: string | null;
  readonly density: string | null;
  /** Densidad de siembra en plantas por hectárea, para la restricción del plátano. */
  readonly plantingDensityHa: number | null;
  readonly altitudeM: number | null;
  readonly slope: number | null;
  readonly notes: string | null;
  readonly deletedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
