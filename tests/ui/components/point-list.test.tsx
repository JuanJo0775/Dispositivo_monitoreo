import { fireEvent, render } from '@testing-library/react-native';

import { PointList } from '@/ui/components/map/point-list';
import { makeAlert } from '../../helpers/diagnoses';
import { makePlotSpaceWith } from '../../helpers/plot-space';

describe('PointList', () => {
  it('dice «sin posición» cuando el bastón no dio coordenadas', async () => {
    const space = await makePlotSpaceWith([
      { id: 'm-sin', latitude: null, longitude: null, positionValid: false },
    ]);

    const { getByText } = await render(<PointList space={space} />);

    expect(getByText('sin posición')).toBeTruthy();
    expect(getByText('Sin posición del GPS: no se puede ubicar en el mapa.')).toBeTruthy();
  });

  it('distingue la posición imprecisa con texto y muestra las coordenadas', async () => {
    const space = await makePlotSpaceWith([{ id: 'm-1', hdop: 7 }]);

    const { getByText } = await render(<PointList space={space} />);

    expect(getByText('4,53390, -75,68110')).toBeTruthy();
    expect(getByText(/^posición imprecisa/)).toBeTruthy();
  });

  it('muestra la clase del punto y sus alertas, y lo abre al tocar', async () => {
    const space = await makePlotSpaceWith([
      {
        id: 'm-moderado',
        diagnosisClasses: ['S2'],
        alerts: [makeAlert('humedad_baja', 'warning', 'La humedad está por debajo del umbral.')],
      },
    ]);
    const abiertas: string[] = [];

    const { getByText, getByLabelText } = await render(
      <PointList space={space} onSelectMeasurement={(id) => abiertas.push(id)} />,
    );

    expect(getByText('Moderadamente apto')).toBeTruthy();
    expect(getByText('La humedad está por debajo del umbral.')).toBeTruthy();

    await fireEvent.press(getByLabelText(/Medición del/));

    expect(abiertas).toEqual(['m-moderado']);
  });

  it('marca la medición inválida y no le inventa una clase', async () => {
    const space = await makePlotSpaceWith([
      { id: 'm-invalida', valid: false, diagnosisClasses: ['S1'] },
    ]);

    const { getByText, queryByText } = await render(<PointList space={space} />);

    expect(getByText('Medición inválida: no entra al dictamen.')).toBeTruthy();
    expect(queryByText('Apto')).toBeNull();
  });
});
