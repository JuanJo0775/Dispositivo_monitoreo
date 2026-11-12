import type { DiagnosisResult } from '@/domain/diagnosis/types';
import type { Farm, Plot } from '@/domain/farm/types';
import type { StoredDiagnosis } from '@/ports/stores/diagnosis-store';
import type { Session } from '@/ports/stores/session-store';
import { applyMigrations, MIGRATIONS } from '@/infrastructure/db/migrations';
import { createSqliteStores } from '@/infrastructure/db/sqlite-stores';

import { makeCapture } from '../../helpers/captures';
import { makeMeasurement } from '../../helpers/measurements';
import { makeTestSqlDatabase, type TestSqlDatabase } from '../../helpers/test-sql-database';

describe('almacenes SQLite', () => {
  let db: TestSqlDatabase;

  async function seedPlots(): Promise<void> {
    await db.runAsync('INSERT INTO farms (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [
      'farm-1',
      'Finca El Roble',
      '2026-11-01T00:00:00Z',
      '2026-11-01T00:00:00Z',
    ]);

    for (const plotId of ['plot-1', 'plot-2']) {
      await db.runAsync(
        'INSERT INTO plots (id, farm_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [plotId, 'farm-1', `Lote ${plotId}`, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z'],
      );
    }
  }

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);
    await seedPlots();
  });

  afterEach(() => {
    db.close();
  });

  it('crea el esquema y no reaplica migraciones', async () => {
    await expect(applyMigrations(db)).resolves.toBe(0);

    const row = await db.getFirstAsync<{ version: number }>(
      'SELECT MAX(version) AS version FROM schema_migrations',
    );
    expect(row?.version).toBe(MIGRATIONS.length);
  });

  it('guarda y recupera una captura con su payload y banderas intactos', async () => {
    const stores = createSqliteStores(db);
    const capture = makeCapture({ humidityPct: 41, ph: null }, { simulated: true });

    await stores.captures.insertRaw(capture);
    const stored = await stores.captures.findByDeviceSequence('stick-01', 1);

    expect(stored).toEqual(capture);
  });

  it('rechaza una captura duplicada por device_id y sequence', async () => {
    const stores = createSqliteStores(db);

    await stores.captures.insertRaw(makeCapture());
    await expect(stores.captures.insertRaw(makeCapture())).rejects.toThrow();
  });

  it('guarda una medición con nulos, la lista y la recupera', async () => {
    const stores = createSqliteStores(db);
    const measurement = makeMeasurement({ humidityPct: null }, { notes: null, photoPath: null });

    await stores.measurements.insert(measurement);

    expect(await stores.measurements.get(measurement.id)).toEqual(measurement);
    expect(await stores.measurements.list()).toEqual([measurement]);
  });

  it('excluye descartadas y filtra por lote al listar', async () => {
    const stores = createSqliteStores(db);

    await stores.measurements.insert(
      makeMeasurement({}, { id: 'm-1', captureId: 'stick-01:1', plotId: 'plot-1' }),
    );
    await stores.measurements.insert(
      makeMeasurement({}, { id: 'm-2', captureId: 'stick-01:2', plotId: 'plot-2' }),
    );
    await stores.measurements.insert(
      makeMeasurement(
        {},
        {
          id: 'm-3',
          captureId: 'stick-01:3',
          plotId: 'plot-1',
          discardedAt: '2026-11-12T18:00:00Z',
        },
      ),
    );

    const plotOne = await stores.measurements.list({ plotId: 'plot-1' });
    const withDiscarded = await stores.measurements.list({ includeDiscarded: true });

    expect(plotOne.map((row) => row.id)).toEqual(['m-1']);
    expect(withDiscarded).toHaveLength(3);
  });

  it('hace rollback completo cuando falla la transacción', async () => {
    const stores = createSqliteStores(db);

    await expect(
      stores.uow.run(async (tx) => {
        await tx.captures.insertRaw(makeCapture());
        await tx.measurements.insert(makeMeasurement());
        throw new Error('fallo simulado');
      }),
    ).rejects.toThrow('fallo simulado');

    expect(await stores.captures.findByDeviceSequence('stick-01', 1)).toBeNull();
    expect(await stores.measurements.list()).toEqual([]);
  });

  it('devuelve el resultado de la transacción cuando todo sale bien', async () => {
    const stores = createSqliteStores(db);

    const result = await stores.uow.run(async (tx) => {
      await tx.captures.insertRaw(makeCapture());
      return 'ok';
    });

    expect(result).toBe('ok');
  });
});

