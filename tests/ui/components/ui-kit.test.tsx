import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ActionCard } from '@/ui/components/ui/action-card';
import { Badge } from '@/ui/components/ui/badge';
import { Card } from '@/ui/components/ui/card';
import { SectionHeader } from '@/ui/components/ui/section-header';
import { colors } from '@/ui/theme';

describe('Card', () => {
  it('dibuja la franja del color pedido', async () => {
    const vista = await render(
      <Card accent="wine" testID="tarjeta">
        <Text>Contenido</Text>
      </Card>,
    );

    const franja = vista.getByTestId('tarjeta-accent');

    expect(franja.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: colors.wine })]),
    );
    expect(vista.getByText('Contenido')).toBeTruthy();
  });

  it('sin franja no dibuja el adorno', async () => {
    const vista = await render(
      <Card testID="tarjeta">
        <Text>Contenido</Text>
      </Card>,
    );

    expect(vista.queryByTestId('tarjeta-accent')).toBeNull();
  });
});

describe('Badge', () => {
  it('muestra el texto y el color del tono', async () => {
    const vista = await render(<Badge label="En uso" tone="success" testID="distintivo" />);

    const etiqueta = vista.getByText('En uso');

    expect(etiqueta.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: colors.success })]),
    );
  });
});

describe('SectionHeader', () => {
  it('muestra el título y la línea de apoyo', async () => {
    const vista = await render(
      <SectionHeader title="Tareas frecuentes" detail="Todo lo que ya está en el teléfono." />,
    );

    expect(vista.getByText('Tareas frecuentes')).toBeTruthy();
    expect(vista.getByText('Todo lo que ya está en el teléfono.')).toBeTruthy();
  });
});

describe('ActionCard', () => {
  it('abre la pantalla al tocar toda la tarjeta', async () => {
    const onPress = jest.fn();
    const vista = await render(
      <ActionCard
        title="Mapa del lote"
        detail="Malla y puntos."
        accent="terracotta"
        onPress={onPress}
      />,
    );

    await fireEvent.press(vista.getByRole('button', { name: 'Mapa del lote' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
