import { syncFromStick } from '@/application/sync/sync-from-stick';
import { encodeRecord, type StickRecord } from '@/domain/protocol/record-codec';
import type { StickSync, SyncChunk } from '@/ports/stick-sync';
import type { SyncState, SyncStateStore } from '@/ports/stores/sync-state-store';

import { makeInMemoryStores } from '../../helpers/in-memory-stores';

const clock = () => '2026-11-12T12:00:00Z';

/** Banderas del contrato: posición, fix reciente, sonda y hora válida. */
const FLAGS_OK = 23;

function makeRecord(overrides: Partial<StickRecord> = {}): StickRecord {
  return {
    idRegistro: 1,
    deviceId: 'stick-01',
    fecha: '2026-11-12',
    horaUtc: '17:05:00',
    lat: 4.5339,
    lon: -75.6811,
    altM: 1550,
    velKmh: 0.4,
    sats: 9,
    hdop: 0.9,
    edadFixS: 1.2,
    profCm: 20,
    configId: 7,
    cultivo: 'cafe',
    loteId: 'lote-1',
    fertFecha: '2026-09-01',
    humedadPct: 38,
    tempC: 21.5,
    ph: 5.4,
    ceUsCm: 120,
    nMgKg: 12,
    pMgKg: 18,
    kMgKg: 95,
    banderas: FLAGS_OK,
    batPct: 82,
    fwVer: '0.1.0',
    ...overrides,
  };
}

function makeLine(overrides: Partial<StickRecord> = {}): string {
  return encodeRecord(makeRecord(overrides));
}

interface FakeStickOptions {
  readonly chunks?: readonly SyncChunk[];
  readonly error?: Error;
  readonly onConfirm?: (deviceId: string, lastSequence: number) => void;
}

interface FakeStick extends StickSync {
  readonly requests: { deviceId: string; fromSequence: number }[];
  readonly confirmations: { deviceId: string; lastSequence: number }[];
}

/** Bastón de mentira: entrega los bloques que se le piden y anota lo que confirma. */
function makeFakeStick(options: FakeStickOptions = {}): FakeStick {
  const requests: { deviceId: string; fromSequence: number }[] = [];
  const confirmations: { deviceId: string; lastSequence: number }[] = [];

  return {
    requests,
    confirmations,
    async syncFrom(deviceId, fromSequence, onChunk) {
      requests.push({ deviceId, fromSequence });

      if (options.error !== undefined) {
        throw options.error;
      }

      for (const chunk of options.chunks ?? []) {
        await onChunk(chunk);
      }
    },
    async confirmRecords(deviceId, lastSequence) {
      options.onConfirm?.(deviceId, lastSequence);
      confirmations.push({ deviceId, lastSequence });
    },
  };
}

interface FakeSyncStateStore extends SyncStateStore {
  readonly rows: Map<string, SyncState>;
}

/** Estado de sincronización en memoria: una fila por bastón. */
function makeFakeSyncState(initial: readonly SyncState[] = []): FakeSyncStateStore {
  const rows = new Map<string, SyncState>(initial.map((state) => [state.deviceId, state]));

  return {
    rows,
    async get(deviceId) {
      return rows.get(deviceId) ?? null;
    },
    async save(state) {
      rows.set(state.deviceId, state);
    },
    async list() {
      return [...rows.values()];
    },
  };
}

function makeNewId(): () => string {
  let counter = 0;

  return () => {
    counter += 1;
    return `m-${counter}`;
  };
}

