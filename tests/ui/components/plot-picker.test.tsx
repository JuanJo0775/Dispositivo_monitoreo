import { render } from '@testing-library/react-native';

import type { Plot } from '@/domain/farm/types';
import { PlotPicker } from '@/ui/components/plot-picker';

function makePlot(overrides: Partial<Plot> = {}): Plot {
  return {
    id: 'lote-1',
    farmId: 'finca-1',
    name: 'Lote 1',
    cropPrimary: 'cafe',
    cropSecondary: null,
    depthCm: 20,
    cartographicUnit: 'chinchina',
    lastFertilizationDate: null,
    drainage: null,
    shading: null,
    density: null,
    plantingDensityHa: null,
    altitudeM: null,
    slope: null,
    notes: null,
    deletedAt: null,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('PlotPicker', () => {
  it('muestra el nombre de cada lote', async () => {
    const { getByText } = await render(
      <PlotPicker
        plots={[
          makePlot({ id: 'lote-1', name: 'Lote del cafetal' }),
          makePlot({ id: 'lote-2', name: 'Lote de la guadual' }),
        ]}
        onSelect={() => {}}
      />,
    );

    expect(getByText('Lote del cafetal')).toBeTruthy();
    expect(getByText('Lote de la guadual')).toBeTruthy();
  });

  it('avisa cuando no hay lotes', async () => {
    const { getByText } = await render(<PlotPicker plots={[]} onSelect={() => {}} />);

    expect(getByText('Todavía no hay lotes registrados.')).toBeTruthy();
  });
});
