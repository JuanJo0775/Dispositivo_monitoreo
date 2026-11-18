import { deleteUserData } from '@/application/privacy/delete-user-data';
import type { MapPackageFiles } from '@/ports/map-package-files';
import type { MapPackage } from '@/ports/stores/map-package-store';

import { makeInMemoryMapPackageFiles } from '../../helpers/in-memory-map-package-files';
import { makeInMemoryMapPackageStore } from '../../helpers/in-memory-map-package-store';
import { makeInMemoryUserDataStore } from '../../helpers/in-memory-user-data-store';

const PAQUETE_A: MapPackage = {
  id: 'pkg-a',
  fileName: 'quindio.pmtiles',
  path: 'file:///maps/pkg-a.pmtiles',
  sizeBytes: 1024,
  importedAt: '2026-11-10T10:00:00Z',
  deletedAt: null,
};

const PAQUETE_B: MapPackage = {
  id: 'pkg-b',
  fileName: 'otro.pmtiles',
  path: 'file:///maps/pkg-b.pmtiles',
  sizeBytes: 2048,
  importedAt: '2026-11-11T10:00:00Z',
  deletedAt: '2026-11-12T10:00:00Z',
};

function makeDeps(
  options: {
    userData?: ReturnType<typeof makeInMemoryUserDataStore>;
    files?: MapPackageFiles;
    paquetes?: readonly MapPackage[];
  } = {},
) {
  const userData =
    options.userData ?? makeInMemoryUserDataStore({ farms: 1, plots: 2, measurements: 5 });
  const paquetes = makeInMemoryMapPackageStore(options.paquetes ?? [PAQUETE_A, PAQUETE_B]);
  const archivos =
    options.files ??
    makeInMemoryMapPackageFiles({
      existingPaths: [PAQUETE_A.path, PAQUETE_B.path],
    }).files;

  return {
    deps: { userData, mapPackages: paquetes.packages, files: archivos },
    userData,
    archivos,
  };
}

describe('deleteUserData', () => {
  it('vacía los datos y después borra los archivos de todos los paquetes, incluidos los borrados', async () => {
    const base = makeInMemoryMapPackageFiles({
      existingPaths: [PAQUETE_A.path, PAQUETE_B.path],
    });
    const { deps, userData } = makeDeps({ files: base.files });

    const result = await deleteUserData(deps);

    expect(userData.calls).toBe(1);
    expect(result.erased).toMatchObject({ farms: 1, plots: 2, measurements: 5 });
    expect(result.deletedFiles).toBe(2);
    expect(result.failedFiles).toBe(0);
    expect(base.deleted).toEqual([PAQUETE_A.path, PAQUETE_B.path]);
  });

  it('no toca los archivos si el borrado de la base falla', async () => {
    const base = makeInMemoryMapPackageFiles({
      existingPaths: [PAQUETE_A.path, PAQUETE_B.path],
    });
    const userData = {
      async eraseAll(): Promise<never> {
        throw new Error('la base no respondió');
      },
    };

    await expect(
      deleteUserData({
        userData,
        mapPackages: makeInMemoryMapPackageStore([PAQUETE_A]).packages,
        files: base.files,
      }),
    ).rejects.toThrow('la base no respondió');

    expect(base.deleted).toEqual([]);
  });

  it('informa los archivos que no se pudieron borrar sin ocultar el borrado de la base', async () => {
    const base = makeInMemoryMapPackageFiles({
      existingPaths: [PAQUETE_A.path, PAQUETE_B.path],
    });
    const files: MapPackageFiles = {
      ...base.files,
      async deleteAt(path) {
        if (path === PAQUETE_B.path) {
          throw new Error('archivo en uso');
        }

        await base.files.deleteAt(path);
      },
    };
    const { deps } = makeDeps({ files });

    const result = await deleteUserData(deps);

    expect(result.deletedFiles).toBe(1);
    expect(result.failedFiles).toBe(1);
    expect(result.erased.farms).toBe(1);
  });
});
