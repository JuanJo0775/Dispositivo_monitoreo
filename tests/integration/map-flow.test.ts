import { ingestCapture } from '@/application/capture/ingest-capture';
import { saveFarm } from '@/application/farm/save-farm';
import { savePlot } from '@/application/farm/save-plot';
import { describePlotSpace } from '@/application/map/describe-plot-space';
import { ensurePlotDiagnoses } from '@/application/map/ensure-plot-diagnoses';
import { startSession } from '@/application/session/start-session';
import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import { applyMigrations } from '@/infrastructure/db/migrations';
import { createSqliteStores } from '@/infrastructure/db/sqlite-stores';
import type { StickGateway } from '@/ports/stick-gateway';

import rawSet from '../../assets/thresholds/2026.11-v1.json';
import { makeCapture } from '../helpers/captures';
import { makeTestSqlDatabase, type TestSqlDatabase } from '../helpers/test-sql-database';

/**
 * Camino completo del mapa del lote sobre SQLite real: finca, lote y sesión,
 * capturas ingeridas como las deja la sincronización, diagnósticos que faltan,
 * y la malla que ve la persona.
 *
 * No usa dobles de los almacenes: el SQL, la migración 5, la bandera de
 * posición y los diagnósticos son los de verdad.
 */

const thresholds: ThresholdSet = parseThresholdSet(rawSet);
const clock = { now: () => '2026-11-12T18:00:00Z' };

/** Longitud del Quindío, la misma de las capturas de prueba. */
const LON = -75.6811;

/** 200 m hacia el este a esta latitud: deja la malla en tres celdas en fila. */
const DOSCIENTOS_METROS = 0.001802;

/** Bastón mínimo: la sesión necesita su firmware y escribirle la configuración. */
function makeStickGateway(): StickGateway {
  return {
    status: () => ({
      connected: true,
      deviceId: 'stick-01',
      batteryPct: 82,
      firmwareVersion: '0.1.0',
      protocolVersion: '1',
      state: 'connected',
    }),
    writeConfig: async () => undefined,
  } as unknown as StickGateway;
}

