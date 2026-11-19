import { fireEvent, render } from '@testing-library/react-native';

import HomeScreen from '../../../app/index';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

beforeEach(() => {
  mockRouter.push.mockClear();
});

describe('pantalla de inicio', () => {
  it('lleva a conectar el bastón', async () => {
    const vista = await render(<HomeScreen />);

    await fireEvent.press(vista.getByRole('button', { name: 'Conectar bastón' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/connect');
  });

  it('ofrece las cuatro tareas frecuentes', async () => {
    const vista = await render(<HomeScreen />);

    for (const nombre of ['Medir', 'Historial', 'Mapa del lote', 'Sincronizar microSD']) {
      expect(vista.getByRole('button', { name: nombre })).toBeTruthy();
    }
  });

  it('abre el mapa del lote desde su tarjeta', async () => {
    const vista = await render(<HomeScreen />);

    await fireEvent.press(vista.getByRole('button', { name: 'Mapa del lote' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/map');
  });
});