describe('syncFromStick', () => {
  it('sincroniza los registros pendientes y devuelve el resumen', async () => {
    const stores = makeInMemoryStores();
    const stick = makeFakeStick({
      chunks: [
        {
          records: [
            makeLine({ idRegistro: 1 }),
            makeLine({ idRegistro: 2 }),
            makeLine({ idRegistro: 3 }),
          ],
          lastSequence: 3,
        },
      ],
    });
    const syncState = makeFakeSyncState();

    const summary = await syncFromStick(
      { deviceId: 'stick-01' },
      { sync: stick, syncState, uow: stores.uow, clock, newId: makeNewId() },
    );

    expect(summary).toEqual({
      received: 3,
      imported: 3,
      duplicates: 0,
      conflicts: 0,
      errors: 0,
      lastConfirmedSequence: 3,
    });
    expect(await stores.measurements.list()).toHaveLength(3);
    expect(await stores.captures.findByDeviceSequence('stick-01', 3)).not.toBeNull();
    expect(stick.requests).toEqual([{ deviceId: 'stick-01', fromSequence: 1 }]);
  });

  it('reanuda desde el último id confirmado y no vuelve a pedir lo ya confirmado', async () => {
    const stores = makeInMemoryStores();
    const stick = makeFakeStick({
      chunks: [{ records: [makeLine({ idRegistro: 3 })], lastSequence: 3 }],
    });
    const syncState = makeFakeSyncState([
      { deviceId: 'stick-01', lastConfirmedSequence: 2, status: 'idle', updatedAt: clock() },
    ]);

    const summary = await syncFromStick(
      { deviceId: 'stick-01' },
      { sync: stick, syncState, uow: stores.uow, clock, newId: makeNewId() },
    );

    expect(stick.requests).toEqual([{ deviceId: 'stick-01', fromSequence: 3 }]);
    expect(summary.lastConfirmedSequence).toBe(3);
  });

  it('cuenta un id repetido como duplicado y no lo guarda dos veces', async () => {
    const stores = makeInMemoryStores();
    const stick = makeFakeStick({
      chunks: [{ records: [makeLine({ idRegistro: 1 })], lastSequence: 1 }],
    });
    const syncState = makeFakeSyncState();
    const deps = {
      sync: stick,
      syncState,
      uow: stores.uow,
      clock,
      newId: makeNewId(),
    };

    const first = await syncFromStick({ deviceId: 'stick-01' }, deps);
    const second = await syncFromStick({ deviceId: 'stick-01' }, deps);

    expect(first.imported).toBe(1);
    expect(second.imported).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(second.received).toBe(1);
    expect(await stores.measurements.list()).toHaveLength(1);
  });

  it('conserva el primero y cuenta el conflicto cuando el id llega con otro contenido', async () => {
    const stores = makeInMemoryStores();
    const syncState = makeFakeSyncState();
    const firstStick = makeFakeStick({
      chunks: [{ records: [makeLine({ idRegistro: 1, humedadPct: 38 })], lastSequence: 1 }],
    });

    await syncFromStick(
      { deviceId: 'stick-01' },
      { sync: firstStick, syncState, uow: stores.uow, clock, newId: makeNewId() },
    );

    const otherStick = makeFakeStick({
      chunks: [{ records: [makeLine({ idRegistro: 1, humedadPct: 55 })], lastSequence: 1 }],
    });

    const summary = await syncFromStick(
      { deviceId: 'stick-01' },
      { sync: otherStick, syncState, uow: stores.uow, clock, newId: makeNewId() },
    );

    expect(summary.conflicts).toBe(1);
    expect(summary.imported).toBe(0);
    expect(summary.duplicates).toBe(0);

    const stored = await stores.captures.findByDeviceSequence('stick-01', 1);
    expect(stored?.payload.humidityPct).toBe(38);
    expect(await stores.measurements.list()).toHaveLength(1);
  });

  it('confirma al bastón el último id de cada bloque y persiste el estado', async () => {
    const stores = makeInMemoryStores();
    const order: string[] = [];
    const stick = makeFakeStick({
      chunks: [
        { records: [makeLine({ idRegistro: 1 }), makeLine({ idRegistro: 2 })], lastSequence: 2 },
        { records: [makeLine({ idRegistro: 3 }), makeLine({ idRegistro: 4 })], lastSequence: 4 },
      ],
      onConfirm: () => order.push('confirm'),
    });
    const syncState = makeFakeSyncState();

    stores.onCommit(() => order.push('commit'));

    const summary = await syncFromStick(
      { deviceId: 'stick-01' },
      { sync: stick, syncState, uow: stores.uow, clock, newId: makeNewId() },
    );

    expect(stick.confirmations).toEqual([
      { deviceId: 'stick-01', lastSequence: 2 },
      { deviceId: 'stick-01', lastSequence: 4 },
    ]);
    expect(summary.lastConfirmedSequence).toBe(4);
    expect(syncState.rows.get('stick-01')).toEqual({
      deviceId: 'stick-01',
      lastConfirmedSequence: 4,
      status: 'idle',
      updatedAt: clock(),
    });

    // El commit va antes de la confirmación: el bastón no borra nada antes.
    expect(order.indexOf('confirm')).toBeGreaterThan(order.indexOf('commit'));
  });

  it('deja el estado en error cuando el bastón falla', async () => {
    const stores = makeInMemoryStores();
    const stick = makeFakeStick({ error: new Error('se cayó la conexión') });
    const syncState = makeFakeSyncState();

    await expect(
      syncFromStick(
        { deviceId: 'stick-01' },
        { sync: stick, syncState, uow: stores.uow, clock, newId: makeNewId() },
      ),
    ).rejects.toThrow('se cayó la conexión');

    expect(syncState.rows.get('stick-01')?.status).toBe('error');
    expect(stick.confirmations).toHaveLength(0);
  });

  it('cuenta una línea inválida como error sin detener la sincronización', async () => {
    const stores = makeInMemoryStores();
    const stick = makeFakeStick({
      chunks: [
        {
          records: [makeLine({ idRegistro: 1 }), '1,stick-01,2026-11-12'],
          lastSequence: 2,
        },
      ],
    });
    const syncState = makeFakeSyncState();

    const summary = await syncFromStick(
      { deviceId: 'stick-01' },
      { sync: stick, syncState, uow: stores.uow, clock, newId: makeNewId() },
    );

    expect(summary.errors).toBe(1);
    expect(summary.imported).toBe(1);
    expect(summary.received).toBe(2);
  });
});