describe('mapa del lote de punta a punta', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  /**
   * Deja un lote con sesión y cuatro capturas: dos en la misma celda, una en
   * otra celda y una sin posición del GPS.
   */
  async function sembrarLote() {
    const stores = createSqliteStores(db);
    let ids = 0;
    const newId = () => {
      ids += 1;

      return `id-${ids}`;
    };

    const farm = await saveFarm(
      { name: 'Finca La Esperanza' },
      { farms: stores.farms, clock, newId },
    );
    const plot = await savePlot(
      {
        farmId: farm.id,
        name: 'Lote El Guamo',
        cropPrimary: 'cafe',
        depthCm: 20,
        cartographicUnit: 'chinchina',
        lastFertilizationDate: '2026-07-15',
      },
      { farms: stores.farms, clock, newId },
    );
    const session = await startSession(
      { plotId: plot.id, cropPrimary: 'cafe' },
      {
        farms: stores.farms,
        sessions: stores.sessions,
        settings: stores.settings,
        gateway: makeStickGateway(),
        clock,
        thresholds,
        newId,
      },
    );

    const capturas = [
      makeCapture({}, {}, 1),
      makeCapture({}, {}, 2),
      makeCapture({ longitude: LON + DOSCIENTOS_METROS }, {}, 3),
      makeCapture({ latitude: null, longitude: null }, { positionValid: false }, 4),
    ].map((capture) => ({
      ...capture,
      // El contexto real del lote y de la sesión que el bastón tenía al capturar.
      plotId: plot.id,
      configId: session.configId,
      capturedAtUtc: `2026-11-12T17:0${capture.sequence}:00Z`,
    }));

    for (const capture of capturas) {
      await ingestCapture(
        { capture, plotId: plot.id, sessionId: session.id },
        { uow: stores.uow, clock: clock.now, newId },
      );
    }

    return { stores, plot, session };
  }

  const mapaDeps = (stores: ReturnType<typeof createSqliteStores>) => ({
    farms: stores.farms,
    measurements: stores.measurements,
    diagnoses: stores.diagnoses,
  });

  const diagnosticoDeps = (stores: ReturnType<typeof createSqliteStores>) => {
    let diagnosticos = 0;

    return {
      measurements: stores.measurements,
      diagnoses: stores.diagnoses,
      sessions: stores.sessions,
      farms: stores.farms,
      thresholds,
      clock,
      newId: () => {
        diagnosticos += 1;

        return `diagnostico-${diagnosticos}`;
      },
    };
  };

  it('arma la malla con las celdas medidas y su estado', async () => {
    const { stores, plot } = await sembrarLote();

    const completados = await ensurePlotDiagnoses(plot.id, diagnosticoDeps(stores));

    // Las cuatro capturas son válidas y tienen sesión, incluida la que no trae posición:
    // el GPS no cambia el dictamen del suelo, solo lo deja fuera de la malla.
    expect(completados).toEqual({ diagnosed: 4, withoutSession: 0, invalid: 0, failed: 0 });

    const space = await describePlotSpace(plot.id, mapaDeps(stores));

    expect(space.grid).not.toBeNull();
    expect(space.cells).toHaveLength(3);

    const estados = space.cells.map((celda) => celda.verdict.state).sort();

    // Dos puntos en la celda del oeste, el del este solo, y el medio vacío.
    expect(estados).toEqual(['resumen', 'sin_dato', 'un_punto']);

    const conResumen = space.cells.find((celda) => celda.verdict.state === 'resumen');

    expect(conResumen?.measurementIds).toHaveLength(2);
    expect(conResumen?.summary.length).toBeGreaterThan(0);

    // El motor dio un rango de dos clases para cada punto; la celda conserva el
    // rango y no elige una clase por su cuenta.
    expect(conResumen?.verdict.classes).toEqual(['S1', 'S2']);
    expect(conResumen?.verdict.groups).toEqual([{ classes: ['S1', 'S2'], count: 2 }]);

    expect(space.counts).toMatchObject({
      cells: 3,
      cellsWithData: 2,
      cellsWithoutData: 1,
      points: 4,
      withPosition: 3,
      withoutPosition: 1,
      outsideArea: 0,
      invalid: 0,
      withoutDiagnosis: 0,
    });
  });

  it('el punto sin posición queda en la lista y no entra a la malla', async () => {
    const { stores, plot } = await sembrarLote();

    await ensurePlotDiagnoses(plot.id, diagnosticoDeps(stores));

    const space = await describePlotSpace(plot.id, mapaDeps(stores));
    const sinPosicion = space.points.filter((punto) => punto.position.latLon === null);

    expect(sinPosicion).toHaveLength(1);
    expect(sinPosicion[0]?.position.quality).toBe('ninguna');
    expect(sinPosicion[0]?.cellId).toBeNull();

    const idsEnCeldas = space.cells.flatMap((celda) => celda.measurementIds);

    expect(idsEnCeldas).not.toContain(sinPosicion[0]?.measurement.id);
  });

  it('completar diagnósticos es idempotente y no recalcula lo ya guardado', async () => {
    const { stores, plot } = await sembrarLote();

    await ensurePlotDiagnoses(plot.id, diagnosticoDeps(stores));

    const mediciones = await stores.measurements.list({ plotId: plot.id });
    const diagnosticos = await Promise.all(
      mediciones.map((measurement) => stores.diagnoses.listByMeasurement(measurement.id)),
    );

    expect(diagnosticos.flat()).toHaveLength(4);

    const segunda = await ensurePlotDiagnoses(plot.id, diagnosticoDeps(stores));

    expect(segunda).toEqual({ diagnosed: 0, withoutSession: 0, invalid: 0, failed: 0 });

    const diagnosticosDespues = await Promise.all(
      mediciones.map((measurement) => stores.diagnoses.listByMeasurement(measurement.id)),
    );

    expect(diagnosticosDespues.flat()).toHaveLength(4);
  });
});
