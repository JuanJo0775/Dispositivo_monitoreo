import { fireEvent, render } from '@testing-library/react-native';

import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { AppStores, AppServices } from '@/ui/providers/app-context';
import { AppContext } from '@/ui/providers/app-context';

import HistoryScreen from '../../../app/history';
import rawSet from '../../../assets/thresholds/2026.11-v1.json';
import { makePlot } from '../../helpers/farm-fixtures';
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

/**
 * La pantalla de historial: cada medición muestra su lote y las que llegaron
 * sin lote —por ejemplo, de una sincronización— lo reciben desde acá.
 */

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useRouter: () => mockRouter,
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
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
    plots: [makePlot({ id: 'plot-1', name: 'El Guamo' })],
  });
  const sessions = makeInMemorySessionStore([]);
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

  return { services, stores };
}

async function renderHistorico(services: AppServices) {
  return render(
    <AppContext.Provider value={{ services, error: null }}>
      <HistoryScreen />
    </AppContext.Provider>,
  );
}

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
});

describe('pantalla de historial', () => {
  it('muestra el lote guardado y deja asignar uno a la medición que no lo tiene', async () => {
    const { services, stores } = makeServices();

    await stores.measurements.insert(
      makeMeasurement({ humidityPct: 38 }, { id: 'm-1', plotId: 'plot-1' }),
    );
    await stores.measurements.insert(
      makeMeasurement(
        { humidityPct: 31 },
        { id: 'm-2', plotId: null, capturedAtUtc: '2026-11-12T18:05:00Z' },
      ),
    );

    const pantalla = await renderHistorico(services);

    expect(await pantalla.findByText('Lote: El Guamo')).toBeTruthy();
    expect(pantalla.getByText('Sin lote asignado')).toBeTruthy();

    await fireEvent.press(pantalla.getByText('Asignar lote'));

    expect(
      pantalla.getByText(
        'Cambiar el lote ordena la medición; los valores medidos y su diagnóstico quedan igual.',
      ),
    ).toBeTruthy();

    await fireEvent.press(pantalla.getByLabelText('Lote El Guamo'));

    expect(await pantalla.findByText('Se asignó el lote El Guamo a la medición.')).toBeTruthy();
    expect(pantalla.queryByText('Cancelar')).toBeNull();
    expect(pantalla.getAllByText('Lote: El Guamo')).toHaveLength(2);

    const filas = await stores.measurements.list();
    const asignada = filas.find((medicion) => medicion.id === 'm-2');

    // Solo cambió el lote: los valores medidos y la hora de captura siguen igual.
    expect(asignada?.plotId).toBe('plot-1');
    expect(asignada?.payload.humidityPct).toBe(31);
    expect(asignada?.capturedAtUtc).toBe('2026-11-12T18:05:00Z');
    expect(filas.find((medicion) => medicion.id === 'm-1')?.plotId).toBe('plot-1');
  });

  it('cancelar deja la medición sin lote', async () => {
    const { services, stores } = makeServices();

    await stores.measurements.insert(makeMeasurement({}, { id: 'm-1', plotId: 'plot-1' }));
    await stores.measurements.insert(
      makeMeasurement({}, { id: 'm-2', plotId: null, capturedAtUtc: '2026-11-12T18:05:00Z' }),
    );

    const pantalla = await renderHistorico(services);

    expect(await pantalla.findByText('Sin lote asignado')).toBeTruthy();

    await fireEvent.press(pantalla.getByText('Asignar lote'));
    await fireEvent.press(pantalla.getByText('Cancelar'));

    expect(pantalla.queryByText('Cancelar')).toBeNull();

    const filas = await stores.measurements.list();

    expect(filas.find((medicion) => medicion.id === 'm-2')?.plotId).toBeNull();
  });
});