function makeFarm(overrides: Partial<Farm> = {}): Farm {
  return {
    id: 'farm-1',
    name: 'Finca El Roble',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

function makePlot(overrides: Partial<Plot> = {}): Plot {
  return {
    id: 'plot-1',
    farmId: 'farm-1',
    name: 'Lote El Guamo',
    cropPrimary: 'cafe',
    cropSecondary: null,
    depthCm: 20,
    cartographicUnit: 'chinchina',
    lastFertilizationDate: '2026-07-15',
    drainage: 'bien_drenado',
    shading: null,
    density: null,
    plantingDensityHa: 1800,
    altitudeM: 1550,
    slope: null,
    notes: null,
    deletedAt: null,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    plotId: 'plot-1',
    configId: 1,
    cropPrimary: 'cafe',
    cropSecondary: null,
    depthCm: 20,
    cartographicUnit: 'chinchina',
    lastFertilizationDate: '2026-07-15',
    thresholdsVersion: '2026.11-v1',
    firmwareVersion: '0.1.0',
    sentAt: '2026-11-12T16:50:00Z',
    acceptedAt: null,
    status: 'sent',
    ...overrides,
  };
}

function makeDiagnosisResult(overrides: Partial<DiagnosisResult> = {}): DiagnosisResult {
  return {
    validity: 'valid',
    classes: ['S1'],
    index: { minimum: 0.82, parametric: 0.77 },
    perVariable: [
      {
        variable: 'humidity',
        role: 'verdict',
        status: 'class',
        value: 38,
        unit: '% v/v',
        uncertainty: 0.76,
        class: 'S1',
        possibleClasses: ['S1'],
        band: 'en banda sin estrés',
        possibleBands: [],
        suitability: 0.82,
        suitabilityInterval: { lower: 0.78, upper: 0.86 },
        confidence: 'alta',
        reference: 'Banda sin estrés 40,2 a 48,3 % v/v (Chinchiná)',
        method: null,
        reason: null,
      },
      {
        variable: 'ph',
        role: 'verdict',
        status: 'interval',
        value: 5.4,
        unit: 'adimensional',
        uncertainty: 0.3,
        class: null,
        possibleClasses: ['S1', 'S2', 'S3', 'N'],
        band: 'en banda óptima',
        possibleBands: [],
        suitability: 1,
        suitabilityInterval: { lower: 0, upper: 1 },
        confidence: 'media',
        reference: 'Banda óptima 5,0 a 5,5',
        method: null,
        reason: null,
      },
    ],
    limitingFactors: [{ variable: 'humidity', suitability: 0.82, class: 'S1' }],
    alerts: [
      {
        code: 'ce_sobre_umbral',
        severity: 'warning',
        message: 'La conductividad supera el umbral del cultivo.',
      },
    ],
    evidence: {
      thresholdsVersion: '2026.11-v1',
      crop: 'cafe',
      cartographicUnit: 'chinchina',
      rules: ['validez_del_dato', 'ley_del_minimo'],
      assumptions: ['humedad_limites_fisicos'],
      missing: ['umbral de seguridad de CE para el enclavamiento'],
      sources: ['Objetivo 1 v2 (agosto 2026)'],
    },
    versions: {
      engine: 'engine-v1',
      thresholds: '2026.11-v1',
      calibration: 'factory-v1',
      firmware: '0.1.0',
    },
    explanation: 'El suelo es apto para Café.',
    ...overrides,
  };
}

function makeDiagnosis(overrides: Partial<StoredDiagnosis> = {}): StoredDiagnosis {
  const result = overrides.result ?? makeDiagnosisResult();

  return {
    id: 'diag-1',
    measurementId: 'm-1',
    engineVersion: result.versions.engine,
    thresholdsVersion: result.versions.thresholds,
    calibrationVersion: result.versions.calibration,
    firmwareVersion: result.versions.firmware,
    contextSnapshot: { crop: 'cafe', cartographicUnit: 'chinchina', depthCm: 20 },
    result,
    explanation: result.explanation,
    createdAt: '2026-11-12T17:06:00Z',
    ...overrides,
  };
}

describe('almacenes SQLite de fincas y lotes', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('guarda una finca y la recupera', async () => {
    const stores = createSqliteStores(db);
    const farm = makeFarm();

    await stores.farms.insertFarm(farm);

    expect(await stores.farms.getFarm(farm.id)).toEqual(farm);
  });

  it('lista las fincas ordenadas por nombre', async () => {
    const stores = createSqliteStores(db);

    await stores.farms.insertFarm(makeFarm({ id: 'farm-3', name: 'Cacao' }));
    await stores.farms.insertFarm(makeFarm({ id: 'farm-1', name: 'Almendro' }));
    await stores.farms.insertFarm(makeFarm({ id: 'farm-2', name: 'Zapote' }));

    const names = (await stores.farms.listFarms()).map((farm) => farm.name);

    expect(names).toEqual(['Almendro', 'Cacao', 'Zapote']);
  });

  it('actualiza el nombre de una finca', async () => {
    const stores = createSqliteStores(db);

    await stores.farms.insertFarm(makeFarm());
    await stores.farms.updateFarm(
      makeFarm({ name: 'Finca El Cedro', updatedAt: '2026-11-20T10:00:00Z' }),
    );

    expect(await stores.farms.getFarm('farm-1')).toEqual(
      makeFarm({ name: 'Finca El Cedro', updatedAt: '2026-11-20T10:00:00Z' }),
    );
  });

  it('guarda un lote con su unidad cartográfica y su densidad de siembra', async () => {
    const stores = createSqliteStores(db);
    const plot = makePlot();

    await stores.farms.insertFarm(makeFarm());
    await stores.farms.insertPlot(plot);

    expect(await stores.farms.getPlot(plot.id)).toEqual(plot);
  });

  it('filtra los lotes por finca', async () => {
    const stores = createSqliteStores(db);

    await stores.farms.insertFarm(makeFarm({ id: 'farm-1' }));
    await stores.farms.insertFarm(makeFarm({ id: 'farm-2' }));
    await stores.farms.insertPlot(makePlot({ id: 'plot-1', farmId: 'farm-1' }));
    await stores.farms.insertPlot(makePlot({ id: 'plot-2', farmId: 'farm-2' }));

    const deLaFinca = await stores.farms.listPlots('farm-1');
    const deTodas = await stores.farms.listPlots(null);

    expect(deLaFinca.map((plot) => plot.id)).toEqual(['plot-1']);
    expect(deTodas.map((plot) => plot.id)).toEqual(['plot-1', 'plot-2']);
  });

  it('excluye los lotes borrados lógicamente', async () => {
    const stores = createSqliteStores(db);

    await stores.farms.insertFarm(makeFarm());
    await stores.farms.insertPlot(makePlot({ id: 'plot-1' }));
    await stores.farms.insertPlot(makePlot({ id: 'plot-2' }));
    await stores.farms.updatePlot(makePlot({ id: 'plot-2', deletedAt: '2026-11-20T09:00:00Z' }));

    expect((await stores.farms.listPlots('farm-1')).map((plot) => plot.id)).toEqual(['plot-1']);
  });

  it('devuelve null al pedir un lote borrado lógicamente', async () => {
    const stores = createSqliteStores(db);

    await stores.farms.insertFarm(makeFarm());
    await stores.farms.insertPlot(makePlot());
    await stores.farms.updatePlot(makePlot({ deletedAt: '2026-11-20T09:00:00Z' }));

    expect(await stores.farms.getPlot('plot-1')).toBeNull();
  });

  it('rechaza un lote de una finca que no existe', async () => {
    const stores = createSqliteStores(db);

    await expect(
      stores.farms.insertPlot(makePlot({ farmId: 'farm-inexistente' })),
    ).rejects.toThrow();
  });
});

describe('almacenes SQLite de sesiones', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);

    const stores = createSqliteStores(db);
    await stores.farms.insertFarm(makeFarm());
    await stores.farms.insertPlot(makePlot());
  });

  afterEach(() => {
    db.close();
  });

  it('guarda una sesión y la recupera por su config_id', async () => {
    const stores = createSqliteStores(db);
    const session = makeSession();

    await stores.sessions.insert(session);

    expect(await stores.sessions.get(session.id)).toEqual(session);
    expect(await stores.sessions.findByConfigId(session.configId)).toEqual(session);
  });

  it('mapea el estado de la sesión a los valores del puerto', async () => {
    const stores = createSqliteStores(db);

    await stores.sessions.insert(makeSession({ id: 'session-1', configId: 1, status: 'sent' }));
    await stores.sessions.insert(
      makeSession({
        id: 'session-2',
        configId: 2,
        status: 'accepted',
        acceptedAt: '2026-11-12T17:00:00Z',
      }),
    );
    await stores.sessions.insert(makeSession({ id: 'session-3', configId: 3, status: 'expired' }));

    const statuses = (await stores.sessions.listByPlot('plot-1')).map((session) => session.status);

    expect(statuses).toContain('sent');
    expect(statuses).toContain('accepted');
    expect(statuses).toContain('expired');
  });

  it('lista las sesiones del lote de la más reciente a la más antigua', async () => {
    const stores = createSqliteStores(db);

    await stores.sessions.insert(
      makeSession({ id: 'session-1', configId: 1, sentAt: '2026-11-12T10:00:00Z' }),
    );
    await stores.sessions.insert(
      makeSession({ id: 'session-2', configId: 2, sentAt: '2026-11-12T18:00:00Z' }),
    );
    await stores.sessions.insert(
      makeSession({ id: 'session-3', configId: 3, sentAt: '2026-11-12T14:00:00Z' }),
    );

    const sesiones = await stores.sessions.listByPlot('plot-1');

    expect(sesiones.map((session) => session.id)).toEqual(['session-2', 'session-3', 'session-1']);
  });

  it('rechaza dos sesiones con el mismo config_id', async () => {
    const stores = createSqliteStores(db);

    await stores.sessions.insert(makeSession({ id: 'session-1', configId: 7 }));

    await expect(
      stores.sessions.insert(makeSession({ id: 'session-2', configId: 7 })),
    ).rejects.toThrow();
  });
});

