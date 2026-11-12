import { listMeasurements } from '@/application/capture/list-measurements';
import type { Measurement } from '@/domain/measurement/types';

import { makeInMemoryStores } from '../../helpers/in-memory-stores';
import { makeMeasurement } from '../../helpers/measurements';

async function seed(rows: Measurement[]) {
  const stores = makeInMemoryStores();
  for (const row of rows) {
    await stores.measurements.insert(row);
  }
  return stores;
}

describe('listMeasurements', () => {
  it('ordena de la más reciente a la más antigua', async () => {
    const stores = await seed([
      makeMeasurement({}, { id: 'm-1', capturedAtUtc: '2026-11-10T10:00:00Z' }),
      makeMeasurement({}, { id: 'm-2', capturedAtUtc: '2026-11-12T10:00:00Z' }),
      makeMeasurement({}, { id: 'm-3', capturedAtUtc: '2026-11-11T10:00:00Z' }),
    ]);

    const rows = await listMeasurements(stores.measurements);

    expect(rows.map((row) => row.id)).toEqual(['m-2', 'm-3', 'm-1']);
  });

  it('excluye las mediciones descartadas por defecto', async () => {
    const stores = await seed([
      makeMeasurement({}, { id: 'm-1' }),
      makeMeasurement({}, { id: 'm-2', discardedAt: '2026-11-12T18:00:00Z' }),
    ]);

    const rows = await listMeasurements(stores.measurements);

    expect(rows.map((row) => row.id)).toEqual(['m-1']);
  });

  it('filtra por lote', async () => {
    const stores = await seed([
      makeMeasurement({}, { id: 'm-1', plotId: 'plot-1' }),
      makeMeasurement({}, { id: 'm-2', plotId: 'plot-2' }),
    ]);

    const rows = await listMeasurements(stores.measurements, { plotId: 'plot-2' });

    expect(rows.map((row) => row.id)).toEqual(['m-2']);
  });

  it('devuelve una lista vacía sin lanzar cuando no hay datos', async () => {
    const stores = makeInMemoryStores();

    await expect(listMeasurements(stores.measurements)).resolves.toEqual([]);
  });
});
