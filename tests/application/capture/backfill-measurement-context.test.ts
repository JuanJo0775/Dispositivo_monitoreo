import { backfillMeasurementContext } from '@/application/capture/backfill-measurement-context';
import { ingestCapture } from '@/application/capture/ingest-capture';
import type { RawCapture } from '@/domain/capture/types';

import { makeCapture } from '../../helpers/captures';
import { makeInMemoryFarmStore } from '../../helpers/in-memory-farm-store';
import { makeInMemorySessionStore } from '../../helpers/in-memory-session-store';
import { makeInMemoryStores } from '../../helpers/in-memory-stores';
import { makePlot, makeSession } from '../../helpers/farm-fixtures';

const clock = () => '2026-11-12T12:00:00Z';

/** Captura guardada antes de la tarea 6: sin lote y sin sesión. */
function capturaVieja(overrides: Partial<RawCapture> = {}): RawCapture {
  return { ...makeCapture(), plotId: null, ...overrides };
}

describe('backfillMeasurementContext', () => {
  it('le da el lote de la sesión a una captura vieja sin lote', async () => {
    const stores = makeInMemoryStores();
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'lote-1' })] });
    const sessions = makeInMemorySessionStore([
      makeSession({ id: 'sesion-7', configId: 7, plotId: 'lote-1' }),
    ]);

    await ingestCapture(
      { capture: capturaVieja(), plotId: null },
      { uow: stores.uow, clock, newId: () => 'm-1' },
    );

    const resultado = await backfillMeasurementContext({
      captures: stores.captures,
      measurements: stores.measurements,
      farms: farms.farms,
      sessions: sessions.sessions,
    });

    expect(resultado).toEqual({ checked: 1, plotAssigned: 1, sessionAssigned: 1 });

    const captura = await stores.captures.findByDeviceSequence('stick-01', 1);
    const [medicion] = await stores.measurements.list();

    expect(captura?.plotId).toBe('lote-1');
    expect(medicion?.plotId).toBe('lote-1');
    expect(medicion?.sessionId).toBe('sesion-7');
  });

  it('le da al lote el código que trae la captura cuando ese lote existe', async () => {
    const stores = makeInMemoryStores();
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'lote-1' })] });
    const sessions = makeInMemorySessionStore([]);

    await ingestCapture(
      { capture: capturaVieja({ configId: 0 }), plotId: null },
      { uow: stores.uow, clock, newId: () => 'm-1' },
    );

    const resultado = await backfillMeasurementContext({
      captures: stores.captures,
      measurements: stores.measurements,
      farms: farms.farms,
      sessions: sessions.sessions,
    });

    expect(resultado.plotAssigned).toBe(1);
    expect(resultado.sessionAssigned).toBe(0);

    const [medicion] = await stores.measurements.list();

    expect(medicion?.plotId).toBe('lote-1');
    expect(medicion?.sessionId).toBeNull();
  });

  it('deja como estaba la captura que no coincide con ningún lote', async () => {
    const stores = makeInMemoryStores();
    const farms = makeInMemoryFarmStore({ plots: [] });
    const sessions = makeInMemorySessionStore([]);

    await ingestCapture(
      {
        capture: capturaVieja({ payload: { ...makeCapture().payload, plotCode: 'otro' } }),
        plotId: null,
      },
      { uow: stores.uow, clock, newId: () => 'm-1' },
    );

    const resultado = await backfillMeasurementContext({
      captures: stores.captures,
      measurements: stores.measurements,
      farms: farms.farms,
      sessions: sessions.sessions,
    });

    expect(resultado).toEqual({ checked: 1, plotAssigned: 0, sessionAssigned: 0 });

    const captura = await stores.captures.findByDeviceSequence('stick-01', 1);
    const [medicion] = await stores.measurements.list();

    expect(captura?.plotId).toBeNull();
    expect(medicion?.plotId).toBeNull();
    expect(medicion?.sessionId).toBeNull();
  });

  it('es idempotente: la segunda vuelta no cambia nada ni cuenta asignaciones', async () => {
    const stores = makeInMemoryStores();
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'lote-1' })] });
    const sessions = makeInMemorySessionStore([
      makeSession({ id: 'sesion-7', configId: 7, plotId: 'lote-1' }),
    ]);

    await ingestCapture(
      { capture: capturaVieja(), plotId: null },
      { uow: stores.uow, clock, newId: () => 'm-1' },
    );

    const deps = {
      captures: stores.captures,
      measurements: stores.measurements,
      farms: farms.farms,
      sessions: sessions.sessions,
    };

    await backfillMeasurementContext(deps);
    const segunda = await backfillMeasurementContext(deps);

    expect(segunda).toEqual({ checked: 1, plotAssigned: 0, sessionAssigned: 0 });
  });

  it('no toca el contenido de la captura: solo su metadato', async () => {
    const stores = makeInMemoryStores();
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'lote-1' })] });
    const sessions = makeInMemorySessionStore([
      makeSession({ id: 'sesion-7', configId: 7, plotId: 'lote-1' }),
    ]);
    const original = capturaVieja();

    await ingestCapture(
      { capture: original, plotId: null },
      { uow: stores.uow, clock, newId: () => 'm-1' },
    );

    await backfillMeasurementContext({
      captures: stores.captures,
      measurements: stores.measurements,
      farms: farms.farms,
      sessions: sessions.sessions,
    });

    const captura = await stores.captures.findByDeviceSequence('stick-01', 1);

    expect(captura?.payload).toEqual(original.payload);
    expect(captura?.flags).toEqual(original.flags);
    expect(captura?.capturedAtUtc).toBe(original.capturedAtUtc);
  });

  it('recupera la bandera de posición de la captura en una medición vieja', async () => {
    const stores = makeInMemoryStores();
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'lote-1' })] });
    const sessions = makeInMemorySessionStore([]);

    await ingestCapture(
      { capture: capturaVieja({ configId: 0 }), plotId: null },
      { uow: stores.uow, clock, newId: () => 'm-1' },
    );

    // Así quedó una fila vieja después de la migración 5.
    await stores.measurements.setPositionValid('m-1', false);

    await backfillMeasurementContext({
      captures: stores.captures,
      measurements: stores.measurements,
      farms: farms.farms,
      sessions: sessions.sessions,
    });

    const [medicion] = await stores.measurements.list();

    expect(medicion?.positionValid).toBe(true);
  });
});
