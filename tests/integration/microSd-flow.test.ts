import { importCsvFromStick } from '@/application/sync/import-csv';
import { listMeasurements } from '@/application/capture/list-measurements';
import { applyMigrations } from '@/infrastructure/db/migrations';
import { createSqliteStores } from '@/infrastructure/db/sqlite-stores';

import { makeTestSqlDatabase, type TestSqlDatabase } from '../helpers/test-sql-database';

/**
 * Flujo de la microSD sobre SQLite real: se importa el archivo del bastón, se
 * comprueba que los registros quedan guardados y que una segunda pasada no
 * duplica nada.
 */

const ENCABEZADO =
  'id_registro,device_id,fecha,hora_utc,lat,lon,alt_m,vel_kmh,sats,hdop,edad_fix_s,prof_cm,' +
  'config_id,cultivo,lote_id,fert_fecha,humedad_pct,temp_c,ph,ce_uscm,n_mgkg,p_mgkg,k_mgkg,' +
  'banderas,bat_pct,fw_ver';

const REGISTRO_1 =
  '1,stick-01,2026-11-12,17:05:00,4.533900,-75.681100,1550,0.4,9,0.9,1.2,20,1,cafe,lote-1,' +
  '2026-07-15,38,21.5,5.4,120,12,18,95,31,82,0.1.0';

const REGISTRO_2 =
  '2,stick-01,2026-11-12,17:06:00,4.533900,-75.681100,1550,0.4,9,0.9,1.2,20,1,cafe,lote-1,' +
  '2026-07-15,36,21.4,5.3,125,12,19,90,31,81,0.1.0';

/** Identificador único por medición, como en la app real. */
function makeIds(): () => string {
  let contador = 0;

  return () => {
    contador += 1;

    return `m-${contador}`;
  };
}

describe('flujo de la microSD sobre SQLite real', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('importa el archivo del bastón y guarda cada registro', async () => {
    const stores = createSqliteStores(db);
    const resumen = await importCsvFromStick([ENCABEZADO, REGISTRO_1, REGISTRO_2].join('\n'), {
      uow: stores.uow,
      clock: () => '2026-11-12T17:10:00Z',
      newId: makeIds(),
    });

    expect(resumen.imported).toBe(2);
    expect(resumen.errors).toBe(0);

    const mediciones = await listMeasurements(stores.measurements);

    expect(mediciones).toHaveLength(2);
    expect(mediciones[0]?.payload.humidityPct).toBe(36);
    expect(mediciones[1]?.payload.humidityPct).toBe(38);
  });

  it('no duplica al importar dos veces el mismo archivo', async () => {
    const stores = createSqliteStores(db);
    const archivo = [ENCABEZADO, REGISTRO_1, REGISTRO_2].join('\n');
    const deps = {
      uow: stores.uow,
      clock: () => '2026-11-12T17:10:00Z',
      newId: makeIds(),
    };

    await importCsvFromStick(archivo, deps);
    const segunda = await importCsvFromStick(archivo, deps);

    expect(segunda.imported).toBe(0);
    expect(segunda.duplicates).toBe(2);
    expect(await listMeasurements(stores.measurements)).toHaveLength(2);
  });

  it('conserva el primero y avisa el conflicto cuando el mismo id trae otro contenido', async () => {
    const stores = createSqliteStores(db);
    const deps = {
      uow: stores.uow,
      clock: () => '2026-11-12T17:10:00Z',
      newId: makeIds(),
    };

    await importCsvFromStick([ENCABEZADO, REGISTRO_1].join('\n'), deps);

    const alterado = REGISTRO_1.replace(',38,21.5,', ',44,21.5,');
    const segunda = await importCsvFromStick([ENCABEZADO, alterado].join('\n'), deps);

    expect(segunda.conflicts).toBe(1);
    expect(segunda.imported).toBe(0);

    const mediciones = await listMeasurements(stores.measurements);

    expect(mediciones).toHaveLength(1);
    expect(mediciones[0]?.payload.humidityPct).toBe(38);
  });
});
