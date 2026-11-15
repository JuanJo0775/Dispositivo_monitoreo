import { render } from '@testing-library/react-native';

import { PlotMap } from '@/ui/components/map/plot-map';

import { makePlotSpace } from '../../helpers/plot-space';

/** Lo que el módulo nativo simulado recibió al dibujar el mapa. */
const mockMapLibre: {
  mapProps: Record<string, unknown> | null;
  cameraProps: Record<string, unknown> | null;
  sources: { id: string; data: GeoJSON.FeatureCollection; onPress?: (event: unknown) => void }[];
  layers: { id: string; type: string; paint?: Record<string, unknown> }[];
} = { mapProps: null, cameraProps: null, sources: [], layers: [] };

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  type MockProps = Record<string, unknown> & { testID?: string; children?: React.ReactNode };

  return {
    Map: (props: MockProps) => {
      mockMapLibre.mapProps = props;
      return React.createElement(View, { testID: props.testID }, props.children);
    },
    Camera: (props: MockProps) => {
      mockMapLibre.cameraProps = props;
      return null;
    },
    GeoJSONSource: (props: MockProps) => {
      mockMapLibre.sources.push(props as never);
      return React.createElement(View, { testID: `source-${props.id}` }, props.children);
    },
    Layer: (props: MockProps) => {
      mockMapLibre.layers.push(props as never);
      return null;
    },
  };
});

const BASE_URI = 'pmtiles://asset://base.pmtiles';
const DETAIL_URI = 'pmtiles://file:///data/user/0/app/files/maps/pkg-1.pmtiles';

beforeEach(() => {
  mockMapLibre.mapProps = null;
  mockMapLibre.cameraProps = null;
  mockMapLibre.sources = [];
  mockMapLibre.layers = [];
});

describe('PlotMap', () => {
  it('entrega a MapLibre las dos fuentes pmtiles, sin nada por red', async () => {
    const space = await makePlotSpace();

    await render(
      <PlotMap
        space={space}
        baseUri={BASE_URI}
        detailUri={DETAIL_URI}
        onSelectCell={() => {}}
        onSelectPoint={() => {}}
      />,
    );

    const estilo = mockMapLibre.mapProps?.mapStyle as {
      sources: Record<string, { url: string }>;
    };

    expect(estilo.sources.base?.url).toBe(BASE_URI);
    expect(estilo.sources.detalle?.url).toBe(DETAIL_URI);
    expect(JSON.stringify(estilo)).not.toContain('http');
  });

  it('dibuja una geometría por celda y una por punto con posición', async () => {
    const space = await makePlotSpace();

    await render(
      <PlotMap
        space={space}
        baseUri={BASE_URI}
        detailUri={null}
        onSelectCell={() => {}}
        onSelectPoint={() => {}}
      />,
    );

    const celdas = mockMapLibre.sources.find((source) => source.id === 'celdas');
    const puntos = mockMapLibre.sources.find((source) => source.id === 'puntos');

    expect(celdas?.data.features).toHaveLength(space.cells.length);
    expect(celdas?.data.features.every((f) => f.geometry.type === 'Polygon')).toBe(true);

    // El lote tiene tres mediciones, pero una no tiene posición: no se dibuja.
    expect(puntos?.data.features).toHaveLength(2);
    expect(puntos?.data.features.every((f) => f.geometry.type === 'Point')).toBe(true);
    expect(puntos?.data.features.map((f) => f.properties?.id)).toEqual(
      expect.arrayContaining(['m-oeste', 'm-este']),
    );
  });

  it('avisa qué celda y qué punto se tocaron', async () => {
    const space = await makePlotSpace();
    const celdasTocadas: string[] = [];
    const puntosTocados: string[] = [];

    await render(
      <PlotMap
        space={space}
        baseUri={BASE_URI}
        detailUri={null}
        onSelectCell={(id) => celdasTocadas.push(id)}
        onSelectPoint={(id) => puntosTocados.push(id)}
      />,
    );

    const celdas = mockMapLibre.sources.find((source) => source.id === 'celdas');
    const puntos = mockMapLibre.sources.find((source) => source.id === 'puntos');

    celdas?.onPress?.({ nativeEvent: { features: [{ properties: { id: 'c-1' } }] } });
    puntos?.onPress?.({ nativeEvent: { features: [{ properties: { id: 'm-este' } }] } });

    expect(celdasTocadas).toEqual(['c-1']);
    expect(puntosTocados).toEqual(['m-este']);
  });
});
