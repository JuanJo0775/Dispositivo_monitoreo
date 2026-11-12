import type { Farm, Plot } from '@/domain/farm/types';
import type { FarmStore } from '@/ports/stores/farm-store';

export interface InMemoryFarmStoreSeed {
  readonly farms?: readonly Farm[];
  readonly plots?: readonly Plot[];
}

export interface InMemoryFarmStore {
  /** Doble del puerto de fincas y lotes. */
  readonly farms: FarmStore;
  /** Fincas guardadas, en el orden en que se insertaron. */
  readonly farmRows: readonly Farm[];
  /** Lotes guardados, incluidos los borrados lógicamente. */
  readonly plotRows: readonly Plot[];
}

/**
 * Implementación en memoria de `FarmStore` para pruebas.
 *
 * El borrado de lotes es lógico: un lote con `deletedAt` no aparece en
 * `listPlots` ni se entrega en `getPlot`, como si no existiera. Las filas
 * crudas quedan a la vista para poder afirmar qué se guardó de verdad.
 */
export function makeInMemoryFarmStore(seed: InMemoryFarmStoreSeed = {}): InMemoryFarmStore {
  const farmRows: Farm[] = [...(seed.farms ?? [])];
  const plotRows: Plot[] = [...(seed.plots ?? [])];

  const farms: FarmStore = {
    async insertFarm(farm) {
      farmRows.push(farm);
    },
    async updateFarm(farm) {
      const index = farmRows.findIndex((row) => row.id === farm.id);
      if (index >= 0) {
        farmRows[index] = farm;
        return;
      }
      farmRows.push(farm);
    },
    async getFarm(id) {
      return farmRows.find((row) => row.id === id) ?? null;
    },
    async listFarms() {
      return [...farmRows];
    },
    async insertPlot(plot) {
      plotRows.push(plot);
    },
    async updatePlot(plot) {
      const index = plotRows.findIndex((row) => row.id === plot.id);
      if (index >= 0) {
        plotRows[index] = plot;
        return;
      }
      plotRows.push(plot);
    },
    async getPlot(id) {
      const plot = plotRows.find((row) => row.id === id);
      if (plot === undefined || plot.deletedAt !== null) {
        return null;
      }
      return plot;
    },
    async listPlots(farmId) {
      return plotRows.filter(
        (plot) => plot.deletedAt === null && (farmId === null || plot.farmId === farmId),
      );
    },
  };

  return { farms, farmRows, plotRows };
}
