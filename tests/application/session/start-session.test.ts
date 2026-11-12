import { NEXT_CONFIG_ID_KEY, startSession } from '@/application/session/start-session';
import { parseThresholdSet, type ThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { Plot } from '@/domain/farm/types';
import type { SessionConfig } from '@/domain/session/types';
import type { Clock } from '@/ports/clock';
import type { SettingsStore } from '@/ports/stores/settings-store';
import type { StickGateway, StickStatus } from '@/ports/stick-gateway';

import { makeInMemoryFarmStore } from '../../helpers/in-memory-farm-store';
import { makeInMemorySessionStore } from '../../helpers/in-memory-session-store';

const AHORA = '2026-11-12T15:00:00Z';
const VERSION_UMBRALES = '2026.11-pruebas';

function relojFijo(): Clock {
  return { now: () => AHORA };
}

function setDeUmbrales(): ThresholdSet {
  return parseThresholdSet({
    schemaVersion: 1,
    version: VERSION_UMBRALES,
    source: 'pruebas',
    crops: {
      cafe: {
        label: 'Café',
        depletionFraction: 0.33,
        rootDepthM: [0, 0.9],
        variables: {},
      },
    },
    cartographicUnits: {},
    sampling: { depthCm: 20, minSubsamples: 15, maxSubsamples: 20, pattern: 'zigzag' },
    alerts: [],
  });
}

function ajustesEnMemoria(): { store: SettingsStore; valores: Record<string, string> } {
  const valores: Record<string, string> = {};

  const store: SettingsStore = {
    async get(key) {
      return valores[key] ?? null;
    },
    async set(key, value) {
      valores[key] = value;
    },
    async list() {
      return { ...valores };
    },
  };

  return { store, valores };
}

const ESTADO_CONECTADO: StickStatus = {
  connected: true,
  deviceId: 'stick-01',
  batteryPct: 80,
  firmwareVersion: '0.1.0',
  protocolVersion: '0.1',
};

interface GatewayFalso {
  readonly gateway: StickGateway;
  readonly configs: SessionConfig[];
  readonly writeConfig: jest.Mock;
}

function gatewayFalso(antesDeEscribir?: () => void): GatewayFalso {
  const configs: SessionConfig[] = [];
  const writeConfig = jest.fn(async (config: SessionConfig) => {
    antesDeEscribir?.();
    configs.push(config);
  });

  const gateway: StickGateway = {
    connect: async () => undefined,
    disconnect: async () => undefined,
    status: () => ESTADO_CONECTADO,
    onCapture: () => () => undefined,
    onStatus: () => () => undefined,
    requestCapture: async () => undefined,
    confirm: async () => undefined,
    writeConfig,
  };

  return { gateway, configs, writeConfig };
}

function loteSembrado(overrides: Partial<Plot> = {}): Plot {
  return {
    id: 'plot-1',
    farmId: 'farm-1',
    name: 'Lote El Guamo',
    cropPrimary: 'cafe',
    cropSecondary: null,
    depthCm: 20,
    cartographicUnit: 'chinchina',
    lastFertilizationDate: null,
    drainage: 'bien_drenado',
    shading: null,
    density: null,
    plantingDensityHa: null,
    altitudeM: 1600,
    slope: null,
    notes: null,
    deletedAt: null,
    createdAt: '2026-01-06T08:00:00Z',
    updatedAt: '2026-01-06T08:00:00Z',
    ...overrides,
  };
}

describe('startSession', () => {
  it('crea la sesión, la guarda y escribe el bloque de configuración al bastón', async () => {
    const fincas = makeInMemoryFarmStore({ plots: [loteSembrado()] });
    const sesiones = makeInMemorySessionStore();
    const { store: ajustes, valores } = ajustesEnMemoria();
    const { gateway, configs, writeConfig } = gatewayFalso();

    const sesion = await startSession(
      { plotId: 'plot-1', cropPrimary: 'cafe' },
      {
        farms: fincas.farms,
        sessions: sesiones.sessions,
        settings: ajustes,
        gateway,
        clock: relojFijo(),
        thresholds: setDeUmbrales(),
        newId: () => 'session-1',
      },
    );

    expect(sesion).toEqual({
      id: 'session-1',
      plotId: 'plot-1',
      configId: 1,
      cropPrimary: 'cafe',
      cropSecondary: null,
      depthCm: 20,
      cartographicUnit: 'chinchina',
      lastFertilizationDate: null,
      thresholdsVersion: VERSION_UMBRALES,
      firmwareVersion: '0.1.0',
      sentAt: AHORA,
      acceptedAt: null,
      status: 'sent',
    });
    expect(sesiones.sessionRows).toEqual([sesion]);
    expect(writeConfig).toHaveBeenCalledTimes(1);
    expect(configs[0]).toEqual({
      configId: 1,
      plotId: 'plot-1',
      cropPrimary: 'cafe',
      cropSecondary: null,
      depthCm: 20,
      cartographicUnit: 'chinchina',
      lastFertilizationDate: null,
      thresholdsVersion: VERSION_UMBRALES,
      createdAtUtc: AHORA,
    });
    expect(valores[NEXT_CONFIG_ID_KEY]).toBe('2');
  });

  it('usa el config_id siguiente en la segunda sesión', async () => {
    const fincas = makeInMemoryFarmStore({ plots: [loteSembrado()] });
    const sesiones = makeInMemorySessionStore();
    const { store: ajustes } = ajustesEnMemoria();
    const { gateway } = gatewayFalso();

    const deps = {
      farms: fincas.farms,
      sessions: sesiones.sessions,
      settings: ajustes,
      gateway,
      clock: relojFijo(),
      thresholds: setDeUmbrales(),
      newId: () => 'session-1',
    };

    const primera = await startSession({ plotId: 'plot-1', cropPrimary: 'cafe' }, deps);
    const segunda = await startSession({ plotId: 'plot-1', cropPrimary: 'cafe' }, deps);

    expect(primera.configId).toBe(1);
    expect(segunda.configId).toBe(2);
    expect(sesiones.sessionRows.map((row) => row.configId)).toEqual([1, 2]);
  });

  it('guarda la sesión antes de escribir al bastón', async () => {
    const fincas = makeInMemoryFarmStore({ plots: [loteSembrado()] });
    const sesiones = makeInMemorySessionStore();
    const { store: ajustes } = ajustesEnMemoria();
    const filasAlEscribir: number[] = [];
    const { gateway } = gatewayFalso(() => filasAlEscribir.push(sesiones.sessionRows.length));

    await startSession(
      { plotId: 'plot-1', cropPrimary: 'cafe' },
      {
        farms: fincas.farms,
        sessions: sesiones.sessions,
        settings: ajustes,
        gateway,
        clock: relojFijo(),
        thresholds: setDeUmbrales(),
        newId: () => 'session-1',
      },
    );

    expect(filasAlEscribir).toEqual([1]);
  });

  it('toma la profundidad del lote y la de diagnóstico por defecto', async () => {
    const fincas = makeInMemoryFarmStore({
      plots: [loteSembrado({ depthCm: 30 }), loteSembrado({ id: 'plot-2', depthCm: null })],
    });
    const sesiones = makeInMemorySessionStore();
    const { store: ajustes } = ajustesEnMemoria();
    const { gateway } = gatewayFalso();

    const deps = {
      farms: fincas.farms,
      sessions: sesiones.sessions,
      settings: ajustes,
      gateway,
      clock: relojFijo(),
      thresholds: setDeUmbrales(),
      newId: () => 'session-1',
    };

    const conProfundidad = await startSession({ plotId: 'plot-1', cropPrimary: 'cafe' }, deps);
    const sinProfundidad = await startSession({ plotId: 'plot-2', cropPrimary: 'cafe' }, deps);

    expect(conProfundidad.depthCm).toBe(30);
    expect(sinProfundidad.depthCm).toBe(20);
  });

  it('rechaza un lote que no existe con un mensaje en español', async () => {
    const fincas = makeInMemoryFarmStore({ plots: [loteSembrado()] });
    const sesiones = makeInMemorySessionStore();
    const { store: ajustes } = ajustesEnMemoria();
    const { gateway, writeConfig } = gatewayFalso();

    await expect(
      startSession(
        { plotId: 'plot-99', cropPrimary: 'cafe' },
        {
          farms: fincas.farms,
          sessions: sesiones.sessions,
          settings: ajustes,
          gateway,
          clock: relojFijo(),
          thresholds: setDeUmbrales(),
          newId: () => 'session-1',
        },
      ),
    ).rejects.toThrow(/lote.*no existe/i);

    expect(sesiones.sessionRows).toHaveLength(0);
    expect(writeConfig).not.toHaveBeenCalled();
  });

  it('rechaza un cultivo sin umbrales con un mensaje en español', async () => {
    const fincas = makeInMemoryFarmStore({ plots: [loteSembrado()] });
    const sesiones = makeInMemorySessionStore();
    const { store: ajustes } = ajustesEnMemoria();
    const { gateway, writeConfig } = gatewayFalso();

    await expect(
      startSession(
        { plotId: 'plot-1', cropPrimary: 'arroz' },
        {
          farms: fincas.farms,
          sessions: sesiones.sessions,
          settings: ajustes,
          gateway,
          clock: relojFijo(),
          thresholds: setDeUmbrales(),
          newId: () => 'session-1',
        },
      ),
    ).rejects.toThrow(/no hay umbrales para el cultivo/i);

    expect(sesiones.sessionRows).toHaveLength(0);
    expect(writeConfig).not.toHaveBeenCalled();
  });

  it('rechaza un lote sin unidad cartográfica con un mensaje en español', async () => {
    const fincas = makeInMemoryFarmStore({
      plots: [loteSembrado({ cartographicUnit: null })],
    });
    const sesiones = makeInMemorySessionStore();
    const { store: ajustes } = ajustesEnMemoria();
    const { gateway, writeConfig } = gatewayFalso();

    await expect(
      startSession(
        { plotId: 'plot-1', cropPrimary: 'cafe' },
        {
          farms: fincas.farms,
          sessions: sesiones.sessions,
          settings: ajustes,
          gateway,
          clock: relojFijo(),
          thresholds: setDeUmbrales(),
          newId: () => 'session-1',
        },
      ),
    ).rejects.toThrow(/unidad cartográfica/i);

    expect(sesiones.sessionRows).toHaveLength(0);
    expect(writeConfig).not.toHaveBeenCalled();
  });
});
