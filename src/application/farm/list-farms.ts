import type { Farm, Plot } from '@/domain/farm/types';
import type { FarmStore } from '@/ports/stores/farm-store';

export interface ListFarmsDeps {
  readonly farms: FarmStore;
}

/**
 * Ordena por nombre sin acentos ni mayúsculas, como se lee en el campo.
 *
 * La comparación va en el caso de uso y no en la base: así SQLite y los
 * almacenes en memoria se comportan igual y la interfaz no depende del motor.
 */
function compararPorNombre(izquierda: { name: string }, derecha: { name: string }): number {
  const a = izquierda.name.toLowerCase();
  const b = derecha.name.toLowerCase();

  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

/** Lista las fincas ordenadas por nombre. */
export async function listFarms(deps: ListFarmsDeps): Promise<Farm[]> {
  const farms = await deps.farms.listFarms();

  return [...farms].sort(compararPorNombre);
}

/**
 * Lista los lotes ordenados por nombre.
 *
 * Con `farmId` en `null` devuelve los lotes de todas las fincas. Los lotes
 * borrados lógicamente quedan fuera: no se ven ni se reviven por accidente.
 */
export async function listPlots(farmId: string | null, deps: ListFarmsDeps): Promise<Plot[]> {
  const plots = await deps.farms.listPlots(farmId);

  return plots.filter((plot) => plot.deletedAt === null).sort(compararPorNombre);
}
