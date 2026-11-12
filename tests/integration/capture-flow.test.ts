import { ingestCapture } from '@/application/capture/ingest-capture';
import { listMeasurements } from '@/application/capture/list-measurements';
import { toCsv } from '@/application/export/export-csv';
import type { RawCapture } from '@/domain/capture/types';
import { SimulatedStickGateway } from '@/infrastructure/ble/simulated-stick-gateway';
import { applyMigrations } from '@/infrastructure/db/migrations';
import { createSqliteStores } from '@/infrastructure/db/sqlite-stores';

import { makeInMemoryStores } from '../helpers/in-memory-stores';
import { makeTestSqlDatabase } from '../helpers/test-sql-database';

describe('flujo de captura de punta a punta', () => {
  it('simulador → ingesta → historial → CSV', async () => {
    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });
    const stores = makeInMemoryStores();
    const captures: RawCapture[] = [];

    gateway.onCapture((capture) => captures.push(capture));
    await gateway.connect('stick-01');
    await gateway.requestCapture();
    await gateway.requestCapture();

    expect(captures).toHaveLength(2);

    for (const capture of captures) {
      const result = await ingestCapture(
        {
          capture,
          plotId: null,
          confirm: (sequence) => gateway.confirm(sequence),
        },
        {
          uow: stores.uow,
          clock: () => '2026-11-12T12:00:00Z',
          newId: () => `${capture.deviceId}:${capture.sequence}:medicion`,
        },
      );

      expect(result.status).toBe('saved');
    }

    const list = await listMeasurements(stores.measurements);
    const csv = toCsv(list, 'th-1', 'factory-v1');

    expect(list).toHaveLength(2);
    expect(gateway.lastConfirmedSequence()).toBe(2);
    expect(csv.trim().split('\n')).toHaveLength(3);
    expect(csv).toContain('stick-01');
    expect(csv).toContain('factory-v1');
  });

  it('las capturas siguen ahí al reabrir la app', async () => {
    const db = makeTestSqlDatabase();
    await applyMigrations(db);

    const before = createSqliteStores(db);
    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });
    const captures: RawCapture[] = [];

    gateway.onCapture((capture) => captures.push(capture));
    await gateway.connect('stick-01');
    await gateway.requestCapture();

    await ingestCapture(
      { capture: captures[0] as RawCapture, plotId: null },
      {
        uow: before.uow,
        clock: () => '2026-11-12T12:00:00Z',
        newId: () => 'medicion-1',
      },
    );

    // Nueva instancia de almacenes sobre la misma base: simula reabrir la app.
    const after = createSqliteStores(db);
    const rows = await listMeasurements(after.measurements);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('medicion-1');

    db.close();
  });
});
