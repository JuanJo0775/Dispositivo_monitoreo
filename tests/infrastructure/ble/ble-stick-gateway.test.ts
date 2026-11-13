import type { RawCapture } from '@/domain/capture/types';
import { RECORD_HEADERS } from '@/domain/protocol/record-codec';
import type { SessionConfig } from '@/domain/session/types';
import { BleStickGateway } from '@/infrastructure/ble/ble-stick-gateway';
import { makeFakeBleTransport } from '@/infrastructure/ble/fake-ble-transport';
import {
  DEFAULT_SIMULATED_PIN,
  DEFAULT_SIMULATED_SALT,
  SimulatedStickDevice,
} from '@/infrastructure/ble/simulated-stick-device';
import type { BleTransport } from '@/ports/ble-transport';
import type { StickGatewayState } from '@/ports/stick-gateway';
import type { SyncChunk } from '@/ports/stick-sync';

/** Configuración de sesión de las pruebas. */
function configuracion(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    configId: 7,
    plotId: 'plot-1',
    cropPrimary: 'cafe',
    cropSecondary: null,
    depthCm: 20,
    cartographicUnit: 'chinchina',
    lastFertilizationDate: '2026-10-01',
    thresholdsVersion: '2026.11-v1',
    createdAtUtc: '2026-11-12T15:00:00Z',
    ...overrides,
  };
}

/** Líneas CSV de tres registros, como los que hay en la microSD. */
const REGISTROS = [
  '1,stick-01,2026-11-12,12:00:00,4.5339,-75.6811,1550,0.4,9,0.9,1.2,20,0,,plot-1,,38,21.5,5.4,120,12,18,95,31,82,0.1.0',
  '2,stick-01,2026-11-12,12:01:00,4.5340,-75.6812,1551,0.5,9,0.9,1.1,20,0,,plot-1,,38,21.6,5.4,120,12,18,95,31,82,0.1.0',
  '3,stick-01,2026-11-12,12:02:00,4.5341,-75.6813,1552,0.6,9,0.9,1.0,20,0,,plot-1,,38,21.7,5.4,120,12,18,95,31,82,0.1.0',
];

/** Siembra la microSD del bastón con los registros de las pruebas. */
function sembrar(device: SimulatedStickDevice): void {
  device.seedCsv([RECORD_HEADERS.join(','), ...REGISTROS].join('\n'));
}

/** Gateway con el PIN y la sal del simulador, para que las claves cuadren. */
function gatewayDe(
  transport: BleTransport,
  extra: Partial<ConstructorParameters<typeof BleStickGateway>[1]> = {},
): BleStickGateway {
  return new BleStickGateway(transport, {
    pin: DEFAULT_SIMULATED_PIN,
    salt: DEFAULT_SIMULATED_SALT,
    syncIdleMs: 20,
    delay: async () => undefined,
    ...extra,
  });
}

