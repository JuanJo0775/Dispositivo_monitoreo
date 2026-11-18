import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { AptitudeClass } from '@/domain/diagnosis/types';
import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { StoredDiagnosis } from '@/ports/stores/diagnosis-store';
import type { AppStores, AppServices } from '@/ui/providers/app-context';
import { AppContext } from '@/ui/providers/app-context';

import MapScreen from '../../../app/map';
import rawSet from '../../../assets/thresholds/2026.11-v1.json';
import { makeDiagnosis } from '../../helpers/diagnoses';
import { makePlot, makeSession } from '../../helpers/farm-fixtures';
import {
  makeInMemoryDiagnosisStore,
  makeInMemorySettingsStore,
} from '../../helpers/in-memory-diagnosis-stores';
import { makeInMemoryFarmStore } from '../../helpers/in-memory-farm-store';
import { makeInMemoryMapPackageStore } from '../../helpers/in-memory-map-package-store';
import { makeInMemoryUserDataStore } from '../../helpers/in-memory-user-data-store';
import { makeInMemorySessionStore } from '../../helpers/in-memory-session-store';
import { makeInMemoryStores } from '../../helpers/in-memory-stores';
import { makeMeasurement } from '../../helpers/measurements';

/** Lo que la pantalla pidió al enrutador. */
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
  };
});

/** Últimas propiedades que recibió el mapa de MapLibre. */
let mockMapProps: Record<string, unknown> | null = null;

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  type MockProps = Record<string, unknown> & { testID?: string; children?: React.ReactNode };

  return {
    Map: (props: MockProps) => {
      mockMapProps = props;
      return React.createElement(View, { testID: props.testID }, props.children);
    },
    Camera: () => null,
    GeoJSONSource: (props: MockProps) =>
      React.createElement(View, { testID: `source-${props.id}` }, props.children),
    Layer: () => null,
  };
});

const thresholds = parseThresholdSet(rawSet);

function makeServices() {
  const stores = makeInMemoryStores();
  const farms = makeInMemoryFarmStore({
    farms: [
      {
        id: 'farm-1',
        name: 'Finca La Esperanza',
        createdAt: '2026-11-01T08:00:00Z',
        updatedAt: '2026-11-01T08:00:00Z',
      },
    ],
    plots: [makePlot({ id: 'plot-1' })],
  });
  const sessions = makeInMemorySessionStore([
    makeSession({ id: 'session-1', configId: 7, plotId: 'plot-1' }),
  ]);
  const diagnoses = makeInMemoryDiagnosisStore();
  const packages = makeInMemoryMapPackageStore();
  const settings = makeInMemorySettingsStore();

  const appStores: AppStores = {
    captures: stores.captures,
    measurements: stores.measurements,
    farms: farms.farms,
    sessions: sessions.sessions,
    diagnoses: diagnoses.diagnoses,
    settings: settings.settings,
    mapPackages: packages.packages,
    userData: makeInMemoryUserDataStore(),
    syncState: {
      async get() {
        return null;
      },
      async save() {},
      async list() {
        return [];
      },
    },
  };

  const services: AppServices = {
    stores: appStores,
    uow: stores.uow,
    gateway: {} as unknown as AppServices['gateway'],
    sync: {} as unknown as AppServices['sync'],
    mapFiles: {} as unknown as AppServices['mapFiles'],
    deviceId: 'stick-01',
    thresholds,
  };

  return { services, stores, diagnoses, packages };
}

/** Guarda un diagnóstico como lo hace la app, para que la pantalla no lo recalcule. */
async function guardarDiagnostico(
  diagnoses: ReturnType<typeof makeInMemoryDiagnosisStore>,
  measurementId: string,
  classes: readonly AptitudeClass[],
): Promise<void> {
  const result = makeDiagnosis({ classes });
  const stored: StoredDiagnosis = {
    id: `diag-${measurementId}`,
    measurementId,
    engineVersion: result.versions.engine,
    thresholdsVersion: result.versions.thresholds,
    calibrationVersion: result.versions.calibration,
    firmwareVersion: result.versions.firmware,
    contextSnapshot: { crop: 'cafe' },
    result,
    explanation: result.explanation,
    createdAt: '2026-11-12T18:00:00Z',
  };

  await diagnoses.diagnoses.insert(stored);
}

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockMapProps = null;
});

