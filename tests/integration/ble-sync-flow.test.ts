import { listMeasurements } from '@/application/capture/list-measurements';
import { syncFromStick } from '@/application/sync/sync-from-stick';
import { BleStickGateway } from '@/infrastructure/ble/ble-stick-gateway';
import { makeFakeBleTransport } from '@/infrastructure/ble/fake-ble-transport';
import {
  DEFAULT_SIMULATED_PIN,
  DEFAULT_SIMULATED_SALT,
  SimulatedStickDevice,
} from '@/infrastructure/ble/simulated-stick-device';
import { applyMigrations } from '@/infrastructure/db/migrations';
import { createSqliteStores } from '@/infrastructure/db/sqlite-stores';

import { makeTestSqlDatabase, type TestSqlDatabase } from '../helpers/test-sql-database';

/**
 * Flujo completo del corte 2 sobre SQLite real: el bastón simulado habla el
 * protocolo BLE, la app sincroniza los registros de la microSD, los guarda y
 * reanuda donde quedó.
 */

const ENCABEZADO =
  'id_registro,device_id,fecha,hora_utc,lat,lon,alt_m,vel_kmh,sats,hdop,edad_fix_s,prof_cm,' +
  'config_id,cultivo,lote_id,fert_fecha,humedad_pct,temp_c,ph,ce_uscm,n_mgkg,p_mgkg,k_mgkg,' +
  'banderas,bat_pct,fw_ver';

function registro(id: number, humedad: number): string {
  return (
    `${id},stick-01,2026-11-12,17:0${id}:00,4.533900,-75.681100,1550,0.4,9,0.9,1.2,20,1,cafe,lote-1,` +
    `2026-07-15,${humedad},21.5,5.4,120,12,18,95,31,82,0.1.0`
  );
}

describe('sincronización BLE de punta a punta', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('sincroniza la microSD del bastón y guarda cada registro', async () => {
    const device = new SimulatedStickDevice({ pin: DEFAULT_SIMULATED_PIN });
    device.seedCsv([ENCABEZADO, registro(1, 38), registro(2, 36)].join('\n'));

    const gateway = new BleStickGateway(makeFakeBleTransport(device), {
      pin: DEFAULT_SIMULATED_PIN,
      salt: DEFAULT_SIMULATED_SALT,
    });
    const stores = createSqliteStores(db);

    await gateway.connect(device.deviceId);

    const resumen = await syncFromStick(
      { deviceId: device.deviceId },
      {
        sync: gateway,
        syncState: stores.syncState,
        uow: stores.uow,
        clock: () => '2026-11-12T17:10:00Z',
        newId: (() => {
          let contador = 0;

          return () => {
            contador += 1;

            return `m-${contador}`;
          };
        })(),
      },
    );

    expect(resumen.imported).toBe(2);
    expect(resumen.errors).toBe(0);

    const mediciones = await listMeasurements(stores.measurements);

    expect(mediciones).toHaveLength(2);
    expect(mediciones.map((m) => m.payload.humidityPct).sort()).toEqual([36, 38]);

    // El bastón ya sabe qué se le confirmó y la app lo tiene persistido.
    expect(device.lastConfirmedSequence()).toBe(2);

    const estado = await stores.syncState.get(device.deviceId);

    expect(estado?.lastConfirmedSequence).toBe(2);
    expect(estado?.status).toBe('idle');
  });

  it('reanuda donde quedó y no duplica al sincronizar otra vez', async () => {
    const device = new SimulatedStickDevice({ pin: DEFAULT_SIMULATED_PIN });
    device.seedCsv([ENCABEZADO, registro(1, 38), registro(2, 36)].join('\n'));

    const gateway = new BleStickGateway(makeFakeBleTransport(device), {
      pin: DEFAULT_SIMULATED_PIN,
      salt: DEFAULT_SIMULATED_SALT,
    });
    const stores = createSqliteStores(db);

    await gateway.connect(device.deviceId);

    const deps = {
      sync: gateway,
      syncState: stores.syncState,
      uow: stores.uow,
      clock: () => '2026-11-12T17:10:00Z',
      newId: (() => {
        let contador = 0;

        return () => {
          contador += 1;

          return `m-${contador}`;
        };
      })(),
    };

    await syncFromStick({ deviceId: device.deviceId }, deps);

    // Nueva instancia de almacenes: simula reabrir la app.
    const despues = createSqliteStores(db);
    const segunda = await syncFromStick(
      { deviceId: device.deviceId },
      { ...deps, uow: despues.uow },
    );

    expect(segunda.imported).toBe(0);
    expect(await listMeasurements(despues.measurements)).toHaveLength(2);
  });
});
