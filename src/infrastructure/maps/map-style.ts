import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { LayerSpecification, StyleSpecification } from '@maplibre/maplibre-react-native';

/**
 * Estilo del mapa sobre archivos PMTiles locales.
 *
 * Dos fuentes vectoriales: la **base**, empaquetada con la app, y la
 * **detallada**, que la persona importa. La detallada se dibuja encima; donde
 * no alcanza, se ve la base, así el mapa nunca queda en blanco.
 *
 * El estilo no pide nada por red: no lleva `glyphs` ni `sprite` y las capas de
 * Protomaps se generan **sin** opciones de idioma, lo que deja solo capas sin
 * `symbol`. Los rótulos de lugar quedan fuera del corte 3 porque exigirían
 * empaquetar fuentes de glifos.
 */

/** Identificador de la fuente del paquete base incluido. */
export const BASE_SOURCE_ID = 'base';

/** Identificador de la fuente del paquete detallado importado. */
export const DETAIL_SOURCE_ID = 'detalle';

/** Prefijo de los identificadores de las capas del detalle. */
const DETAIL_LAYER_PREFIX = 'detalle:';

/** Identificador de la única capa de fondo del estilo. */
const BACKGROUND_LAYER_ID = 'fondo';

/** Las dos fuentes, ya resueltas a URIs `pmtiles://`, o `null` si no hay. */
export interface MapSources {
  readonly base: string | null;
  readonly detalle: string | null;
}

/**
 * Construye el estilo con las fuentes disponibles.
 *
 * Sin fuentes el estilo trae solo el fondo: sirve para abrir el mapa sin que
 * MapLibre falle mientras se resuelve el paquete base.
 */
export function buildMapStyle(sources: MapSources): StyleSpecification {
  const flavor = namedFlavor('light');

  return {
    version: 8,
    sources: {
      ...(sources.base === null
        ? {}
        : { [BASE_SOURCE_ID]: { type: 'vector' as const, url: sources.base } }),
      ...(sources.detalle === null
        ? {}
        : { [DETAIL_SOURCE_ID]: { type: 'vector' as const, url: sources.detalle } }),
    },
    layers: [
      {
        id: BACKGROUND_LAYER_ID,
        type: 'background',
        paint: { 'background-color': flavor.background },
      },
      ...(sources.base === null ? [] : capasDe(BASE_SOURCE_ID, flavor, '')),
      ...(sources.detalle === null ? [] : capasDe(DETAIL_SOURCE_ID, flavor, DETAIL_LAYER_PREFIX)),
    ],
  };
}

/**
 * Capas de una fuente, sin el fondo y con identificadores únicos.
 *
 * `layers()` devuelve su propia capa `background` en cada llamada; acá se
 * descarta porque el fondo es uno solo. Las capas del detalle llevan prefijo:
 * sin él, las dos fuentes producirían los mismos identificadores y el estilo
 * sería inválido.
 */
function capasDe(sourceId: string, flavor: Flavor, prefix: string): readonly LayerSpecification[] {
  return layers(sourceId, flavor)
    .filter((layer) => layer.type !== 'background')
    .map((layer) =>
      prefix === '' ? layer : ({ ...layer, id: `${prefix}${layer.id}` } as LayerSpecification),
    );
}
