import { decodeFrame, encodeFrame, Opcode } from '@/domain/protocol/frame';
import { RECORD_HEADERS } from '@/domain/protocol/record-codec';
import type { SessionConfig } from '@/domain/session/types';
import { makeFakeBleTransport } from '@/infrastructure/ble/fake-ble-transport';
import {
  createStickCipher,
  decodeUtf8,
  DEFAULT_SIMULATED_SALT,
  deterministicRandomBytes,
  encodeUtf8,
  SimulatedStickDevice,
  type StickPayloadCipher,
} from '@/infrastructure/ble/simulated-stick-device';

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

/** Cuerpo cifrado de la configuración de sesión, como lo escribiría la app. */
function configCifrada(device: SimulatedStickDevice, config: SessionConfig): Uint8Array {
  const cuerpo = {
    config_id: config.configId,
    plot_id: config.plotId,
    crop_primary: config.cropPrimary,
    crop_secondary: config.cropSecondary,
    depth_cm: config.depthCm,
    cartographic_unit: config.cartographicUnit,
    last_fertilization_date: config.lastFertilizationDate,
    thresholds_version: config.thresholdsVersion,
    created_at_utc: config.createdAtUtc,
  };

  return encodeFrame(
    Opcode.ConfigEscritura,
    device.encryptPayload(encodeUtf8(JSON.stringify(cuerpo))),
  );
}

