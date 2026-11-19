import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import type { BaseMapSource } from '@/ports/base-map';
import { BASE_ARCHIVE_NAME } from '@/shared/pmtiles-uri';

// Metro reemplaza este `require` por el recurso empaquetado en el APK.
import baseMapAsset from '../../../assets/maps/base.pmtiles';

/** Carpeta privada de los paquetes de mapa, dentro de los documentos de la app. */
const MAPS_DIRECTORY = 'maps';

/** Preparación en curso: dos pantallas pueden pedir el mapa a la vez. */
let inFlight: Promise<string> | null = null;

/** Texto cuando el recurso empaquetado no se pudo resolver a un archivo. */
const SIN_ARCHIVO = 'No se pudo extraer el mapa incluido en este teléfono.';

/**
 * Deja el paquete incluido como archivo real y devuelve su ruta.
 *
 * El `.pmtiles` viaja comprimido dentro del APK y MapLibre lo abre por
 * posiciones, así que primero hay que sacarlo a un archivo normal. Se copia a
 * documentos —no a caché— para que el limpiador del sistema no lo borre en
 * medio de una salida a campo, y se reutiliza el que ya está copiado.
 */
async function ensureLocalFile(): Promise<string> {
  const directory = new Directory(Paths.document, MAPS_DIRECTORY);

  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }

  const target = new File(directory, BASE_ARCHIVE_NAME);

  if (target.exists && (target.size ?? 0) > 0) {
    return target.uri;
  }

  const asset = Asset.fromModule(baseMapAsset);
  await asset.downloadAsync();

  const localUri = asset.localUri;

  if (localUri === null || localUri === '') {
    throw new Error(SIN_ARCHIVO);
  }

  await new File(localUri).copy(target, { overwrite: true });

  if (!target.exists) {
    throw new Error(SIN_ARCHIVO);
  }

  return target.uri;
}

/**
 * Implementación de `BaseMapSource` sobre `expo-asset` y `expo-file-system`.
 *
 * Un fallo no se recuerda: la próxima pantalla que abra el mapa lo reintenta.
 */
export const expoBaseMap: BaseMapSource = {
  async ensureLocalFile() {
    if (inFlight === null) {
      inFlight = ensureLocalFile().catch((error: unknown) => {
        inFlight = null;
        throw error;
      });
    }

    return inFlight;
  },
};
