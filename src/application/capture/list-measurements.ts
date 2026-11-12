import type { Measurement } from '@/domain/measurement/types';
import type { MeasurementFilter, MeasurementStore } from '@/ports/stores/measurement-store';

/**
 * Lista mediciones para el historial.
 *
 * Ordena de la más reciente a la más antigua acá, no en la base: así SQLite y
 * los almacenes en memoria se comportan igual y la UI no depende del motor.
 * Las descartadas quedan fuera salvo que se pidan explícitamente.
 */
export async function listMeasurements(
  store: MeasurementStore,
  filter: MeasurementFilter = {},
): Promise<Measurement[]> {
  const rows = await store.list(filter);

  return [...rows].sort((a, b) => b.capturedAtUtc.localeCompare(a.capturedAtUtc));
}
