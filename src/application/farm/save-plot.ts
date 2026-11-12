import type { Drainage, Plot } from '@/domain/farm/types';
import { validatePlot } from '@/domain/farm/validation';
import type { Clock } from '@/ports/clock';
import type { FarmStore } from '@/ports/stores/farm-store';

export interface SavePlotInput {
  /** Identificador del lote a editar; si no viene, se crea uno nuevo. */
  readonly id?: string;
  readonly farmId: string;
  readonly name: string;
  readonly cropPrimary?: string | null;
  readonly cropSecondary?: string | null;
  readonly depthCm?: number | null;
  readonly cartographicUnit?: string | null;
  readonly lastFertilizationDate?: string | null;
  readonly drainage?: Drainage | null;
  readonly shading?: string | null;
  readonly density?: string | null;
  readonly plantingDensityHa?: number | null;
  readonly altitudeM?: number | null;
  readonly slope?: number | null;
  readonly notes?: string | null;
}

export interface SavePlotDeps {
  readonly farms: FarmStore;
  readonly clock: Clock;
  readonly newId: () => string;
}

/** Profundidad de diagnóstico por defecto, en centímetros, cuando no se informa una. */
export const DEFAULT_DEPTH_CM = 20;

/**
 * Guarda un lote: lo crea si no viene identificador y lo edita si viene.
 *
 * El lote siempre pertenece a una finca existente. Al editar, un campo que
 * no se informa conserva el valor que ya tenía; un campo enviado como `null`
 * se deja vacío. El borrado es lógico: un lote borrado no se revive editándolo.
 */
export async function savePlot(input: SavePlotInput, deps: SavePlotDeps): Promise<Plot> {
  const name = input.name.trim();

  const validation = validatePlot({
    name,
    depthCm: input.depthCm ?? null,
    altitudeM: input.altitudeM ?? null,
    lastFertilizationDate: input.lastFertilizationDate ?? null,
  });

  if (!validation.valid) {
    throw new Error(validation.message ?? 'Los datos del lote no son válidos.');
  }

  const farm = await deps.farms.getFarm(input.farmId);

  if (farm === null) {
    throw new Error('La finca del lote no existe.');
  }

  const now = deps.clock.now();

  if (input.id === undefined) {
    const plot: Plot = {
      id: deps.newId(),
      farmId: input.farmId,
      name,
      cropPrimary: input.cropPrimary ?? null,
      cropSecondary: input.cropSecondary ?? null,
      depthCm: input.depthCm ?? DEFAULT_DEPTH_CM,
      cartographicUnit: input.cartographicUnit ?? null,
      lastFertilizationDate: input.lastFertilizationDate ?? null,
      drainage: input.drainage ?? null,
      shading: input.shading ?? null,
      density: input.density ?? null,
      plantingDensityHa: input.plantingDensityHa ?? null,
      altitudeM: input.altitudeM ?? null,
      slope: input.slope ?? null,
      notes: input.notes ?? null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await deps.farms.insertPlot(plot);

    return plot;
  }

  const existing = await deps.farms.getPlot(input.id);

  if (existing === null) {
    throw new Error('El lote que se quiere editar no existe.');
  }

  const plot: Plot = {
    ...existing,
    farmId: input.farmId,
    name,
    cropPrimary: input.cropPrimary !== undefined ? input.cropPrimary : existing.cropPrimary,
    cropSecondary: input.cropSecondary !== undefined ? input.cropSecondary : existing.cropSecondary,
    depthCm: input.depthCm ?? existing.depthCm ?? DEFAULT_DEPTH_CM,
    cartographicUnit:
      input.cartographicUnit !== undefined ? input.cartographicUnit : existing.cartographicUnit,
    lastFertilizationDate:
      input.lastFertilizationDate !== undefined
        ? input.lastFertilizationDate
        : existing.lastFertilizationDate,
    drainage: input.drainage !== undefined ? input.drainage : existing.drainage,
    shading: input.shading !== undefined ? input.shading : existing.shading,
    density: input.density !== undefined ? input.density : existing.density,
    plantingDensityHa:
      input.plantingDensityHa !== undefined ? input.plantingDensityHa : existing.plantingDensityHa,
    altitudeM: input.altitudeM !== undefined ? input.altitudeM : existing.altitudeM,
    slope: input.slope !== undefined ? input.slope : existing.slope,
    notes: input.notes !== undefined ? input.notes : existing.notes,
    deletedAt: existing.deletedAt,
    updatedAt: now,
  };

  await deps.farms.updatePlot(plot);

  return plot;
}
