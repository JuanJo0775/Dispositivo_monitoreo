import type { BaseMapSource } from '@/ports/base-map';

/** Doble del paquete incluido: siempre disponible en una ruta fija. */
export const fakeBaseMap: BaseMapSource = {
  async ensureLocalFile() {
    return '/documentos/maps/base.pmtiles';
  },
};
