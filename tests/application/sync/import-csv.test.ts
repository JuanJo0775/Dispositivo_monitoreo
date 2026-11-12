import { importCsvFromStick } from '@/application/sync/import-csv';
import { encodeRecord, RECORD_HEADERS, type StickRecord } from '@/domain/protocol/record-codec';

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

/** Arma el archivo de la microSD: el encabezado del contrato y sus filas. */
function makeCsv(rows: readonly string[]): string {
  return [RECORD_HEADERS.join(','), ...rows].join('\n');
}

function makeNewId(): () => string {
  let counter = 0;

  return () => {
    counter += 1;
    return `m-${counter}`;
  };
}

describe('importCsvFromStick', () => {
  it('importa un CSV de la microSD y guarda los registros', async () => {
    const stores = makeInMemoryStores();
    const contents = makeCsv([
      encodeRecord(makeRecord({ idRegistro: 1 })),
      encodeRecord(makeRecord({ idRegistro: 2, humedadPct: 41 })),
    ]);

    const summary = await importCsvFromStick(contents, {
      uow: stores.uow,
      clock,
      newId: makeNewId(),
    });

    expect(summary).toEqual({
      received: 2,
      imported: 2,
      duplicates: 0,
      conflicts: 0,
      errors: 0,
      lastConfirmedSequence: 2,
    });

    const measurements = await stores.measurements.list();
    expect(measurements).toHaveLength(2);

    const stored = await stores.captures.findByDeviceSequence('stick-01', 1);
    expect(stored?.payload.humidityPct).toBe(38);
    expect(stored?.origin).toBe('import');
    expect(stored?.capturedAtUtc).toBe('2026-11-12T17:05:00Z');
  });

  it('ignora las líneas repetidas', async () => {
    const stores = makeInMemoryStores();
    const line = encodeRecord(makeRecord({ idRegistro: 1 }));
    const contents = makeCsv([line, line]);
    const deps = { uow: stores.uow, clock, newId: makeNewId() };

    const summary = await importCsvFromStick(contents, deps);

    expect(summary.imported).toBe(1);
    expect(summary.duplicates).toBe(1);
    expect(summary.received).toBe(2);
    expect(await stores.measurements.list()).toHaveLength(1);
  });

  it('avisa el conflicto con el mismo id y distinto contenido y conserva el primero', async () => {
    const stores = makeInMemoryStores();
    const deps = { uow: stores.uow, clock, newId: makeNewId() };

    await importCsvFromStick(
      makeCsv([encodeRecord(makeRecord({ idRegistro: 1, humedadPct: 38 }))]),
      deps,
    );

    const summary = await importCsvFromStick(
      makeCsv([encodeRecord(makeRecord({ idRegistro: 1, humedadPct: 55 }))]),
      deps,
    );

    expect(summary.conflicts).toBe(1);
    expect(summary.imported).toBe(0);
    expect(summary.duplicates).toBe(0);

    const stored = await stores.captures.findByDeviceSequence('stick-01', 1);
    expect(stored?.payload.humidityPct).toBe(38);
    expect(await stores.measurements.list()).toHaveLength(1);
  });

  it('cuenta una línea inválida como error y no detiene la importación', async () => {
    const stores = makeInMemoryStores();
    const contents = makeCsv([
      encodeRecord(makeRecord({ idRegistro: 1 })),
      '2,stick-01,2026-11-12',
      encodeRecord(makeRecord({ idRegistro: 3 })),
    ]);

    const summary = await importCsvFromStick(contents, {
      uow: stores.uow,
      clock,
      newId: makeNewId(),
    });

    expect(summary.errors).toBe(1);
    expect(summary.imported).toBe(2);
    expect(summary.received).toBe(3);
    expect(await stores.measurements.list()).toHaveLength(2);
  });

  it('no falla con un CSV vacío', async () => {
    const stores = makeInMemoryStores();

    const summary = await importCsvFromStick('', {
      uow: stores.uow,
      clock,
      newId: makeNewId(),
    });

    expect(summary).toEqual({
      received: 0,
      imported: 0,
      duplicates: 0,
      conflicts: 0,
      errors: 0,
      lastConfirmedSequence: 0,
    });
    expect(await stores.measurements.list()).toHaveLength(0);
  });
});
