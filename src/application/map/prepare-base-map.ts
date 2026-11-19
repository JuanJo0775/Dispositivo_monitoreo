import type { BaseMapSource } from '@/ports/base-map';
import { pmtilesFileUri } from '@/shared/pmtiles-uri';

/** Texto cuando el paquete incluido no quedó disponible en el teléfono. */
const SIN_PAQUETE = 'El mapa incluido no está disponible en este teléfono.';

/**
 * Prepara el paquete base del mapa y devuelve la URI que entiende MapLibre.
 *
 * La app siempre trae un mapa general: si el archivo no se puede dejar en
 * disco, el llamador cae al croquis y lo avisa, nunca deja el área en blanco.
 */
export async function prepareBaseMap(source: BaseMapSource): Promise<string> {
  const path = await source.ensureLocalFile();

  if (path.trim() === '') {
    throw new Error(SIN_PAQUETE);
  }

  return pmtilesFileUri(path);
}