/** Espera a que se cumpla una condición, sin colgarse para siempre. */
async function esperar(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const inicio = Date.now();

  while (!condition()) {
    if (Date.now() - inicio > timeoutMs) {
      throw new Error('La condición no se cumplió a tiempo.');
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Transporte que corta el enlace con el bastón a voluntad. */
function transportInterrumpido(
  inner: BleTransport,
  opciones: { fallaReconexion?: boolean } = {},
): BleTransport & { cortarEnlace(): void } {
  const listeners = new Set<() => void>();
  let caido = false;

  return {
    ...inner,
    async connect(deviceId: string): Promise<void> {
      if (caido && opciones.fallaReconexion === true) {
        throw new Error('El bastón no responde.');
      }

      await inner.connect(deviceId);
    },
    onDisconnected(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    cortarEnlace(): void {
      caido = true;
      listeners.forEach((listener) => listener());
    },
  };
}

/** Transporte que daña el CRC de las escrituras a una característica. */
function transportConCrcDanado(inner: BleTransport, clave: string): BleTransport {
  return {
    ...inner,
    async write(key: string, bytes: Uint8Array, withResponse: boolean): Promise<void> {
      if (key !== clave) {
        await inner.write(key, bytes, withResponse);
        return;
      }

      const dañado = new Uint8Array(bytes);
      dañado[4] = (dañado[4] ?? 0) ^ 0xff;

      await inner.write(key, dañado, withResponse);
    },
  };
}

describe('BleStickGateway', () => {
  it('conectar y descubrir deja el gateway en ready con el estado del bastón', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01', batteryPct: 77 });
    const gateway = gatewayDe(makeFakeBleTransport(device));

    await gateway.connect('stick-01');

    expect(gateway.state()).toBe('ready');
    expect(gateway.status().connected).toBe(true);
    expect(gateway.status().deviceId).toBe('stick-01');
    expect(gateway.status().batteryPct).toBe(77);
    expect(gateway.status().firmwareVersion).toBe('0.1.0');
    expect(gateway.status().protocolVersion).toBe('1');
    expect(gateway.status().microSdOk).toBe(true);
    expect(gateway.status().satellites).toBe(9);
    expect(gateway.status().hdop).toBe(0.9);
    expect(gateway.status().recordCount).toBe(0);
    expect(gateway.status().deviceTimeUtc).toBe('2026-11-12T15:00:00.000Z');
    expect(gateway.status().state).toBe('ready');
  });

  it('una versión mayor de protocolo bloquea la conexión con un mensaje en español', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01', protocolVersion: 2 });
    const gateway = gatewayDe(makeFakeBleTransport(device));

    await expect(gateway.connect('stick-01')).rejects.toThrow(/versión de protocolo incompatible/i);
    expect(gateway.state()).toBe('error');
    expect(gateway.status().connected).toBe(false);
  });

  it('la configuración se escribe cifrada y el bastón la acepta', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const gateway = gatewayDe(makeFakeBleTransport(device));

    await gateway.connect('stick-01');
    await gateway.writeConfig(configuracion());

    expect(device.configStatus().aceptada).toBe(true);
    expect(device.configStatus().motivo).toBeNull();
    expect(device.activeConfig()?.configId).toBe(7);
    expect(device.activeConfig()?.plotId).toBe('plot-1');
    expect(device.activeConfig()?.cropPrimary).toBe('cafe');
    expect(gateway.state()).toBe('ready');
  });

  it('una configuración con CRC inválido se rechaza y el error lo dice', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const transport = transportConCrcDanado(makeFakeBleTransport(device), 'configEscritura');
    const gateway = gatewayDe(transport);

    await gateway.connect('stick-01');

    await expect(gateway.writeConfig(configuracion())).rejects.toThrow(/CRC/i);

    expect(device.configStatus().aceptada).toBe(false);
    expect(device.configStatus().motivo).toBe('crc_invalido');
    expect(device.activeConfig()).toBeNull();
    expect(gateway.state()).toBe('ready');
  });

  it('una captura en vivo llega al suscriptor con sus campos', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const gateway = gatewayDe(makeFakeBleTransport(device));
    const capturas: RawCapture[] = [];

    gateway.onCapture((capture) => capturas.push(capture));

    await gateway.connect('stick-01');
    await gateway.writeConfig(configuracion());
    await gateway.requestCapture();

    expect(capturas).toHaveLength(1);

    const captura = capturas[0];

    expect(captura?.deviceId).toBe('stick-01');
    expect(captura?.sequence).toBe(1);
    expect(captura?.configId).toBe(7);
    expect(captura?.plotId).toBe('plot-1');
    expect(captura?.origin).toBe('stick');
    expect(captura?.capturedAtUtc).toBe('2026-11-12T15:00:00Z');
    expect(captura?.payload.cropCode).toBe('cafe');
    expect(captura?.payload.plotCode).toBe('plot-1');
    expect(captura?.payload.humidityPct).toBe(38);
    expect(captura?.payload.ph).toBe(5.4);
    expect(captura?.payload.firmwareVersion).toBe('0.1.0');
    expect(captura?.flags.positionValid).toBe(true);
    expect(captura?.flags.probeOk).toBe(true);
    expect(captura?.flags.timeValid).toBe(true);
    expect(captura?.flags.simulated).toBe(true);
    expect(captura?.flags.ecOverThreshold).toBe(false);
  });

  it('confirm y confirmRecords llegan al bastón', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const gateway = gatewayDe(makeFakeBleTransport(device));

    await gateway.connect('stick-01');
    await gateway.requestCapture();
    await gateway.confirm(1);

    expect(device.lastConfirmedSequence()).toBe(1);
    expect(device.pendingRecords()).toHaveLength(0);

    await gateway.requestCapture();
    await gateway.confirmRecords('stick-01', 2);

    expect(device.lastConfirmedSequence()).toBe(2);
  });

  it('syncFrom entrega los bloques con sus líneas CSV y el último id', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01', mtu: 512 });
    sembrar(device);

    const gateway = gatewayDe(makeFakeBleTransport(device));
    const bloques: SyncChunk[] = [];

    await gateway.connect('stick-01');
    await gateway.syncFrom('stick-01', 1, async (chunk) => {
      bloques.push(chunk);
    });

    const lineas = bloques.flatMap((bloque) => bloque.records);

    expect(bloques.length).toBeGreaterThan(0);
    expect(lineas).toHaveLength(3);
    expect(lineas[0]).toBe(REGISTROS[0]);
    expect(lineas[2]).toMatch(/^3,stick-01,/);
    expect(bloques[bloques.length - 1]?.lastSequence).toBe(3);
    expect(gateway.state()).toBe('ready');
  });

  it('un bloque con CRC inválido no se entrega', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01', mtu: 512 });
    sembrar(device);
    device.injectInvalidCrcOnNextSyncBlock();

    const gateway = gatewayDe(makeFakeBleTransport(device));
    const bloques: SyncChunk[] = [];

    await gateway.connect('stick-01');

    await expect(
      gateway.syncFrom('stick-01', 1, async (chunk) => {
        bloques.push(chunk);
      }),
    ).rejects.toThrow(/CRC/i);

    expect(bloques).toHaveLength(0);
  });

  it('las escrituras van de una en una y en orden', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const inner = makeFakeBleTransport(device);
    const enCurso: string[] = [];
    const orden: string[] = [];

    const transport: BleTransport = {
      ...inner,
      async write(key: string, bytes: Uint8Array, withResponse: boolean): Promise<void> {
        enCurso.push(key);
        expect(enCurso).toHaveLength(1);
        orden.push(key);

        await new Promise((resolve) => setTimeout(resolve, 5));

        enCurso.pop();
        await inner.write(key, bytes, withResponse);
      },
    };

    const gateway = gatewayDe(transport);

    await gateway.connect('stick-01');
    await gateway.requestCapture();
    await gateway.confirm(1);

    expect(orden).toEqual(['controlEscritura', 'syncConfirmacion']);
  });

  it('el estado de la máquina se muestra en el estado del bastón', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const gateway = gatewayDe(makeFakeBleTransport(device));
    const estados: StickGatewayState[] = [];

    gateway.onStatus((status) => {
      if (status.state !== undefined) {
        estados.push(status.state);
      }
    });

    await gateway.connect('stick-01');

    expect(estados).toContain('scanning');
    expect(estados).toContain('connecting');
    expect(estados).toContain('discovering');
    expect(estados).toContain('ready');
    expect(gateway.status().state).toBe('ready');
  });

  it('se reconecta solo cuando se cae el enlace', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const transport = transportInterrumpido(makeFakeBleTransport(device));
    const gateway = gatewayDe(transport, { maxReconnectAttempts: 2, reconnectDelayMs: 1 });

    await gateway.connect('stick-01');
    expect(gateway.state()).toBe('ready');

    transport.cortarEnlace();

    expect(gateway.state()).toBe('reconnecting');

    await esperar(() => gateway.state() === 'ready');

    expect(gateway.state()).toBe('ready');
    expect(gateway.status().connected).toBe(true);
  });

  it('si la reconexión falla queda en error y espera la acción manual', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const transport = transportInterrumpido(makeFakeBleTransport(device), {
      fallaReconexion: true,
    });
    const gateway = gatewayDe(transport, { maxReconnectAttempts: 2, reconnectDelayMs: 1 });

    await gateway.connect('stick-01');

    transport.cortarEnlace();

    await esperar(() => gateway.state() === 'error');

    expect(gateway.state()).toBe('error');

    gateway.reset();

    expect(gateway.state()).toBe('idle');
    expect(gateway.status().connected).toBe(false);
  });

  it('sin emparejar no deja escribir la configuración cifrada', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const gateway = new BleStickGateway(makeFakeBleTransport(device), { syncIdleMs: 20 });

    await gateway.connect('stick-01');

    await expect(gateway.writeConfig(configuracion())).rejects.toThrow(/emparejado/i);
    expect(gateway.state()).toBe('ready');
  });
});
