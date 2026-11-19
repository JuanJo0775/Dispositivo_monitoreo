/**
 * URI con la que MapLibre abre un archivo `.pmtiles` local.
 *
 * Solo existe la forma `pmtiles://file://<ruta absoluta>`: el paquete se abre
 * desde un archivo real del almacenamiento privado de la app. La variante
 * `pmtiles://asset://…` no sirve para un `.pmtiles`, porque el paquete queda
 * comprimido dentro del APK y no se puede leer por posiciones.
 */

/** Nombre del paquete base que viaja con la app. */
export const BASE_ARCHIVE_NAME = 'base.pmtiles';

/**
 * URI de un archivo del almacenamiento de la app.
 *
 * Acepta la ruta absoluta (`/data/...`) o la URI `file://` que entrega
 * `expo-file-system`: el esquema `file://` no se duplica.
 */
export function pmtilesFileUri(absolutePath: string): string {
  const normalizada = absolutePath.replace(/\\/g, '/');
  const ruta = normalizada.startsWith('file://') ? normalizada : `file://${normalizada}`;

  return `pmtiles://${ruta}`;
}
