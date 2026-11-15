import { fireEvent, render } from '@testing-library/react-native';

import type { PlotSpace } from '@/application/map/describe-plot-space';
import type { CellState } from '@/domain/geo/cell-verdict';
import { CellSheet } from '@/ui/components/map/cell-sheet';
import { makeVariable } from '../../helpers/diagnoses';
import { makePlotSpaceWith } from '../../helpers/plot-space';

/** Celda del estado pedido; la prueba falla si el espacio no la produjo. */
function celdaConEstado(space: PlotSpace, state: CellState) {
  const encontrada = space.cells.find((celda) => celda.verdict.state === state);

  if (encontrada === undefined) {
    throw new Error(`El espacio de prueba no tiene una celda en estado ${state}`);
  }

  return encontrada;
}

describe('CellSheet', () => {
  it('en una celda no concluyente muestra el conteo por clase y el motivo, sin elegir una clase', async () => {
    const space = await makePlotSpaceWith([
      { id: 'm-apto', diagnosisClasses: ['S1'] },
      { id: 'm-moderado', diagnosisClasses: ['S2'] },
    ]);
    const celda = celdaConEstado(space, 'no_concluyente');

    const { getByText, queryByText } = await render(
      <CellSheet space={space} cellId={celda.cell.id} onClose={() => {}} />,
    );

    expect(getByText('No concluyente')).toBeTruthy();
    expect(getByText(/no coinciden en su conjunto de clases/)).toBeTruthy();
    expect(getByText('1 Apto')).toBeTruthy();
    expect(getByText('1 Moderadamente apto')).toBeTruthy();
    expect(getByText('2 puntos válidos')).toBeTruthy();

    // El dictamen de la celda no se presenta como una clase suelta.
    expect(queryByText(/entre Apto/)).toBeNull();
  });

  it('en una celda con resumen muestra la mediana y el mínimo–máximo por variable', async () => {
    const space = await makePlotSpaceWith([
      { id: 'm-uno', diagnosisClasses: ['S1'], variables: [makeVariable('ph', 5.2, 'pH')] },
      { id: 'm-dos', diagnosisClasses: ['S1'], variables: [makeVariable('ph', 5.8, 'pH')] },
    ]);
    const celda = celdaConEstado(space, 'resumen');

    const { getByText } = await render(
      <CellSheet space={space} cellId={celda.cell.id} onClose={() => {}} />,
    );

    expect(getByText(/pH: mediana 5,5 pH/)).toBeTruthy();
    expect(getByText(/mínimo 5,2/)).toBeTruthy();
    expect(getByText(/máximo 5,8/)).toBeTruthy();
  });

  it('en una celda vacía dice que no hay mediciones y la pinta como sin dato', async () => {
    const space = await makePlotSpaceWith([
      { id: 'm-oeste', diagnosisClasses: ['S1'] },
      { id: 'm-este', longitude: -75.679298, diagnosisClasses: ['S2'] },
    ]);
    const celda = celdaConEstado(space, 'sin_dato');

    const { getByText } = await render(
      <CellSheet space={space} cellId={celda.cell.id} onClose={() => {}} />,
    );

    expect(getByText('Sin dato')).toBeTruthy();
    expect(getByText('Ninguna medición cayó en esta celda.')).toBeTruthy();
  });

  it('tocar una medición la abre y cerrar avisa a la pantalla', async () => {
    const space = await makePlotSpaceWith([{ id: 'm-uno', diagnosisClasses: ['S1'] }]);
    const celda = celdaConEstado(space, 'un_punto');
    const abiertas: string[] = [];
    let cerrada = false;

    const { getByLabelText, getByText } = await render(
      <CellSheet
        space={space}
        cellId={celda.cell.id}
        onSelectMeasurement={(id) => abiertas.push(id)}
        onClose={() => {
          cerrada = true;
        }}
      />,
    );

    fireEvent.press(getByLabelText(/Medición del/));
    fireEvent.press(getByText('Cerrar'));

    expect(abiertas).toEqual(['m-uno']);
    expect(cerrada).toBe(true);
  });
});
