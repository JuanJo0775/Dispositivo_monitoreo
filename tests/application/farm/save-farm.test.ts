import { saveFarm } from '@/application/farm/save-farm';
import type { Farm } from '@/domain/farm/types';
import type { Clock } from '@/ports/clock';

import { makeInMemoryFarmStore } from '../../helpers/in-memory-farm-store';

const AHORA = '2026-11-12T15:00:00Z';

function relojFijo(): Clock {
  return { now: () => AHORA };
}

function generadorDeIds(prefijo: string): () => string {
  let contador = 0;
  return () => `${prefijo}-${++contador}`;
}

function fincaSembrada(overrides: Partial<Farm> = {}): Farm {
  return {
    id: 'farm-1',
    name: 'Finca La Esperanza',
    createdAt: '2026-01-05T08:00:00Z',
    updatedAt: '2026-01-05T08:00:00Z',
    ...overrides,
  };
}

describe('saveFarm', () => {
  it('rechaza una finca sin nombre con un mensaje en español', async () => {
    const store = makeInMemoryFarmStore();

    await expect(
      saveFarm(
        { name: '   ' },
        { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('farm') },
      ),
    ).rejects.toThrow(/nombre de la finca es obligatorio/i);

    expect(store.farmRows).toHaveLength(0);
  });

  it('rechaza un nombre de más de 120 caracteres', async () => {
    const store = makeInMemoryFarmStore();

    await expect(
      saveFarm(
        { name: 'a'.repeat(121) },
        { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('farm') },
      ),
    ).rejects.toThrow(/120 caracteres/i);
  });

  it('crea la finca con identificador y marcas de tiempo del reloj', async () => {
    const store = makeInMemoryFarmStore();

    const farm = await saveFarm(
      { name: 'Finca La Esperanza' },
      { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('farm') },
    );

    expect(farm.id).toBe('farm-1');
    expect(farm.name).toBe('Finca La Esperanza');
    expect(farm.createdAt).toBe(AHORA);
    expect(farm.updatedAt).toBe(AHORA);
    expect(store.farmRows).toEqual([farm]);
  });

  it('actualiza la finca sin cambiar la fecha de creación', async () => {
    const store = makeInMemoryFarmStore({ farms: [fincaSembrada()] });

    const farm = await saveFarm(
      { id: 'farm-1', name: 'Finca El Mirador' },
      { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('farm') },
    );

    expect(farm.id).toBe('farm-1');
    expect(farm.name).toBe('Finca El Mirador');
    expect(farm.createdAt).toBe('2026-01-05T08:00:00Z');
    expect(farm.updatedAt).toBe(AHORA);
    expect(store.farmRows).toHaveLength(1);
    expect(store.farmRows[0]?.name).toBe('Finca El Mirador');
  });

  it('rechaza actualizar una finca que no existe', async () => {
    const store = makeInMemoryFarmStore();

    await expect(
      saveFarm(
        { id: 'farm-99', name: 'Finca fantasma' },
        { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('farm') },
      ),
    ).rejects.toThrow(/finca.*no existe/i);
  });
});
