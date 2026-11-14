import { Directory, File, Paths } from 'expo-file-system';

import type { MapPackageFiles } from '@/ports/map-package-files';

/** Carpeta privada de los paquetes de mapa, dentro de los documentos de la app. */
const MAPS_DIRECTORY = 'maps';

/** Crea la carpeta de mapas si no existe y la devuelve. */
function mapsDirectory(): Directory {
  const directory = new Directory(Paths.document, MAPS_DIRECTORY);

  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  return directory;
}

/**
 * Implementación de `MapPackageFiles` sobre `expo-file-system`.
 *
 * Los paquetes viven en los documentos privados de la app: no los toca el
 * limpiador del sistema y no hacen falta permisos de almacenamiento. El nombre
 * del archivo copiado lo decide la capa de aplicación; acá solo se ejecuta.
 */
export const expoMapPackageFiles: MapPackageFiles = {
  async sizeOf(uri) {
    const size = new File(uri).size;

    if (size === null) {
      throw new Error('No se pudo leer el tamaño del archivo elegido.');
    }

    return size;
  },

  async availableSpaceBytes() {
    return Paths.availableDiskSpace;
  },

  async copyIntoAppStorage(uri, fileName) {
    const destination = new File(mapsDirectory(), fileName);

    await new File(uri).copy(destination, { overwrite: true });

    const size = destination.size;

    if (size === null) {
      throw new Error('No se pudo leer el paquete recién copiado.');
    }

    return { path: destination.uri, sizeBytes: size };
  },

  async deleteAt(path) {
    new File(path).delete();
  },

  async existsAt(path) {
    return new File(path).exists;
  },
};
