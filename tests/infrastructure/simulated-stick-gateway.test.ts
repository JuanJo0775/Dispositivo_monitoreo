import { SimulatedStickGateway } from '@/infrastructure/ble/simulated-stick-gateway';

describe('SimulatedStickGateway', () => {
  it('emite una captura con secuencia creciente al pedirla', async () => {
    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });
    const seen: number[] = [];
    gateway.onCapture((capture) => seen.push(capture.sequence));

    await gateway.connect('stick-01');
    await gateway.requestCapture();
    await gateway.requestCapture();

    expect(seen).toEqual([1, 2]);
  });

  it('marca la captura como simulada para no diagnosticarla como productiva', async () => {
    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });
    let simulated = false;
    gateway.onCapture((capture) => {
      simulated = capture.flags.simulated;
    });

    await gateway.connect('stick-01');
    await gateway.requestCapture();

    expect(simulated).toBe(true);
  });

  it('rechaza conectar cuando failOnConnect', async () => {
    const gateway = new SimulatedStickGateway({ failOnConnect: true });

    await expect(gateway.connect('stick-01')).rejects.toThrow('no disponible');
  });

  it('expone estado tras conectar y desconectar', async () => {
    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });

    await gateway.connect('stick-01');
    expect(gateway.status().connected).toBe(true);
    expect(gateway.status().deviceId).toBe('stick-01');

    await gateway.disconnect();
    expect(gateway.status().connected).toBe(false);
  });

  it('notifica cambios de estado a los suscriptores', async () => {
    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });
    const states: boolean[] = [];
    gateway.onStatus((status) => states.push(status.connected));

    await gateway.connect('stick-01');
    await gateway.disconnect();

    expect(states).toEqual([true, false]);
  });

  it('no captura si no está conectado', async () => {
    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });

    await expect(gateway.requestCapture()).rejects.toThrow('no conectado');
  });

  it('deja de notificar tras desuscribirse', async () => {
    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });
    const seen: number[] = [];
    const unsubscribe = gateway.onCapture((capture) => seen.push(capture.sequence));

    await gateway.connect('stick-01');
    await gateway.requestCapture();
    unsubscribe();
    await gateway.requestCapture();

    expect(seen).toEqual([1]);
  });

  it('recuerda la última secuencia confirmada', async () => {
    const gateway = new SimulatedStickGateway({ deviceId: 'stick-01' });

    await gateway.connect('stick-01');
    await gateway.requestCapture();
    await gateway.confirm(1);

    expect(gateway.lastConfirmedSequence()).toBe(1);
  });
});
