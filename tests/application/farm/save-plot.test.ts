import { savePlot } from '@/application/farm/save-plot';
import type { Farm, Plot } from '@/domain/farm/types';
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

function fincaSembrada(): Farm {
  return {
    id: 'farm-1',
    name: 'Finca La Esperanza',
    createdAt: '2026-01-05T08:00:00Z',
    updatedAt: '2026-01-05T08:00:00Z',
  };
}

function loteSembrado(overrides: Partial<Plot> = {}): Plot {
  return {
    id: 'plot-1',
    farmId: 'farm-1',
    name: 'Lote El Guamo',
    cropPrimary: 'café',
    cropSecondary: null,
    depthCm: 20,
    cartographicUnit: null,
    lastFertilizationDate: null,
    drainage: 'bien_drenado',
    shading: null,
    density: null,
    plantingDensityHa: null,
    altitudeM: 1600,
    slope: null,
    notes: null,
    deletedAt: null,
    createdAt: '2026-01-06T08:00:00Z',
    updatedAt: '2026-01-06T08:00:00Z',
    ...overrides,
  };
}

describe('savePlot', () => {
  it('rechaza un lote sin nombre con un mensaje en español', async () => {
    const store = makeInMemoryFarmStore({ farms: [fincaSembrada()] });

    await expect(
      savePlot(
        { farmId: 'farm-1', name: '  ' },
        { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('plot') },
      ),
    ).rejects.toThrow(/nombre del lote es obligatorio/i);

    expect(store.plotRows).toHaveLength(0);
  });

  it('rechaza un lote de una finca que no existe', async () => {
    const store = makeInMemoryFarmStore();

    await expect(
      savePlot(
        { farmId: 'farm-99', name: 'Lote El Guamo' },
        { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('plot') },
      ),
    ).rejects.toThrow(/finca.*no existe/i);

    expect(store.plotRows).toHaveLength(0);
  });

  it('crea el lote con la profundidad de diagnóstico por defecto', async () => {
    const store = makeInMemoryFarmStore({ farms: [fincaSembrada()] });

    const plot = await savePlot(
      { farmId: 'farm-1', name: 'Lote El Guamo' },
      { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('plot') },
    );

    expect(plot.id).toBe('plot-1');
    expect(plot.farmId).toBe('farm-1');
    expect(plot.name).toBe('Lote El Guamo');
    expect(plot.depthCm).toBe(20);
    expect(plot.cartographicUnit).toBeNull();
    expect(plot.deletedAt).toBeNull();
    expect(plot.createdAt).toBe(AHORA);
    expect(plot.updatedAt).toBe(AHORA);
    expect(store.plotRows).toEqual([plot]);
  });

  it('conserva la unidad cartográfica del lote', async () => {
    const store = makeInMemoryFarmStore({ farms: [fincaSembrada()] });

    const plot = await savePlot(
      { farmId: 'farm-1', name: 'Lote El Guamo', cartographicUnit: 'CA-01' },
      { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('plot') },
    );

    expect(plot.cartographicUnit).toBe('CA-01');
    expect(store.plotRows[0]?.cartographicUnit).toBe('CA-01');
  });

  it('rechaza una altitud fuera del rango', async () => {
    const store = makeInMemoryFarmStore({ farms: [fincaSembrada()] });

    await expect(
      savePlot(
        { farmId: 'farm-1', name: 'Lote El Guamo', altitudeM: 20000 },
        { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('plot') },
      ),
    ).rejects.toThrow(/altitud/i);

    expect(store.plotRows).toHaveLength(0);
  });

  it('actualiza el lote sin cambiar la fecha de creación', async () => {
    const store = makeInMemoryFarmStore({ farms: [fincaSembrada()], plots: [loteSembrado()] });

    const plot = await savePlot(
      { id: 'plot-1', farmId: 'farm-1', name: 'Lote El Guamo Norte', cropPrimary: 'plátano' },
      { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('plot') },
    );

    expect(plot.id).toBe('plot-1');
    expect(plot.name).toBe('Lote El Guamo Norte');
    expect(plot.cropPrimary).toBe('plátano');
    expect(plot.depthCm).toBe(20);
    expect(plot.createdAt).toBe('2026-01-06T08:00:00Z');
    expect(plot.updatedAt).toBe(AHORA);
    expect(store.plotRows).toHaveLength(1);
  });

  it('no revive un lote borrado lógicamente', async () => {
    const store = makeInMemoryFarmStore({
      farms: [fincaSembrada()],
      plots: [loteSembrado({ deletedAt: '2026-10-01T10:00:00Z' })],
    });

    await expect(
      savePlot(
        { id: 'plot-1', farmId: 'farm-1', name: 'Lote El Guamo' },
        { farms: store.farms, clock: relojFijo(), newId: generadorDeIds('plot') },
      ),
    ).rejects.toThrow(/lote.*no existe/i);

    expect(store.plotRows[0]?.deletedAt).toBe('2026-10-01T10:00:00Z');
    expect(await store.farms.listPlots(null)).toHaveLength(0);
  });
});
