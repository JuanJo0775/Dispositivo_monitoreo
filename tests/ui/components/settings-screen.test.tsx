import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { AppServices } from '@/ui/providers/app-context';
import { AppContext } from '@/ui/providers/app-context';

import SettingsScreen from '../../../app/settings';
import { fakeBaseMap } from '../../helpers/base-map';
import rawSet from '../../../assets/thresholds/2026.11-v1.json';
import { makeInMemorySettingsStore } from '../../helpers/in-memory-diagnosis-stores';
import { makeInMemoryMapPackageFiles } from '../../helpers/in-memory-map-package-files';
import { makeInMemoryMapPackageStore } from '../../helpers/in-memory-map-package-store';
import { makeInMemoryUserDataStore } from '../../helpers/in-memory-user-data-store';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');

    return React.useEffect(callback, [callback]);
  },
}));

const thresholds = parseThresholdSet(rawSet);

function makeServices() {
  const settings = makeInMemorySettingsStore();
  const packages = makeInMemoryMapPackageStore();
  const userData = makeInMemoryUserDataStore({
    farms: 1,
    plots: 2,
    measurements: 3,
    mapPackages: 1,
  });
  const files = makeInMemoryMapPackageFiles({
    existingPaths: ['file:///maps/pkg-1.pmtiles'],
  });

  const services: AppServices = {
    stores: {
      settings: settings.settings,
      mapPackages: packages.packages,
      userData,
    } as unknown as AppServices['stores'],
    uow: {} as unknown as AppServices['uow'],
    gateway: {} as unknown as AppServices['gateway'],
    sync: {} as unknown as AppServices['sync'],
    mapFiles: files.files,
    baseMap: fakeBaseMap,
    deviceId: 'stick-01',
    thresholds,
  };

  return { services, userData, files };
}

describe('pantalla de ajustes', () => {
  it('pide confirmación y borra todos los datos desde la app', async () => {
    const { services, userData } = makeServices();
    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <SettingsScreen />
      </AppContext.Provider>,
    );

    await fireEvent.press(pantalla.getByText('Borrar todos mis datos'));

    expect(pantalla.getByText('¿Borrar todos sus datos?')).toBeTruthy();

    await fireEvent.press(pantalla.getByText('Sí, borrar todo'));

    await waitFor(() => expect(userData.calls).toBe(1));
    expect(
      pantalla.getByText(
        'Se borraron 3 mediciones, 2 lotes, 1 finca. También se borraron 1 paquete de mapa importado.',
      ),
    ).toBeTruthy();
    expect(pantalla.queryByText('¿Borrar todos sus datos?')).toBeNull();
  });

  it('cancelar no borra nada', async () => {
    const { services, userData } = makeServices();
    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <SettingsScreen />
      </AppContext.Provider>,
    );

    await fireEvent.press(pantalla.getByText('Borrar todos mis datos'));
    await fireEvent.press(pantalla.getByText('Cancelar'));

    expect(userData.calls).toBe(0);
    expect(pantalla.getByText('Borrar todos mis datos')).toBeTruthy();
  });
});
