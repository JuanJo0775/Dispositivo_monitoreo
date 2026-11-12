import type { Farm } from '@/domain/farm/types';
import { validateFarmName } from '@/domain/farm/validation';
import type { Clock } from '@/ports/clock';
import type { FarmStore } from '@/ports/stores/farm-store';

export interface SaveFarmInput {
  /** Identificador de la finca a editar; si no viene, se crea una nueva. */
  readonly id?: string;
  readonly name: string;
}

export interface SaveFarmDeps {
  readonly farms: FarmStore;
  readonly clock: Clock;
  readonly newId: () => string;
}

/**
 * Guarda una finca: la crea si no viene identificador y la edita si viene.
 *
 * Al editar se conserva la fecha de creación de la finca original; solo
 * cambian el nombre y la fecha de última edición. Una finca que no existe no
 * se puede editar.
 */
export async function saveFarm(input: SaveFarmInput, deps: SaveFarmDeps): Promise<Farm> {
  const name = input.name.trim();

  const validation = validateFarmName(name);

  if (!validation.valid) {
    throw new Error(validation.message ?? 'El nombre de la finca no es válido.');
  }

  if (input.id === undefined) {
    const now = deps.clock.now();
    const farm: Farm = {
      id: deps.newId(),
      name,
      createdAt: now,
      updatedAt: now,
    };

    await deps.farms.insertFarm(farm);

    return farm;
  }

  const existing = await deps.farms.getFarm(input.id);

  if (existing === null) {
    throw new Error('La finca que se quiere editar no existe.');
  }

  const farm: Farm = {
    ...existing,
    name,
    updatedAt: deps.clock.now(),
  };

  await deps.farms.updateFarm(farm);

  return farm;
}
