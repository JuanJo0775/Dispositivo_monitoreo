import { render } from '@testing-library/react-native';

import { HistoryList } from '@/ui/components/history-list';

import { makeMeasurement } from '../../helpers/measurements';

describe('HistoryList', () => {
  it('muestra la humedad con su unidad y la fecha local', async () => {
    const { getByText } = await render(
      <HistoryList measurements={[makeMeasurement({ humidityPct: 38 })]} onSelect={() => {}} />,
    );

    expect(getByText('38 % v/v')).toBeTruthy();
    expect(getByText('12/11/2026, 12:05')).toBeTruthy();
  });

  it('muestra «sin dato» cuando la humedad es nula, no un cero', async () => {
    const { getByText } = await render(
      <HistoryList measurements={[makeMeasurement({ humidityPct: null })]} onSelect={() => {}} />,
    );

    expect(getByText('sin dato')).toBeTruthy();
  });

  it('marca las mediciones inválidas como «revisar»', async () => {
    const { getByText } = await render(
      <HistoryList
        measurements={[makeMeasurement({}, { valid: false, invalidReasons: ['probe_fault'] })]}
        onSelect={() => {}}
      />,
    );

    expect(getByText('revisar')).toBeTruthy();
  });

  it('explica cuando no hay mediciones', async () => {
    const { getByText } = await render(<HistoryList measurements={[]} onSelect={() => {}} />);

    expect(getByText('Todavía no hay mediciones guardadas.')).toBeTruthy();
  });
});
