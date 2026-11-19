import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { parseThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { StickCandidate, StickGateway, StickStatus } from '@/ports/stick-gateway';
import type { AppServices } from '@/ui/providers/app-context';
import { AppContext } from '@/ui/providers/app-context';
import { StickSettingsContext } from '@/ui/providers/stick-settings';

import ConnectScreen from '../../../app/connect';
import rawSet from '../../../assets/thresholds/2026.11-v1.json';
import { fakeBaseMap } from '../../helpers/base-map';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

const thresholds = parseThresholdSet(rawSet);

const SIN_CONECTAR: StickStatus = {
  connected: false,
  deviceId: null,
  batteryPct: null,
  firmwareVersion: null,
  protocolVersion: null,
  state: 'idle',
};

/** Gateway de mentira: guarda lo que la pantalla le pide. */
function makeGateway(candidates: StickCandidate[]) {
  let statusValue: StickStatus = SIN_CONECTAR;

  const gateway: StickGateway = {
    scan: jest.fn(async () => candidates),
    connect: jest.fn(async (deviceId: string) => {
      statusValue = { ...SIN_CONECTAR, connected: true, deviceId, state: 'ready' };
    }),
    disconnect: jest.fn(async () => {}),
    pair: jest.fn(),
    onCapture: () => () => {},
    onStatus: () => () => {},
    requestCapture: jest.fn(async () => {}),
    writeConfig: jest.fn(async () => {}),
    confirm: jest.fn(async () => {}),
    status: () => statusValue,
  };

  return gateway;
}

const BASTON: StickCandidate = {
  deviceId: 'AA:BB:CC:DD:EE:FF',
  name: 'Agrovia-baston',
  rssi: -55,
  compatible: true,
};

const AJENO: StickCandidate = {
  deviceId: '11:22:33:44:55:66',
  name: 'Audífonos',
  rssi: -80,
  compatible: false,
};

function makeServices(gateway: StickGateway): AppServices {
  return {
    stores: {} as unknown as AppServices['stores'],
    uow: {} as unknown as AppServices['uow'],
    gateway,
    sync: {} as unknown as AppServices['sync'],
    mapFiles: {} as unknown as AppServices['mapFiles'],
    baseMap: fakeBaseMap,
    deviceId: 'simulated-stick',
    thresholds,
  };
}

async function renderScreen(gateway: StickGateway, setMode = jest.fn()) {
  const pantalla = await render(
    <StickSettingsContext.Provider value={{ mode: 'simulated', setMode }}>
      <AppContext.Provider value={{ services: makeServices(gateway), error: null }}>
        <ConnectScreen />
      </AppContext.Provider>
    </StickSettingsContext.Provider>,
  );

  return { pantalla, setMode };
}

describe('pantalla de conexión', () => {
  it('busca y lista los aparatos que hay cerca', async () => {
    const gateway = makeGateway([BASTON, AJENO]);
    const { pantalla } = await renderScreen(gateway);

    await fireEvent.press(pantalla.getByRole('button', { name: 'Buscar bastones' }));

    await waitFor(() => expect(gateway.scan).toHaveBeenCalledTimes(1));
    expect(pantalla.getByText('Agrovia-baston')).toBeTruthy();
    expect(pantalla.getByText('Audífonos')).toBeTruthy();
    expect(pantalla.getByText('Del contrato')).toBeTruthy();
    expect(pantalla.getByText('Otro aparato')).toBeTruthy();
  });

  it('conecta con el aparato que la persona toca', async () => {
    const gateway = makeGateway([BASTON]);
    const { pantalla } = await renderScreen(gateway);

    await fireEvent.press(pantalla.getByRole('button', { name: 'Buscar bastones' }));
    await waitFor(() => expect(pantalla.getByText('Agrovia-baston')).toBeTruthy());

    await fireEvent.press(pantalla.getByRole('button', { name: 'Conectar Agrovia-baston' }));

    await waitFor(() => expect(gateway.connect).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF'));
  });

  it('avisa cuando no aparece ningún aparato', async () => {
    const gateway = makeGateway([]);
    const { pantalla } = await renderScreen(gateway);

    await fireEvent.press(pantalla.getByRole('button', { name: 'Buscar bastones' }));

    await waitFor(() =>
      expect(
        pantalla.getByText(
          'No apareció ningún bastón. Revisa que esté encendido y cerca del teléfono.',
        ),
      ).toBeTruthy(),
    );
  });

  it('muestra el error del gateway sin quedarse girando', async () => {
    const gateway = makeGateway([BASTON]);
    (gateway.scan as jest.Mock).mockRejectedValueOnce(new Error('Bluetooth apagado'));

    const { pantalla } = await renderScreen(gateway);

    await fireEvent.press(pantalla.getByRole('button', { name: 'Buscar bastones' }));

    await waitFor(() => expect(pantalla.getByText('Bluetooth apagado')).toBeTruthy());
  });

  it('permite volver al bastón real', async () => {
    const gateway = makeGateway([BASTON]);
    const { pantalla, setMode } = await renderScreen(gateway);

    await fireEvent.press(pantalla.getByRole('button', { name: 'Volver al bastón real' }));

    await waitFor(() => expect(setMode).toHaveBeenCalledWith('real'));
  });
});
