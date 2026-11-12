import { listFarms, listPlots } from '@/application/farm/list-farms';
import type { Farm, Plot } from '@/domain/farm/types';

import { makeInMemoryFarmStore } from '../../helpers/in-memory-farm-store';

function finca(overrides: Partial<Farm> = {}): Farm {
  return {
    id: 'farm-1',
    name: 'Finca La Esperanza',
    createdAt: '2026-01-05T08:00:00Z',
    updatedAt: '2026-01-05T08:00:00Z',
    ...overrides,
  };
}

function lote(overrides: Partial<Plot> = {}): Plot {
  return {
    id: 'plot-1',
    farmId: 'farm-1',
    name: 'Lote El Guamo',
    cropPrimary: 'café',
    cropSecondary: null,
    depthCm: 20,
    cartographicUnit: null,
    lastFertilizationDate: null,
    drainage: null,
    shading: null,
    density: null,
    plantingDensityHa: null,
    altitudeM: null,
    slope: null,
    notes: null,
    deletedAt: null,
    createdAt: '2026-01-06T08:00:00Z',
    updatedAt: '2026-01-06T08:00:00Z',
    ...overrides,
  };
}

describe('listFarms', () => {
  it('ordena las fincas por nombre', async () => {
    const store = makeInMemoryFarmStore({
      farms: [
        finca({ id: 'farm-1', name: 'Finca El Mirador' }),
        finca({ id: 'farm-2', name: 'Finca La Esperanza' }),
        finca({ id: 'farm-3', name: 'Finca Arrayanal' }),
      ],
    });

    const fincas = await listFarms({ farms: store.farms });

    expect(fincas.map((fila) => fila.id)).toEqual(['farm-3', 'farm-1', 'farm-2']);
  });

  it('devuelve una lista vacía sin lanzar cuando no hay fincas', async () => {
    const store = makeInMemoryFarmStore();

    await expect(listFarms({ farms: store.farms })).resolves.toEqual([]);
  });
});

describe('listPlots', () => {
  it('excluye los lotes borrados lógicamente', async () => {
    const store = makeInMemoryFarmStore({
      farms: [finca()],
      plots: [
        lote({ id: 'plot-1', name: 'Lote El Guamo' }),
        lote({ id: 'plot-2', name: 'Lote La Quebrada', deletedAt: '2026-10-01T10:00:00Z' }),
      ],
    });

    const lotes = await listPlots(null, { farms: store.farms });

    expect(lotes.map((fila) => fila.id)).toEqual(['plot-1']);
  });

  it('filtra los lotes por finca', async () => {
    const store = makeInMemoryFarmStore({
      farms: [finca({ id: 'farm-1' }), finca({ id: 'farm-2', name: 'Finca El Mirador' })],
      plots: [
        lote({ id: 'plot-1', farmId: 'farm-1', name: 'Lote El Guamo' }),
        lote({ id: 'plot-2', farmId: 'farm-2', name: 'Lote La Cuchilla' }),
        lote({ id: 'plot-3', farmId: 'farm-2', name: 'Lote El Cedro' }),
      ],
    });

    const lotes = await listPlots('farm-2', { farms: store.farms });

    expect(lotes.map((fila) => fila.id)).toEqual(['plot-3', 'plot-2']);
  });

  it('devuelve todos los lotes vivos de todas las fincas', async () => {
    const store = makeInMemoryFarmStore({
      farms: [finca({ id: 'farm-1' }), finca({ id: 'farm-2', name: 'Finca El Mirador' })],
      plots: [
        lote({ id: 'plot-1', farmId: 'farm-1', name: 'Lote El Guamo' }),
        lote({ id: 'plot-2', farmId: 'farm-2', name: 'Lote La Cuchilla' }),
      ],
    });

    const lotes = await listPlots(null, { farms: store.farms });

    expect(lotes.map((fila) => fila.id)).toEqual(['plot-1', 'plot-2']);
  });

  it('devuelve una lista vacía sin lanzar cuando no hay lotes', async () => {
    const store = makeInMemoryFarmStore();

    await expect(listPlots(null, { farms: store.farms })).resolves.toEqual([]);
    await expect(listPlots('farm-1', { farms: store.farms })).resolves.toEqual([]);
  });
});
