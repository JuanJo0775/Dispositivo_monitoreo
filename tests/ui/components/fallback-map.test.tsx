import { render } from '@testing-library/react-native';

import { FallbackMap } from '@/ui/components/map/fallback-map';

import { makePlotSpace } from '../../helpers/plot-space';

describe('FallbackMap', () => {
  it('dice que el mapa va sin teselas y dibuja el croquis de las celdas', async () => {
    const space = await makePlotSpace();
    const { getByText, getByTestId, getAllByTestId } = await render(<FallbackMap space={space} />);

    expect(getByText('Mapa sin teselas')).toBeTruthy();
    expect(getByTestId('croquis')).toBeTruthy();
    expect(getAllByTestId(/^celda-/)).toHaveLength(space.cells.length);
  });

  it('dibuja solo los puntos con posición y no inventa los que no la tienen', async () => {
    const space = await makePlotSpace();
    const { getByTestId, queryByTestId } = await render(<FallbackMap space={space} />);

    expect(getByTestId('punto-m-oeste')).toBeTruthy();
    expect(getByTestId('punto-m-este')).toBeTruthy();
    expect(queryByTestId('punto-m-sin-posicion')).toBeNull();
  });

  it('avisa cuando el lote no tiene ningún punto con posición', async () => {
    const space = await makePlotSpace();
    const vacío = {
      ...space,
      grid: null,
      cells: [],
      points: space.points.filter((punto) => punto.position.latLon === null),
    };

    const { getByText, queryByTestId } = await render(<FallbackMap space={vacío} />);

    expect(getByText('Todavía no hay puntos con posición en este lote.')).toBeTruthy();
    expect(queryByTestId('croquis')).toBeNull();
  });
});
