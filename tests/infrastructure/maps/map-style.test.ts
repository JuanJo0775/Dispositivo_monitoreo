import { BASE_SOURCE_ID, DETAIL_SOURCE_ID, buildMapStyle } from '@/infrastructure/maps/map-style';
import { BASE_ARCHIVE_NAME, pmtilesFileUri } from '@/shared/pmtiles-uri';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';

const BASE_URI = 'pmtiles://file:///data/user/0/app/files/maps/base.pmtiles';
const DETAIL_URI = 'pmtiles://file:///data/user/0/app/files/maps/pkg-1.pmtiles';

/** Capas del estilo, ya tipadas para poder mirar `source`. */
interface Capa {
  id: string;
  type: string;
  source?: string;
}

function capas(style: StyleSpecification): Capa[] {
  return style.layers as unknown as Capa[];
}

function capasDe(style: StyleSpecification, source: string): Capa[] {
  return capas(style).filter((capa) => capa.source === source);
}

describe('buildMapStyle', () => {
  it('no contiene ninguna URL http: el mapa es offline', () => {
    const serializado = JSON.stringify(
      buildMapStyle({
        base: BASE_URI,
        detalle: 'pmtiles://file:///data/x.pmtiles',
      }),
    );

    expect(serializado).not.toContain('http://');
    expect(serializado).not.toContain('https://');
  });

  it('con las dos fuentes, dibuja el detalle encima del base', () => {
    const style = buildMapStyle({ base: BASE_URI, detalle: DETAIL_URI });

    expect(style.sources[BASE_SOURCE_ID]).toMatchObject({ type: 'vector', url: BASE_URI });
    expect(style.sources[DETAIL_SOURCE_ID]).toMatchObject({ type: 'vector', url: DETAIL_URI });

    const ids = capas(style).map((capa) => capa.id);

    expect(new Set(ids).size).toBe(ids.length);

    const todas = capas(style);
    const base = capasDe(style, BASE_SOURCE_ID);
    const detalle = capasDe(style, DETAIL_SOURCE_ID);

    expect(base.length).toBeGreaterThan(0);
    expect(detalle.length).toBeGreaterThan(0);

    const ultimoBase = todas.indexOf(base[base.length - 1] as Capa);
    const primerDetalle = todas.indexOf(detalle[0] as Capa);

    expect(primerDetalle).toBeGreaterThan(ultimoBase);
  });

  it('con solo el paquete base, trae esa fuente y sus capas', () => {
    const style = buildMapStyle({ base: BASE_URI, detalle: null });

    expect(Object.keys(style.sources)).toEqual([BASE_SOURCE_ID]);
    expect(capasDe(style, BASE_SOURCE_ID).length).toBeGreaterThan(0);
  });

  it('con solo el paquete detallado, trae esa fuente y sus capas', () => {
    const style = buildMapStyle({ base: null, detalle: DETAIL_URI });

    expect(Object.keys(style.sources)).toEqual([DETAIL_SOURCE_ID]);
    expect(capasDe(style, DETAIL_SOURCE_ID).length).toBeGreaterThan(0);
  });

  it('sin fuentes, deja solo el fondo', () => {
    const style = buildMapStyle({ base: null, detalle: null });

    expect(style.sources).toEqual({});
    expect(capas(style)).toHaveLength(1);
    expect(capas(style)[0]?.type).toBe('background');
  });

  it('no pide glifos ni sprites: no hay rótulos en este corte', () => {
    const style = buildMapStyle({ base: BASE_URI, detalle: DETAIL_URI });

    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
    expect(capas(style).some((capa) => capa.type === 'symbol')).toBe(false);
  });

  it('el paquete base que viaja con la app se llama base.pmtiles', () => {
    expect(BASE_ARCHIVE_NAME).toBe('base.pmtiles');
  });

  it('arma la URI del archivo en el almacenamiento de la app, sin duplicar file://', () => {
    expect(pmtilesFileUri('/data/user/0/x/base.pmtiles')).toBe(
      'pmtiles://file:///data/user/0/x/base.pmtiles',
    );
    expect(pmtilesFileUri('file:///data/user/0/x/base.pmtiles')).toBe(
      'pmtiles://file:///data/user/0/x/base.pmtiles',
    );
  });
});