describe('pantalla de mapa', () => {
  it('completa los diagnósticos que faltan antes de dibujar el lote', async () => {
    const { services, stores, diagnoses } = makeServices();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-1', sessionId: 'session-1' }));

    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapScreen />
      </AppContext.Provider>,
    );

    await waitFor(() => expect(diagnoses.diagnosisRows).toHaveLength(1));

    expect(diagnoses.diagnosisRows[0]?.measurementId).toBe('m-1');
    expect(
      pantalla.getByText(
        '1 celda: 1 con dato, 0 sin dato, 0 no concluyente · 1 punto · 0 sin posición',
      ),
    ).toBeTruthy();
  });

  it('resume celdas, puntos y puntos sin posición', async () => {
    const { services, stores, diagnoses } = makeServices();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-oeste' }));
    await stores.measurements.insert(
      makeMeasurement(
        { longitude: -75.679298 },
        { id: 'm-este', capturedAtUtc: '2026-11-12T17:06:00Z' },
      ),
    );
    await stores.measurements.insert(
      makeMeasurement(
        { latitude: null, longitude: null },
        { id: 'm-sin-posicion', positionValid: false },
      ),
    );
    await guardarDiagnostico(diagnoses, 'm-oeste', ['S1']);
    await guardarDiagnostico(diagnoses, 'm-este', ['S2']);

    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapScreen />
      </AppContext.Provider>,
    );

    expect(
      await pantalla.findByText(
        '3 celdas: 2 con dato, 1 sin dato, 0 no concluyente · 3 puntos · 1 sin posición',
      ),
    ).toBeTruthy();
  });

  it('muestra el encabezado del lote y enlaza a los paquetes cuando no hay uno activo', async () => {
    const { services, stores, diagnoses } = makeServices();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-oeste' }));
    await guardarDiagnostico(diagnoses, 'm-oeste', ['S1']);

    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapScreen />
      </AppContext.Provider>,
    );

    await pantalla.findAllByText('Lote El Guamo');

    expect(pantalla.getByText('Cultivo: Café')).toBeTruthy();
    expect(pantalla.getByText('Unidad cartográfica: Chinchiná')).toBeTruthy();
    expect(pantalla.getByText('Área medida: 0,40 ha')).toBeTruthy();
    expect(pantalla.getByTestId('mapa-lote')).toBeTruthy();
    expect(pantalla.getByText(/paquete incluido/)).toBeTruthy();

    await fireEvent.press(pantalla.getByText('Ver paquetes de mapa'));

    expect(mockRouter.push).toHaveBeenCalledWith('/map-packages');
  });

  it('avisa cuando la malla se ajusta para no pasar de 400 celdas', async () => {
    const { services, stores, diagnoses } = makeServices();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-oeste' }));
    await stores.measurements.insert(
      makeMeasurement(
        { longitude: -75.6611 },
        { id: 'm-este', capturedAtUtc: '2026-11-12T17:06:00Z' },
      ),
    );
    await stores.measurements.insert(
      makeMeasurement(
        { latitude: 4.5539 },
        { id: 'm-norte', capturedAtUtc: '2026-11-12T17:07:00Z' },
      ),
    );
    await guardarDiagnostico(diagnoses, 'm-oeste', ['S1']);
    await guardarDiagnostico(diagnoses, 'm-este', ['S1']);
    await guardarDiagnostico(diagnoses, 'm-norte', ['S1']);

    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapScreen />
      </AppContext.Provider>,
    );

    expect(await pantalla.findByText(/Malla ajustada a celdas de/)).toBeTruthy();
  });

  it('si el paquete de teselas no abre, cae al croquis y lo avisa', async () => {
    const { services, stores, diagnoses } = makeServices();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-oeste' }));
    await guardarDiagnostico(diagnoses, 'm-oeste', ['S1']);

    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapScreen />
      </AppContext.Provider>,
    );

    expect(await pantalla.findByTestId('mapa-lote')).toBeTruthy();

    const onDidFailLoadingMap = mockMapProps?.onDidFailLoadingMap as
      ((event: unknown) => void) | undefined;

    await act(async () => {
      onDidFailLoadingMap?.({ nativeEvent: null });
    });

    expect(pantalla.queryByTestId('mapa-lote')).toBeNull();
    expect(pantalla.getByTestId('mapa-sin-teselas')).toBeTruthy();
    expect(pantalla.getByText(/no pudo abrir el paquete de teselas/)).toBeTruthy();
  });

  it('si falla el diagnóstico, el mapa abre igual y avisa', async () => {
    const { services, stores } = makeServices();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-1', sessionId: 'session-1' }));

    const diagnosesQueFalla = {
      ...services,
      stores: {
        ...services.stores,
        diagnoses: {
          ...services.stores.diagnoses,
          async insert() {
            throw new Error('fallo simulado al guardar el diagnóstico');
          },
        },
      },
    };

    const pantalla = await render(
      <AppContext.Provider value={{ services: diagnosesQueFalla, error: null }}>
        <MapScreen />
      </AppContext.Provider>,
    );

    expect(
      await pantalla.findByText(/No se pudieron completar todos los diagnósticos/),
    ).toBeTruthy();
    expect(pantalla.getByTestId('mapa-lote')).toBeTruthy();
  });
});
