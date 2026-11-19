import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { ACTIVE_MAP_PACKAGE_KEY } from '@/application/map/manage-map-packages';
import type { AppStores, AppServices } from '@/ui/providers/app-context';
import { AppContext } from '@/ui/providers/app-context';
import type { MapPackage } from '@/ports/stores/map-package-store';
import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';

import MapPackagesScreen from '../../../app/map-packages';
import { fakeBaseMap } from '../../helpers/base-map';
import { makeInMemorySettingsStore } from '../../helpers/in-memory-diagnosis-stores';
import {
  makeInMemoryMapPackageFiles,
  type InMemoryMapPackageFilesSeed,
} from '../../helpers/in-memory-map-package-files';
import { makeInMemoryMapPackageStore } from '../../helpers/in-memory-map-package-store';
import { makeInMemoryUserDataStore } from '../../helpers/in-memory-user-data-store';

/** Lo que el selector de archivos devuelve en la prueba. */
const mockPickDocument = jest.fn();

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockPickDocument(...args),
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
  };
});

/** Paquete importado de prueba. */
function makePackage(overrides: Partial<MapPackage> = {}): MapPackage {
  return {
    id: 'pkg-1',
    fileName: 'quindio.pmtiles',
    path: 'file:///data/user/0/com.semillero.monitoreosuelo/files/maps/pkg-1.pmtiles',
    sizeBytes: 24_641_536,
    importedAt: '2026-11-13T10:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

function makeServices(
  packages: readonly MapPackage[] = [],
  activeId: string | null = null,
  files: InMemoryMapPackageFilesSeed = {},
) {
  const paquetes = makeInMemoryMapPackageStore(packages);
  const settings = makeInMemorySettingsStore(
    activeId === null ? {} : { [ACTIVE_MAP_PACKAGE_KEY]: activeId },
  );
  const disk = makeInMemoryMapPackageFiles(files);

  const stores = {
    mapPackages: paquetes.packages,
    userData: makeInMemoryUserDataStore(),
    settings: settings.settings,
  } as unknown as AppStores;

  const services: AppServices = {
    stores,
    uow: {} as unknown as AppServices['uow'],
    gateway: {} as unknown as AppServices['gateway'],
    sync: {} as unknown as AppServices['sync'],
    mapFiles: disk.files,
    baseMap: fakeBaseMap,
    deviceId: 'stick-01',
    thresholds: {} as unknown as ThresholdSet,
  };

  return { services, paquetes, settings, disk };
}

const alertSpy = jest.spyOn(Alert, 'alert');

beforeEach(() => {
  mockPickDocument.mockReset();
  alertSpy.mockReset();
  alertSpy.mockImplementation(() => {});
});

describe('pantalla de paquetes de mapa', () => {
  it('lista el paquete incluido y los importados con nombre y tamaño', async () => {
    const primero = makePackage({ id: 'pkg-1', fileName: 'quindio.pmtiles' });
    const detallado = makePackage({
      id: 'pkg-2',
      fileName: 'eje-cafetero.pmtiles',
      sizeBytes: 52_428_800,
      importedAt: '2026-11-13T11:00:00Z',
    });
    const { services } = makeServices([primero, detallado], 'pkg-2');
    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapPackagesScreen />
      </AppContext.Provider>,
    );

    await pantalla.findByText('quindio.pmtiles');

    expect(pantalla.getByText(/Paquete incluido/)).toBeTruthy();
    expect(pantalla.getByText('23,5 MB')).toBeTruthy();
    expect(pantalla.getByText('50 MB')).toBeTruthy();
    expect(within(pantalla.getByTestId('paquete-pkg-2')).getByText('Activo')).toBeTruthy();
    expect(within(pantalla.getByTestId('paquete-pkg-1')).getByText('Activar')).toBeTruthy();
  });

  it('no registra un archivo que no es .pmtiles y lo dice', async () => {
    mockPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/mapa.zip', name: 'mapa.zip' }],
    });
    const { services, paquetes, disk } = makeServices();
    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapPackagesScreen />
      </AppContext.Provider>,
    );

    await fireEvent.press(pantalla.getByText('Importar paquete .pmtiles'));

    expect(await pantalla.findByText('El archivo debe ser un paquete .pmtiles.')).toBeTruthy();
    expect(paquetes.packageRows).toHaveLength(0);
    expect(disk.copies).toHaveLength(0);
  });

  it('importa un paquete válido y lo deja activo', async () => {
    mockPickDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/quindio.pmtiles', name: 'quindio.pmtiles' }],
    });
    const { services, paquetes, settings, disk } = makeServices([], null, {
      sizes: { 'file:///cache/quindio.pmtiles': 1024 },
    });
    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapPackagesScreen />
      </AppContext.Provider>,
    );

    await fireEvent.press(pantalla.getByText('Importar paquete .pmtiles'));

    expect(await pantalla.findByText('Se importó quindio.pmtiles y quedó activo.')).toBeTruthy();

    const importado = paquetes.packageRows[0];
    expect(importado?.fileName).toBe('quindio.pmtiles');
    expect(disk.copies).toHaveLength(1);
    expect(importado === undefined ? null : settings.settingRows[ACTIVE_MAP_PACKAGE_KEY]).toBe(
      importado?.id,
    );
    expect(
      within(pantalla.getByTestId(`paquete-${importado?.id}`)).getByText('Activo'),
    ).toBeTruthy();
  });

  it('borra un paquete después de la confirmación', async () => {
    const paquete = makePackage();
    const { services, paquetes, settings, disk } = makeServices([paquete], paquete.id, {
      existingPaths: [paquete.path],
    });

    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapPackagesScreen />
      </AppContext.Provider>,
    );

    await pantalla.findByText('quindio.pmtiles');
    await fireEvent.press(pantalla.getByText('Borrar'));

    const botones = alertSpy.mock.calls[0]?.[2] as AlertButton[] | undefined;
    const confirmar = botones?.find((boton) => boton.text === 'Borrar');

    expect(confirmar).toBeDefined();

    confirmar?.onPress?.();

    expect(await pantalla.findByText('Paquete borrado.')).toBeTruthy();

    expect(paquetes.packageRows[0]?.deletedAt).not.toBeNull();
    expect(disk.deleted).toEqual([paquete.path]);
    expect(settings.settingRows[ACTIVE_MAP_PACKAGE_KEY]).toBe('');
    expect(pantalla.getByText('Todavía no hay paquetes importados.')).toBeTruthy();
  });

  it('no borra nada mientras la persona no confirme', async () => {
    const paquete = makePackage();
    const { services, paquetes } = makeServices([paquete], paquete.id);
    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapPackagesScreen />
      </AppContext.Provider>,
    );

    await pantalla.findByText('quindio.pmtiles');
    await fireEvent.press(pantalla.getByText('Borrar'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(paquetes.packageRows[0]?.deletedAt).toBeNull();
  });

  it('cambia el paquete activo y permite volver al incluido', async () => {
    const primero = makePackage({ id: 'pkg-1' });
    const detallado = makePackage({
      id: 'pkg-2',
      fileName: 'eje-cafetero.pmtiles',
      importedAt: '2026-11-13T11:00:00Z',
    });
    const { services, settings } = makeServices([primero, detallado], 'pkg-1');
    const pantalla = await render(
      <AppContext.Provider value={{ services, error: null }}>
        <MapPackagesScreen />
      </AppContext.Provider>,
    );

    await pantalla.findByText('eje-cafetero.pmtiles');

    await fireEvent.press(within(pantalla.getByTestId('paquete-pkg-2')).getByText('Activar'));

    await waitFor(() =>
      expect(within(pantalla.getByTestId('paquete-pkg-2')).getByText('Activo')).toBeTruthy(),
    );
    expect(settings.settingRows[ACTIVE_MAP_PACKAGE_KEY]).toBe('pkg-2');

    await fireEvent.press(pantalla.getByText('Usar solo el incluido'));

    expect(await pantalla.findByText('En uso')).toBeTruthy();
    expect(settings.settingRows[ACTIVE_MAP_PACKAGE_KEY]).toBe('');
  });
});
