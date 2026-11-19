import { prepareBaseMap } from '@/application/map/prepare-base-map';
import type { BaseMapSource } from '@/ports/base-map';

/** Doble del paquete incluido: devuelve la ruta que se le pida. */
function baseMapWith(path: string): BaseMapSource {
  return {
    async ensureLocalFile() {
      return path;
    },
  };
}

describe('prepareBaseMap', () => {
  it('arma la URI pmtiles://file:// desde una ruta absoluta', async () => {
    const uri = await prepareBaseMap(baseMapWith('/data/user/0/app/files/maps/base.pmtiles'));

    expect(uri).toBe('pmtiles://file:///data/user/0/app/files/maps/base.pmtiles');
  });

  it('no duplica el esquema file://', async () => {
    const uri = await prepareBaseMap(
      baseMapWith('file:///data/user/0/app/files/maps/base.pmtiles'),
    );

    expect(uri).toBe('pmtiles://file:///data/user/0/app/files/maps/base.pmtiles');
  });

  it('convierte las barras de Windows', async () => {
    const uri = await prepareBaseMap(baseMapWith('C:\\datos\\maps\\base.pmtiles'));

    expect(uri).toBe('pmtiles://file://C:/datos/maps/base.pmtiles');
  });

  it('falla cuando el paquete no quedó en disco', async () => {
    await expect(prepareBaseMap(baseMapWith('   '))).rejects.toThrow(
      'El mapa incluido no está disponible en este teléfono.',
    );
  });
});
