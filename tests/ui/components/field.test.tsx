import { render } from '@testing-library/react-native';

import { Field } from '@/ui/components/field';

describe('Field', () => {
  it('muestra la etiqueta y el valor', async () => {
    const { getByText } = await render(<Field label="Cultivo principal" value="Café" />);

    expect(getByText('Cultivo principal')).toBeTruthy();
    expect(getByText('Café')).toBeTruthy();
  });

  it('muestra «sin dato» cuando el valor es nulo, no un cero', async () => {
    const { getByText } = await render(<Field label="Altitud" value={null} />);

    expect(getByText('Altitud')).toBeTruthy();
    expect(getByText('sin dato')).toBeTruthy();
  });

  it('muestra «sin dato» cuando el valor no viene', async () => {
    const { getByText } = await render(<Field label="Drenaje" />);

    expect(getByText('sin dato')).toBeTruthy();
  });
});