describe('SimulatedStickDevice', () => {
  it('responde el estado con batería, firmware y versión de protocolo', () => {
    const device = new SimulatedStickDevice({ batteryPct: 64, firmwareVersion: '0.2.3' });

    const estado = device.status();

    expect(estado.batteryPct).toBe(64);
    expect(estado.firmwareVersion).toBe('0.2.3');
    expect(estado.protocolVersion).toBe(1);
    expect(estado.microSd).toBe('ok');
    expect(estado.gps.sats).toBe(9);
    expect(estado.utcTime).toBe('2026-11-12T15:00:00.000Z');
  });

  it('la microSD guarda los registros numerados desde 1', () => {
    const device = new SimulatedStickDevice();

    device.seedCsv(
      [
        RECORD_HEADERS.join(','),
        '1,stick-01,2026-11-12,12:00:00,4.5339,-75.6811,1550,0.4,9,0.9,1.2,20,0,,plot-1,,38,21.5,5.4,120,12,18,95,31,82,0.1.0',
        '2,stick-01,2026-11-12,12:01:00,4.5340,-75.6812,1551,0.5,9,0.9,1.1,20,0,,plot-1,,38,21.6,5.4,120,12,18,95,31,82,0.1.0',
      ].join('\n'),
    );

    const pendientes = device.pendingRecords();

    expect(pendientes).toHaveLength(2);
    expect(pendientes[0]?.idRegistro).toBe(1);
    expect(pendientes[1]?.idRegistro).toBe(2);
    expect(device.microSdCsv().split('\n')[0]).toBe(RECORD_HEADERS.join(','));
  });

  it('una captura trae el config_id y el contexto de la configuración activa', () => {
    const device = new SimulatedStickDevice();

    device.writeSessionConfig(configuracion());
    const captura = device.captureNow();

    expect(captura.configId).toBe(7);
    expect(captura.cultivo).toBe('cafe');
    expect(captura.loteId).toBe('plot-1');
    expect(captura.fertFecha).toBe('2026-10-01');
    expect(captura.profCm).toBe(20);
  });

  it('sin configuración válida las capturas salen con config_id 0', () => {
    const device = new SimulatedStickDevice();

    const captura = device.captureNow();

    expect(captura.configId).toBe(0);
    expect(captura.loteId).toBeNull();
  });

  it('la configuración sobrevive a un reinicio y sigue aplicándose', () => {
    const device = new SimulatedStickDevice();

    device.writeSessionConfig(configuracion());
    device.restart();

    expect(device.activeConfig()?.configId).toBe(7);

    const captura = device.captureNow();
    expect(captura.configId).toBe(7);
    expect(captura.cultivo).toBe('cafe');
    expect(captura.loteId).toBe('plot-1');
  });

  it('rechaza una configuración con CRC inválido y lo informa', () => {
    const device = new SimulatedStickDevice();
    const trama = configCifrada(device, configuracion());
    trama[4] = (trama[4] ?? 0) ^ 0xff;

    device.handleWrite('configEscritura', trama);

    const estado = device.configStatus();
    expect(estado.aceptada).toBe(false);
    expect(estado.motivo).toBe('crc_invalido');
    expect(device.activeConfig()).toBeNull();
  });

  it('rechaza una configuración escrita con una clave distinta', () => {
    const device = new SimulatedStickDevice();
    const otraClave: StickPayloadCipher = createStickCipher(
      '999999',
      DEFAULT_SIMULATED_SALT,
      deterministicRandomBytes(7),
    );
    const cuerpo = encodeUtf8(
      JSON.stringify({
        config_id: 7,
        plot_id: 'plot-1',
        crop_primary: 'cafe',
        crop_secondary: null,
        depth_cm: 20,
        cartographic_unit: 'chinchina',
        last_fertilization_date: '2026-10-01',
        thresholds_version: '2026.11-v1',
        created_at_utc: '2026-11-12T15:00:00Z',
      }),
    );
    const trama = encodeFrame(Opcode.ConfigEscritura, otraClave.encrypt(cuerpo));

    device.handleWrite('configEscritura', trama);

    const estado = device.configStatus();
    expect(estado.aceptada).toBe(false);
    expect(estado.motivo).toBe('clave_incorrecta');
    expect(device.activeConfig()).toBeNull();
  });

  it('rechaza un sobre cifrado alterado aunque el CRC de la trama cuadre', () => {
    const device = new SimulatedStickDevice();
    const sobre = device.encryptPayload(
      encodeUtf8(
        JSON.stringify({
          config_id: 7,
          plot_id: 'plot-1',
          crop_primary: 'cafe',
          crop_secondary: null,
          depth_cm: 20,
          cartographic_unit: 'chinchina',
          last_fertilization_date: '2026-10-01',
          thresholds_version: '2026.11-v1',
          created_at_utc: '2026-11-12T15:00:00Z',
        }),
      ),
    );

    sobre[sobre.length - 1] = (sobre[sobre.length - 1] ?? 0) ^ 0xff;

    device.handleWrite('configEscritura', encodeFrame(Opcode.ConfigEscritura, sobre));

    expect(device.configStatus().aceptada).toBe(false);
    expect(device.configStatus().motivo).toBe('clave_incorrecta');
    expect(device.activeConfig()).toBeNull();
  });

  it('acepta por BLE la configuración cifrada y la aplica', () => {
    const device = new SimulatedStickDevice();
    const transport = makeFakeBleTransport(device);

    device.handleWrite('configEscritura', configCifrada(device, configuracion()));

    expect(device.configStatus().aceptada).toBe(true);
    expect(device.activeConfig()?.configId).toBe(7);
    expect(transport.state()).toBe('idle');
  });

  it('el bloque de sincronización cabe en la MTU y lleva CRC válido', () => {
    const device = new SimulatedStickDevice({ mtu: 120 });
    device.seedCsv(
      [
        RECORD_HEADERS.join(','),
        '1,stick-01,2026-11-12,12:00:00,4.5339,-75.6811,1550,0.4,9,0.9,1.2,20,0,,plot-1,,38,21.5,5.4,120,12,18,95,31,82,0.1.0',
        '2,stick-01,2026-11-12,12:01:00,4.5340,-75.6812,1551,0.5,9,0.9,1.1,20,0,,plot-1,,38,21.6,5.4,120,12,18,95,31,82,0.1.0',
        '3,stick-01,2026-11-12,12:02:00,4.5341,-75.6813,1552,0.6,9,0.9,1.0,20,0,,plot-1,,38,21.7,5.4,120,12,18,95,31,82,0.1.0',
      ].join('\n'),
    );

    const bloques = device.buildSyncBlocks(1);

    expect(bloques.length).toBeGreaterThan(0);

    for (const bloque of bloques) {
      const trama = encodeFrame(Opcode.SyncDatos, encodeUtf8(JSON.stringify(bloque)));
      expect(trama.length).toBeLessThanOrEqual(120);
      expect(() => decodeFrame(trama)).not.toThrow();
    }
  });

  it('los registros salen en orden y sin repetirse', () => {
    const device = new SimulatedStickDevice({ mtu: 512 });
    device.seedCsv(
      [
        RECORD_HEADERS.join(','),
        '1,stick-01,2026-11-12,12:00:00,4.5339,-75.6811,1550,0.4,9,0.9,1.2,20,0,,plot-1,,38,21.5,5.4,120,12,18,95,31,82,0.1.0',
        '2,stick-01,2026-11-12,12:01:00,4.5340,-75.6812,1551,0.5,9,0.9,1.1,20,0,,plot-1,,38,21.6,5.4,120,12,18,95,31,82,0.1.0',
        '3,stick-01,2026-11-12,12:02:00,4.5341,-75.6813,1552,0.6,9,0.9,1.0,20,0,,plot-1,,38,21.7,5.4,120,12,18,95,31,82,0.1.0',
      ].join('\n'),
    );

    const bloques = device.buildSyncBlocks(1);
    const ids = bloques.flatMap((bloque) =>
      bloque.texto
        .split('\n')
        .filter((linea) => linea.trim() !== '')
        .map((linea) => Number(linea.split(',')[0])),
    );

    expect(ids).toEqual([1, 2, 3]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('con CRC inválido inyectado la trama se rechaza al decodificarla', () => {
    const device = new SimulatedStickDevice({ mtu: 512 });
    device.seedCsv(
      [
        RECORD_HEADERS.join(','),
        '1,stick-01,2026-11-12,12:00:00,4.5339,-75.6811,1550,0.4,9,0.9,1.2,20,0,,plot-1,,38,21.5,5.4,120,12,18,95,31,82,0.1.0',
        '2,stick-01,2026-11-12,12:01:00,4.5340,-75.6812,1551,0.5,9,0.9,1.1,20,0,,plot-1,,38,21.6,5.4,120,12,18,95,31,82,0.1.0',
      ].join('\n'),
    );

    const tramas: Uint8Array[] = [];
    device.onEvent((event) => {
      if (event.type === 'notify' && event.characteristic === 'syncDatos') {
        tramas.push(event.bytes);
      }
    });

    device.injectInvalidCrcOnNextSyncBlock();
    device.handleWrite(
      'syncSolicitud',
      encodeFrame(Opcode.SyncSolicitud, encodeUtf8(JSON.stringify({ desde: 1 }))),
    );

    expect(tramas).toHaveLength(1);
    expect(() => decodeFrame(tramas[0] as Uint8Array)).toThrow(/CRC/);
  });

  it('una versión mayor de protocolo hace que el bastón rechace el enlace', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01', protocolVersion: 2 });
    const transport = makeFakeBleTransport(device);

    expect(() => device.assertProtocolCompatible()).toThrow(/versión/i);
    await expect(transport.connect('stick-01')).rejects.toThrow(/versión/i);
    expect(transport.state()).toBe('error');
  });

  it('con una versión mayor de protocolo el bastón no acepta escrituras', () => {
    const device = new SimulatedStickDevice({ protocolVersion: 2 });
    const errores: Error[] = [];

    device.onEvent((event) => {
      if (event.type === 'error') {
        errores.push(event.error);
      }
    });

    device.handleWrite(
      'configEscritura',
      encodeFrame(Opcode.ConfigEscritura, new Uint8Array([1, 2, 3])),
    );

    expect(errores).toHaveLength(1);
    expect(errores[0]?.message).toMatch(/versión/i);
    expect(device.configStatus().aceptada).toBe(false);
  });

  it('avisa cuando la batería está baja', () => {
    const device = new SimulatedStickDevice({ batteryPct: 82 });

    expect(device.status().lowBattery).toBe(false);

    device.setBatteryPct(8);

    expect(device.status().batteryPct).toBe(8);
    expect(device.status().lowBattery).toBe(true);
  });

  it('el bastón no borra registros hasta recibir la confirmación', () => {
    const device = new SimulatedStickDevice();
    device.captureNow();
    device.captureNow();

    expect(device.pendingRecords()).toHaveLength(2);

    device.handleWrite(
      'syncConfirmacion',
      encodeFrame(Opcode.SyncConfirmacion, encodeUtf8(JSON.stringify({ ultimo_id: 1 }))),
    );

    expect(device.pendingRecords()).toHaveLength(1);
    expect(device.lastConfirmedSequence()).toBe(1);
  });

  it('corta la conexión a mitad de una transferencia', () => {
    const device = new SimulatedStickDevice({ mtu: 120 });
    device.seedCsv(
      [
        RECORD_HEADERS.join(','),
        '1,stick-01,2026-11-12,12:00:00,4.5339,-75.6811,1550,0.4,9,0.9,1.2,20,0,,plot-1,,38,21.5,5.4,120,12,18,95,31,82,0.1.0',
        '2,stick-01,2026-11-12,12:01:00,4.5340,-75.6812,1551,0.5,9,0.9,1.1,20,0,,plot-1,,38,21.6,5.4,120,12,18,95,31,82,0.1.0',
        '3,stick-01,2026-11-12,12:02:00,4.5341,-75.6813,1552,0.6,9,0.9,1.0,20,0,,plot-1,,38,21.7,5.4,120,12,18,95,31,82,0.1.0',
      ].join('\n'),
    );

    let desconexion = false;
    device.onEvent((event) => {
      if (event.type === 'disconnected') {
        desconexion = true;
      }
    });

    device.injectDisconnectOnNextSync();
    device.handleWrite(
      'syncSolicitud',
      encodeFrame(Opcode.SyncSolicitud, encodeUtf8(JSON.stringify({ desde: 1 }))),
    );

    expect(desconexion).toBe(true);
  });

  it('avisa cuando la microSD está llena', () => {
    const device = new SimulatedStickDevice();
    device.setMicroSdStatus('full');

    expect(device.status().microSd).toBe('full');
    expect(() => device.captureNow()).toThrow(/microSD/);
  });

  it('acepta el control «capturar ahora» y «fijar hora»', () => {
    const device = new SimulatedStickDevice();

    device.handleWrite(
      'controlEscritura',
      encodeFrame(
        Opcode.ControlEscritura,
        device.encryptPayload(encodeUtf8(JSON.stringify({ accion: 'capturar' }))),
      ),
    );
    expect(device.recordCount()).toBe(1);

    device.handleWrite(
      'controlEscritura',
      encodeFrame(
        Opcode.ControlEscritura,
        device.encryptPayload(
          encodeUtf8(JSON.stringify({ accion: 'fijar-hora', hora_utc: '2026-12-01T08:30:00Z' })),
        ),
      ),
    );
    expect(device.getTime()).toBe('2026-12-01T08:30:00Z');
  });

  it('guarda el resumen para la OLED', () => {
    const device = new SimulatedStickDevice();

    device.handleWrite(
      'resumenEscritura',
      encodeFrame(
        Opcode.ResumenEscritura,
        device.encryptPayload(
          encodeUtf8(JSON.stringify({ lineas: ['Café: humedad 38 %', 'pH 5.4'] })),
        ),
      ),
    );

    expect(device.oledSummary()).toEqual(['Café: humedad 38 %', 'pH 5.4']);
  });
});

describe('makeFakeBleTransport', () => {
  it('el escaneo devuelve el propio bastón', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01', name: 'Bastón de campo' });
    const transport = makeFakeBleTransport(device);

    const resultados = await transport.scan({ timeoutMs: 1000 });

    expect(resultados).toHaveLength(1);
    expect(resultados[0]?.deviceId).toBe('stick-01');
    expect(resultados[0]?.name).toBe('Bastón de campo');
  });

  it('conectar devuelve las características del perfil', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const transport = makeFakeBleTransport(device);

    await transport.connect('stick-01');
    const caracteristicas = await transport.discoverCharacteristics();

    expect(caracteristicas).toHaveLength(9);
    const captura = caracteristicas.find((item) => item.key === 'captura');
    expect(captura?.canNotify).toBe(true);
    expect(captura?.canWrite).toBe(false);
    const configEscritura = caracteristicas.find((item) => item.key === 'configEscritura');
    expect(configEscritura?.canWrite).toBe(true);
    expect(transport.state()).toBe('ready');
  });

  it('entrega las notificaciones a los suscriptores', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01' });
    const transport = makeFakeBleTransport(device);
    const recibidas: Uint8Array[] = [];

    await transport.connect('stick-01');
    await transport.subscribe('captura', (bytes) => recibidas.push(bytes));
    await transport.write(
      'controlEscritura',
      encodeFrame(
        Opcode.ControlEscritura,
        device.encryptPayload(encodeUtf8(JSON.stringify({ accion: 'capturar' }))),
      ),
      false,
    );

    expect(recibidas).toHaveLength(1);
    const trama = decodeFrame(recibidas[0] as Uint8Array);
    expect(trama.opcode).toBe(Opcode.Captura);
  });

  it('entrega el estado del bastón al suscribirse', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01', batteryPct: 55 });
    const transport = makeFakeBleTransport(device);
    const recibidas: Uint8Array[] = [];

    await transport.connect('stick-01');
    await transport.subscribe('estado', (bytes) => recibidas.push(bytes));

    expect(recibidas.length).toBeGreaterThanOrEqual(1);
    const cuerpo: unknown = JSON.parse(decodeUtf8(decodeFrame(recibidas[0] as Uint8Array).body));
    expect(cuerpo).toMatchObject({ batteryPct: 55, protocolVersion: 1 });
  });

  it('negocia la MTU y avisa cuando el bastón corta la conexión', async () => {
    const device = new SimulatedStickDevice({ deviceId: 'stick-01', mtu: 120 });
    const transport = makeFakeBleTransport(device);
    let desconectado = false;

    transport.onDisconnected(() => {
      desconectado = true;
    });

    await transport.connect('stick-01');
    const mtu = await transport.requestMtu('stick-01', 100);

    expect(mtu).toBe(100);
    expect(device.negotiatedMtu()).toBe(100);

    device.seedCsv(
      [
        RECORD_HEADERS.join(','),
        '1,stick-01,2026-11-12,12:00:00,4.5339,-75.6811,1550,0.4,9,0.9,1.2,20,0,,plot-1,,38,21.5,5.4,120,12,18,95,31,82,0.1.0',
        '2,stick-01,2026-11-12,12:01:00,4.5340,-75.6812,1551,0.5,9,0.9,1.1,20,0,,plot-1,,38,21.6,5.4,120,12,18,95,31,82,0.1.0',
      ].join('\n'),
    );

    device.injectDisconnectOnNextSync();
    await transport.write(
      'syncSolicitud',
      encodeFrame(Opcode.SyncSolicitud, encodeUtf8(JSON.stringify({ desde: 1 }))),
      false,
    );

    expect(desconectado).toBe(true);
    expect(transport.state()).toBe('disconnected');
  });
});
