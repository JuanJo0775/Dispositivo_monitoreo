import type { MapPackageFiles } from '@/ports/map-package-files';
import type { MapPackageStore } from '@/ports/stores/map-package-store';
import type { ErasedUserData, UserDataStore } from '@/ports/stores/user-data-store';

export interface DeleteUserDataDeps {
  readonly userData: UserDataStore;
  readonly mapPackages: MapPackageStore;
  readonly files: MapPackageFiles;
}

export interface DeleteUserDataResult {
  readonly erased: ErasedUserData;
  /** Archivos de paquetes de mapa borrados del disco. */
  readonly deletedFiles: number;
  /** Archivos que no se pudieron borrar; sus filas ya no existen. */
  readonly failedFiles: number;
}

/**
 * Borra todo lo que la app guardó de la persona.
 *
 * Primero se leen los paquetes para saber qué archivos borrar y después se
 * vacía la base en una sola transacción. Si la base falla, no se toca ningún
 * archivo; si un archivo no se deja borrar, la persona queda sin sus datos y
 * solo sobra un archivo de teselas huérfano, que se reporta.
 *
 * No borra los umbrales científicos ni el mapa incluido en la app.
 */
export async function deleteUserData(deps: DeleteUserDataDeps): Promise<DeleteUserDataResult> {
  const packages = await deps.mapPackages.listAll();
  const erased = await deps.userData.eraseAll();

  let deletedFiles = 0;
  let failedFiles = 0;

  for (const mapPackage of packages) {
    try {
      await deps.files.deleteAt(mapPackage.path);
      deletedFiles += 1;
    } catch {
      failedFiles += 1;
    }
  }

  return { erased, deletedFiles, failedFiles };
}
