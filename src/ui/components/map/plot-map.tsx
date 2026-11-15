import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { StyleSheet } from 'react-native';

import type { PlotSpace } from '@/application/map/describe-plot-space';
import type { PressEventWithFeatures } from '@maplibre/maplibre-react-native';
import { buildMapStyle } from '@/infrastructure/maps/map-style';

import { CELL_FILL_OPACITY } from './map-colors';
import { cellFeatures, pointFeatures, spaceBounds, spaceCenter } from './map-geometry';

export interface PlotMapProps {
  space: PlotSpace;
  /** URI `pmtiles://` del paquete base incluido, o `null` si no está. */
  baseUri: string | null;
  /** URI `pmtiles://` del paquete detallado activo, o `null` si no hay. */
  detailUri: string | null;
  onSelectCell: (cellId: string) => void;
  onSelectPoint: (measurementId: string) => void;
}

/**
 * Mapa del lote sobre teselas locales.
 *
 * Dibuja, en este orden: teselas del paquete activo, celdas de la malla y
 * puntos medidos por encima. Las celdas vacías van con su propio gris, nunca
 * con el color de una clase.
 *
 * El mapa no decide nada: recibe el `PlotSpace` ya resuelto y solo lo pinta.
 * Tocar una celda o un punto llama a la pantalla, que abre el detalle.
 */
export function PlotMap({ space, baseUri, detailUri, onSelectCell, onSelectPoint }: PlotMapProps) {
  const bounds = spaceBounds(space);
  const initialViewState =
    bounds === null
      ? { center: spaceCenter(space), zoom: 1 }
      : { bounds, padding: { top: 24, right: 24, bottom: 24, left: 24 } };

  return (
    <Map
      style={styles.map}
      mapStyle={buildMapStyle({ base: baseUri, detalle: detailUri })}
      testID="mapa-lote"
    >
      <Camera initialViewState={initialViewState} />

      <GeoJSONSource
        id="celdas"
        data={cellFeatures(space)}
        onPress={(event) => {
          const cellId = firstFeatureId(event);

          if (cellId !== null) {
            onSelectCell(cellId);
          }
        }}
      >
        <Layer
          id="celdas-relleno"
          type="fill"
          paint={{ 'fill-color': ['get', 'fill'], 'fill-opacity': CELL_FILL_OPACITY }}
        />
        <Layer
          id="celdas-borde"
          type="line"
          paint={{ 'line-color': ['get', 'border'], 'line-width': 1 }}
        />
      </GeoJSONSource>

      <GeoJSONSource
        id="puntos"
        data={pointFeatures(space)}
        onPress={(event) => {
          const measurementId = firstFeatureId(event);

          if (measurementId !== null) {
            onSelectPoint(measurementId);
          }
        }}
      >
        <Layer
          id="puntos-circulo"
          type="circle"
          filter={['!=', ['get', 'hollow'], true]}
          paint={{
            'circle-color': ['get', 'fill'],
            'circle-radius': 7,
            'circle-stroke-color': ['get', 'border'],
            'circle-stroke-width': 2,
          }}
        />
        <Layer
          id="puntos-anillo"
          type="circle"
          filter={['==', ['get', 'hollow'], true]}
          paint={{
            'circle-color': 'rgba(0, 0, 0, 0)',
            'circle-radius': 7,
            'circle-stroke-color': ['get', 'fill'],
            'circle-stroke-width': 3,
          }}
        />
      </GeoJSONSource>
    </Map>
  );
}

/** Identificador de la primera geometría tocada, si la hay. */
function firstFeatureId(event: NativeSyntheticEvent<PressEventWithFeatures>): string | null {
  const feature = event.nativeEvent.features?.[0];
  const id = feature?.properties?.id;

  return typeof id === 'string' ? id : null;
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    minHeight: 240,
  },
});
