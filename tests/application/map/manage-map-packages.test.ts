import {
  ACTIVE_MAP_PACKAGE_KEY,
  MAX_MAP_PACKAGE_BYTES,
  deleteMapPackage,
  getActiveMapPackage,
  importMapPackage,
  listMapPackages,
  setActiveMapPackage,
} from '@/application/map/manage-map-packages';
import type { MapPackageFiles } from '@/ports/map-package-files';
import type { MapPackage } from '@/ports/stores/map-package-store';

import { makeInMemorySettingsStore } from '../../helpers/in-memory-diagnosis-stores';
import { makeInMemoryMapPackageStore } from '../../helpers/in-memory-map-package-store';

const MB = 1024 * 1024;
const clock = () => '2026-11-12T19:00:00Z';

/** Doble del puerto de archivos: nada toca el disco de verdad. */
function makeFakeFiles(options: { sizes?: Record<string, number>; available?: number } = {}) {
  const sizes = new Map(Object.entries(options.sizes ?? {}));
  const copiados = new Map<string, number>();
  const copias: { uri: string; fileName: string }[] = [];
  const borrados: string[] = [];

  const files: MapPackageFiles = {
    async sizeOf(uri) {
      const tamano = sizes.get(uri);

      if (tamano === undefined) {
        throw new Error(`El archivo ${uri} no existe`);
      }

      return tamano;
    },
    async availableSpaceBytes() {
      return options.available ?? 1024 * MB;
    },
    async copyIntoAppStorage(uri, fileName) {
      const tamano = sizes.get(uri) ?? 0;
      const path = `file:///maps/${fileName}`;

      copiados.set(path, tamano);
      copias.push({ uri, fileName });

      return { path, sizeBytes: tamano };
    },
    async deleteAt(path) {
      copiados.delete(path);
      borrados.push(path);
    },
    async existsAt(path) {
      return copiados.has(path);
    },
  };

  return { files, copias, copiados, borrados };
}

function makeDeps(options: { sizes?: Record<string, number>; available?: number } = {}) {
  const paquetes = makeInMemoryMapPackageStore();
  const ajustes = makeInMemorySettingsStore();
  const archivos = makeFakeFiles(options);
  const ids = { valor: 0 };

  const deps = {
    packages: paquetes.packages,
    settings: ajustes.settings,
    files: archivos.files,
    clock,
    newId: () => {
      ids.valor += 1;
      return `pkg-${ids.valor}`;
    },
  };

  return { paquetes, ajustes, archivos, deps };
}