describe('almacenes SQLite de diagnósticos', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);

    const stores = createSqliteStores(db);
    await stores.measurements.insert(makeMeasurement({}, { id: 'm-1', plotId: null }));
  });

  afterEach(() => {
    db.close();
  });

  it('guarda un diagnóstico y recupera el resultado completo', async () => {
    const stores = createSqliteStores(db);
    const diagnosis = makeDiagnosis();

    await stores.diagnoses.insert(diagnosis);

    const stored = await stores.diagnoses.get(diagnosis.id);

    expect(stored?.result).toEqual(diagnosis.result);
    expect(stored?.contextSnapshot).toEqual(diagnosis.contextSnapshot);
    expect(stored?.engineVersion).toBe('engine-v1');
    expect(stored?.thresholdsVersion).toBe('2026.11-v1');
    expect(stored?.calibrationVersion).toBe('factory-v1');
    expect(stored?.firmwareVersion).toBe('0.1.0');
    expect(stored?.explanation).toBe(diagnosis.result.explanation);
    expect(stored?.createdAt).toBe('2026-11-12T17:06:00Z');
  });

  it('parte el resultado en las columnas del diagnóstico', async () => {
    const stores = createSqliteStores(db);

    await stores.diagnoses.insert(makeDiagnosis());

    const row = await db.getFirstAsync<{
      classes_json: string;
      limiting_factors_json: string;
      alerts_json: string;
      evidence_json: string;
      uncertainty_json: string;
      variables_json: string;
    }>(
      'SELECT classes_json, limiting_factors_json, alerts_json, evidence_json, uncertainty_json, variables_json FROM diagnoses WHERE id = ?',
      ['diag-1'],
    );

    expect(JSON.parse(row?.classes_json ?? '[]')).toEqual(['S1']);
    expect(JSON.parse(row?.limiting_factors_json ?? '[]')).toEqual([
      { variable: 'humidity', suitability: 0.82, class: 'S1' },
    ]);
    expect(JSON.parse(row?.alerts_json ?? '[]')).toHaveLength(1);
    expect(JSON.parse(row?.evidence_json ?? '{}')).toMatchObject({ crop: 'cafe' });
    expect(JSON.parse(row?.uncertainty_json ?? '[]')).toEqual([
      {
        variable: 'humidity',
        uncertainty: 0.76,
        suitabilityInterval: { lower: 0.78, upper: 0.86 },
      },
      { variable: 'ph', uncertainty: 0.3, suitabilityInterval: { lower: 0, upper: 1 } },
    ]);
    expect(JSON.parse(row?.variables_json ?? '[]')).toHaveLength(2);
  });

  it('recupera un diagnóstico bloqueado con su validez y sus alertas', async () => {
    const stores = createSqliteStores(db);
    const result = makeDiagnosisResult({
      validity: 'blocked',
      classes: [],
      index: { minimum: 0, parametric: null },
      limitingFactors: [],
      alerts: [
        {
          code: 'altitud_fuera_de_franja',
          severity: 'blocking',
          message: 'La altitud del lote está fuera de la franja del cultivo.',
        },
      ],
    });
    const diagnosis = makeDiagnosis({ id: 'diag-bloqueado', result });

    await stores.diagnoses.insert(diagnosis);

    const stored = await stores.diagnoses.get(diagnosis.id);

    expect(stored?.result.validity).toBe('blocked');
    expect(stored?.result.classes).toEqual([]);
    expect(stored?.result.alerts[0]?.severity).toBe('blocking');
  });

  it('lista los diagnósticos de una medición del más antiguo al más reciente', async () => {
    const stores = createSqliteStores(db);

    await stores.diagnoses.insert(
      makeDiagnosis({ id: 'diag-1', createdAt: '2026-11-12T17:06:00Z' }),
    );
    await stores.diagnoses.insert(
      makeDiagnosis({ id: 'diag-2', createdAt: '2026-11-12T19:06:00Z' }),
    );

    const diagnosticos = await stores.diagnoses.listByMeasurement('m-1');

    expect(diagnosticos.map((diagnostico) => diagnostico.id)).toEqual(['diag-1', 'diag-2']);
  });

  it('rechaza un diagnóstico de una medición que no existe', async () => {
    const stores = createSqliteStores(db);

    await expect(
      stores.diagnoses.insert(makeDiagnosis({ measurementId: 'm-inexistente' })),
    ).rejects.toThrow();
  });
});

describe('almacenes SQLite de ajustes', () => {
  let db: TestSqlDatabase;

  beforeEach(async () => {
    db = makeTestSqlDatabase();
    await applyMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('guarda un ajuste y lo lee', async () => {
    const stores = createSqliteStores(db);

    await stores.settings.set('trial_mode', 'true');

    expect(await stores.settings.get('trial_mode')).toBe('true');
  });

  it('deja el último valor cuando se escribe dos veces la misma clave', async () => {
    const stores = createSqliteStores(db);

    await stores.settings.set('trial_mode', 'true');
    await stores.settings.set('trial_mode', 'false');

    expect(await stores.settings.get('trial_mode')).toBe('false');
  });

  it('devuelve null cuando el ajuste no existe', async () => {
    const stores = createSqliteStores(db);

    expect(await stores.settings.get('privacy_notice_ack')).toBeNull();
  });

  it('lista todos los ajustes', async () => {
    const stores = createSqliteStores(db);

    await stores.settings.set('trial_mode', 'false');
    await stores.settings.set('privacy_notice_ack', '2026-11-12T17:06:00Z');

    expect(await stores.settings.list()).toEqual({
      trial_mode: 'false',
      privacy_notice_ack: '2026-11-12T17:06:00Z',
    });
  });
});
