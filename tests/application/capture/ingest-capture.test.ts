import { ingestCapture } from '@/application/capture/ingest-capture';

import { makeCapture } from '../../helpers/captures';
import { makeInMemoryStores } from '../../helpers/in-memory-stores';

const clock = () => '2026-11-12T12:00:00Z';

describe('ingestCapture', () => {
  it('guarda la captura y la medición en una sola transacción', async () => {
    const stores = makeInMemoryStores();

    const result = await ingestCapture(
      { capture: makeCapture(), plotId: 'plot-1' },
      { uow: stores.uow, clock, newId: () => 'm-1' },
    );

    expect(result).toEqual({ status: 'saved', measurementId: 'm-1' });
    expect(await stores.measurements.list()).toHaveLength(1);
    expect(await stores.captures.findByDeviceSequence('stick-01', 1)).not.toBeNull();
  });

  it('ignora un duplicado por deviceId y sequence sin sobrescribir el primero', async () => {
    const stores = makeInMemoryStores();
    const deps = { uow: stores.uow, clock, newId: () => 'm-1' };

    await ingestCapture({ capture: makeCapture({}, {}, 7), plotId: null }, deps);
    const second = await ingestCapture(
      { capture: makeCapture({ humidityPct: 99 }, {}, 7), plotId: null },
      { ...deps, newId: () => 'm-2' },
    );

    expect(second).toEqual({ status: 'duplicate', measurementId: null });
    const list = await stores.measurements.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.payload.humidityPct).toBe(38);
  });

  it('guarda una captura inválida, marcada, en vez de descartarla', async () => {
    const stores = makeInMemoryStores();

    await ingestCapture(
      { capture: makeCapture({ humidityPct: 140 }), plotId: null },
      { uow: stores.uow, clock, newId: () => 'm-1' },
    );

    const [measurement] = await stores.measurements.list();
    expect(measurement?.valid).toBe(false);
    expect(measurement?.invalidReasons).toContain('humidity_out_of_range');
  });

  it('no confirma al bastón si la escritura falla', async () => {
    const stores = makeInMemoryStores({ failMeasurementInsert: true });
    const confirm = jest.fn(async () => {});

    await expect(
      ingestCapture(
        { capture: makeCapture(), plotId: 'plot-1', confirm },
        { uow: stores.uow, clock, newId: () => 'm-1' },
      ),
    ).rejects.toThrow();

    expect(confirm).not.toHaveBeenCalled();
  });

  it('no deja filas a medias cuando falla la transacción', async () => {
    const stores = makeInMemoryStores({ failMeasurementInsert: true });

    await expect(
      ingestCapture(
        { capture: makeCapture(), plotId: 'plot-1' },
        { uow: stores.uow, clock, newId: () => 'm-1' },
      ),
    ).rejects.toThrow();

    expect(await stores.measurements.list()).toHaveLength(0);
    expect(await stores.captures.findByDeviceSequence('stick-01', 1)).toBeNull();
  });

  it('confirma al bastón solo después del commit', async () => {
    const stores = makeInMemoryStores();
    const order: string[] = [];
    const confirm = jest.fn(async () => {
      order.push('confirm');
    });
    stores.onCommit(() => order.push('commit'));

    await ingestCapture(
      { capture: makeCapture(), plotId: null, confirm },
      { uow: stores.uow, clock, newId: () => 'm-1' },
    );

    expect(order).toEqual(['commit', 'confirm']);
  });

  it('no confirma un duplicado', async () => {
    const stores = makeInMemoryStores();
    const confirm = jest.fn(async () => {});
    const deps = { uow: stores.uow, clock, newId: () => 'm-1' };

    await ingestCapture({ capture: makeCapture({}, {}, 3), plotId: null }, deps);
    await ingestCapture({ capture: makeCapture({}, {}, 3), plotId: null, confirm }, deps);

    expect(confirm).not.toHaveBeenCalled();
  });
});
