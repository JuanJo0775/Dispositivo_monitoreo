import type { Farm, Plot } from '@/domain/farm/types';

/** Almacén de fincas y de los lotes que agrupan. */
export interface FarmStore {
  insertFarm(farm: Farm): Promise<void>;
  updateFarm(farm: Farm): Promise<void>;
  getFarm(id: string): Promise<Farm | null>;
  listFarms(): Promise<Farm[]>;
  insertPlot(plot: Plot): Promise<void>;
  updatePlot(plot: Plot): Promise<void>;
  getPlot(id: string): Promise<Plot | null>;
  /** Lotes de una finca; con `null` devuelve los de todas. */
  listPlots(farmId: string | null): Promise<Plot[]>;
}
