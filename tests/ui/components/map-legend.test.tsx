import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { CLASS_COLORS, INCONCLUSIVE_COLOR, NO_DATA_COLOR } from '@/ui/components/map/map-colors';
import { MapLegend } from '@/ui/components/map/map-legend';

function backgroundColor(estilo: unknown): string | undefined {
  return StyleSheet.flatten(estilo as never)?.backgroundColor as string | undefined;
}

describe('MapLegend', () => {
  it('nombra cada clase junto a su color: el color no es el único canal', async () => {
    const { getByText, getByTestId, queryByText } = await render(
      <MapLegend classes={['S1', 'N']} />,
    );

    expect(getByText('Apto')).toBeTruthy();
    expect(getByText('No apto')).toBeTruthy();
    expect(queryByText('Moderadamente apto')).toBeNull();
    expect(backgroundColor(getByTestId('muestra-S1').props.style)).toBe(CLASS_COLORS.S1);
    expect(backgroundColor(getByTestId('muestra-N').props.style)).toBe(CLASS_COLORS.N);
  });

  it('muestra la celda vacía con su gris y no con el color de una clase', async () => {
    const { getByText, getByTestId } = await render(<MapLegend classes={['S1']} />);

    const color = backgroundColor(getByTestId('muestra-sin-dato').props.style);

    expect(getByText('Sin dato')).toBeTruthy();
    expect(color).toBe(NO_DATA_COLOR);
    expect(Object.values(CLASS_COLORS)).not.toContain(color);
  });

  it('explica el caso de dos clases con una muestra de dos tonos', async () => {
    const { getByText, getByTestId } = await render(
      <MapLegend classes={['S1', 'S2']} showTwoTone />,
    );

    const muestra = getByTestId('muestra-dos-tonos');
    const estilo = StyleSheet.flatten(muestra.props.style);

    expect(getByText(/Dos clases posibles/)).toBeTruthy();
    expect(estilo?.backgroundColor).toBe(CLASS_COLORS.S1);
    expect(estilo?.borderColor).toBe(CLASS_COLORS.S2);
    expect(estilo?.borderWidth).toBe(3);
  });

  it('nombra el estado no concluyente con su propio color', async () => {
    const { getByText, getByTestId } = await render(<MapLegend classes={[]} />);

    expect(getByText('No concluyente')).toBeTruthy();
    expect(backgroundColor(getByTestId('muestra-no-concluyente').props.style)).toBe(
      INCONCLUSIVE_COLOR,
    );
  });
});