/** Paquete ya registrado, como si se hubiera importado antes. */
function seedPackage(overrides: Partial<MapPackage> = {}): MapPackage {
  return {
    id: 'pkg-viejo',
    fileName: 'quindio.pmtiles',
    path: 'file:///maps/pkg-viejo.pmtiles',
    sizeBytes: MB,
    importedAt: '2026-11-01T09:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('manageMapPackages', () => {
  it('rechaza un archivo que no es .pmtiles', async () => {
    const { deps, archivos } = makeDeps({ sizes: { 'file:///tmp/mapa.zip': MB } });

    await expect(
      importMapPackage({ uri: 'file:///tmp/mapa.zip', fileName: 'mapa.zip' }, deps),
    ).rejects.toThrow(/\.pmtiles/);

    expect(archivos.copias).toHaveLength(0);
  });

  it('rechaza un paquete que supera el límite de tamaño', async () => {
    const { deps, archivos } = makeDeps({
      sizes: { 'file:///tmp/grande.pmtiles': MAX_MAP_PACKAGE_BYTES + 1 },
    });

    await expect(
      importMapPackage({ uri: 'file:///tmp/grande.pmtiles', fileName: 'grande.pmtiles' }, deps),
    ).rejects.toThrow(/200 MB/);

    expect(archivos.copias).toHaveLength(0);
  });

  it('rechaza cuando no hay espacio suficiente', async () => {
    const { deps, archivos } = makeDeps({
      sizes: { 'file:///tmp/quindio.pmtiles': 10 * MB },
      available: 5 * MB,
    });

    await expect(
      importMapPackage({ uri: 'file:///tmp/quindio.pmtiles', fileName: 'quindio.pmtiles' }, deps),
    ).rejects.toThrow(/espacio/);

    expect(archivos.copias).toHaveLength(0);
  });

  it('importa: copia con nombre propio, registra y deja activo el primero', async () => {
    const { deps, paquetes, ajustes, archivos } = makeDeps({
      sizes: { 'file:///tmp/quindio.pmtiles': MB },
    });

    const paquete = await importMapPackage(
      { uri: 'file:///tmp/quindio.pmtiles', fileName: 'quindio.pmtiles' },
      deps,
    );

    expect(paquete).toEqual({
      id: 'pkg-1',
      fileName: 'quindio.pmtiles',
      path: 'file:///maps/pkg-1.pmtiles',
      sizeBytes: MB,
      importedAt: clock(),
      deletedAt: null,
    });
    expect(archivos.copias).toEqual([
      { uri: 'file:///tmp/quindio.pmtiles', fileName: 'pkg-1.pmtiles' },
    ]);
    expect(paquetes.packageRows).toHaveLength(1);
    expect(ajustes.settingRows[ACTIVE_MAP_PACKAGE_KEY]).toBe('pkg-1');
    expect(await getActiveMapPackage(deps)).toBe('pkg-1');
  });

  it('no le quita el turno al paquete activo que ya existía', async () => {
    const { deps, paquetes, ajustes } = makeDeps({
      sizes: { 'file:///tmp/otro.pmtiles': MB },
    });

    await paquetes.packages.insert(seedPackage());
    await ajustes.settings.set(ACTIVE_MAP_PACKAGE_KEY, 'pkg-viejo');

    await importMapPackage({ uri: 'file:///tmp/otro.pmtiles', fileName: 'otro.pmtiles' }, deps);

    expect(await getActiveMapPackage(deps)).toBe('pkg-viejo');
    expect(await listMapPackages(deps)).toHaveLength(2);
  });

  it('borra: marca el paquete y elimina su archivo', async () => {
    const { deps, paquetes, archivos } = makeDeps({
      sizes: { 'file:///tmp/quindio.pmtiles': MB },
    });

    const paquete = await importMapPackage(
      { uri: 'file:///tmp/quindio.pmtiles', fileName: 'quindio.pmtiles' },
      deps,
    );

    await deleteMapPackage(paquete.id, deps);

    expect((await paquetes.packages.get(paquete.id))?.deletedAt).toBe(clock());
    expect(await archivos.files.existsAt(paquete.path)).toBe(false);
    expect(archivos.borrados).toEqual([paquete.path]);
    expect(await listMapPackages(deps)).toEqual([]);
  });

  it('borrar el paquete activo lo desactiva', async () => {
    const { deps } = makeDeps({ sizes: { 'file:///tmp/quindio.pmtiles': MB } });

    const paquete = await importMapPackage(
      { uri: 'file:///tmp/quindio.pmtiles', fileName: 'quindio.pmtiles' },
      deps,
    );

    await deleteMapPackage(paquete.id, deps);

    expect(await getActiveMapPackage(deps)).toBeNull();
  });

  it('listar no trae los paquetes borrados', async () => {
    const { deps } = makeDeps({
      sizes: { 'file:///tmp/uno.pmtiles': MB, 'file:///tmp/dos.pmtiles': MB },
    });

    const primero = await importMapPackage(
      { uri: 'file:///tmp/uno.pmtiles', fileName: 'uno.pmtiles' },
      deps,
    );
    const segundo = await importMapPackage(
      { uri: 'file:///tmp/dos.pmtiles', fileName: 'dos.pmtiles' },
      deps,
    );

    await deleteMapPackage(primero.id, deps);

    const vigentes = await listMapPackages(deps);

    expect(vigentes.map((paquete) => paquete.id)).toEqual([segundo.id]);
  });

  it('no deja activar un paquete inexistente ni uno borrado', async () => {
    const { deps } = makeDeps({ sizes: { 'file:///tmp/quindio.pmtiles': MB } });

    await expect(setActiveMapPackage('no-existe', deps)).rejects.toThrow(/no existe/);

    const paquete = await importMapPackage(
      { uri: 'file:///tmp/quindio.pmtiles', fileName: 'quindio.pmtiles' },
      deps,
    );
    await deleteMapPackage(paquete.id, deps);

    await expect(setActiveMapPackage(paquete.id, deps)).rejects.toThrow(/no existe/);
  });
});
