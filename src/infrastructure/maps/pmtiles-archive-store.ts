/**
 * URIs con las que MapLibre abre un archivo `.pmtiles` local.
 *
 * Hay dos formas y las dos son offline:
 *
 * - `pmtiles://asset://<archivo>`: lee el archivo empaquetado en el APK.
 * - `pmtiles://file://<ruta absoluta>`: lee un archivo del almacenamiento
 *   privado de la app, ya sea una copia del paquete base o un paquete
 *   importado.
 *
 * El pincho de la tarea 0 decide cuál funciona para el paquete incluido; hasta
 * que se confirme en el teléfono, el mapa intenta `asset://` y, si el estilo no
 * carga, copia el archivo y usa `file://` (ver `docs/context/map.md`).
 */

/** Nombre del paquete base que se empaqueta con la app. */
export const BASE_ARCHIVE_NAME = 'base.pmtiles';

/** URI del paquete empaquetado en los assets del APK. */
export function assetArchiveUri(fileName: string): string {
  return `pmtiles://asset://${fileName}`;
}

/**
 * URI de un archivo del almacenamiento de la app.
 *
 * Acepta la ruta absoluta (`/data/...`) o la URI `file://` que entrega
 * `expo-file-system`: el esquema `file://` no se duplica.
 */
export function fileArchiveUri(absolutePath: string): string {
  const normalizada = absolutePath.replace(/\\/g, '/');
  const ruta = normalizada.startsWith('file://')
    ? normalizada.slice('file://'.length)
    : normalizada;

  return `pmtiles://file://${ruta}`;
}
