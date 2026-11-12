import {
  BLE_CHARACTERISTICS,
  BLE_CHARACTERISTIC_KEYS,
  BLE_SERVICE_UUID,
  PROTOCOL_VERSION,
} from '@/domain/protocol/ble-profile';
import { Opcode, crc16, decodeFrame, encodeFrame } from '@/domain/protocol/frame';

/** Convierte texto ASCII en bytes, sin `Buffer` (el runtime es Hermes). */
function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }
  return bytes;
}

/** Expresión regular de un UUID v4: versión 4 y variante 8, 9, a o b. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('crc16', () => {
  it('da 0x29B1 con el vector conocido de "123456789"', () => {
    expect(crc16(asciiBytes('123456789'))).toBe(0x29b1);
  });

  it('da 0xFFFF con la cadena vacía', () => {
    expect(crc16(new Uint8Array(0))).toBe(0xffff);
  });

  it('calcula sobre los bytes, no sobre el texto', () => {
    expect(crc16(new Uint8Array([0x31, 0x32, 0x33]))).toBe(crc16(asciiBytes('123')));
  });

  it('cambia si cambia un byte del cuerpo', () => {
    const base = crc16(new Uint8Array([0x01, 0x02, 0x03]));
    const alterado = crc16(new Uint8Array([0x01, 0x02, 0x04]));

    expect(base).not.toBe(alterado);
  });
});

describe('encodeFrame y decodeFrame', () => {
  it('arma la cabecera con opcode, versión, longitud y CRC', () => {
    const frame = encodeFrame(Opcode.Captura, asciiBytes('abc'));

    expect(frame[0]).toBe(Opcode.Captura);
    expect(frame[1]).toBe(PROTOCOL_VERSION);
    expect(frame[2]).toBe(3);
    expect(frame[3]).toBe(0);
    expect(frame[4]).toBe(crc16(asciiBytes('abc')) & 0xff);
    expect(frame[5]).toBe((crc16(asciiBytes('abc')) >>> 8) & 0xff);
    expect(frame.length).toBe(6 + 3);
  });

  it('hace ida y vuelta con el cuerpo vacío', () => {
    const frame = encodeFrame(Opcode.Estado, new Uint8Array(0));
    const decoded = decodeFrame(frame);

    expect(decoded.opcode).toBe(Opcode.Estado);
    expect(decoded.version).toBe(PROTOCOL_VERSION);
    expect(decoded.body).toEqual(new Uint8Array(0));
  });

  it('hace ida y vuelta con un cuerpo de datos', () => {
    const body = new Uint8Array([0x00, 0x01, 0xff, 0x7f, 0x80]);
    const decoded = decodeFrame(encodeFrame(Opcode.SyncDatos, body));

    expect(decoded.opcode).toBe(Opcode.SyncDatos);
    expect(decoded.version).toBe(PROTOCOL_VERSION);
    expect(Array.from(decoded.body)).toEqual([0x00, 0x01, 0xff, 0x7f, 0x80]);
  });

  it('hace ida y vuelta con un cuerpo de 300 bytes', () => {
    const body = new Uint8Array(300).map((_, index) => index % 256);
    const decoded = decodeFrame(encodeFrame(Opcode.SyncConfirmacion, body));

    expect(decoded.body.length).toBe(300);
    expect(Array.from(decoded.body)).toEqual(Array.from(body));
  });

  it('rechaza una trama con un byte del cuerpo alterado', () => {
    const frame = encodeFrame(Opcode.Captura, asciiBytes('hola'));
    frame[7] = (frame[7] ?? 0) ^ 0xff;

    expect(() => decodeFrame(frame)).toThrow(/CRC/i);
  });

  it('rechaza una trama con la versión equivocada', () => {
    const frame = encodeFrame(Opcode.Estado, asciiBytes('ok'));
    frame[1] = PROTOCOL_VERSION + 1;

    expect(() => decodeFrame(frame)).toThrow(/[Vv]ersi/i);
  });

  it('rechaza una trama incompleta', () => {
    const frame = encodeFrame(Opcode.Captura, asciiBytes('datos')).slice(0, 4);

    expect(() => decodeFrame(frame)).toThrow(/incompleta/i);
  });

  it('rechaza una trama a la que le faltan bytes del cuerpo', () => {
    const frame = encodeFrame(Opcode.Captura, asciiBytes('datos')).slice(0, 8);

    expect(() => decodeFrame(frame)).toThrow(/incompleta/i);
  });

  it('rechaza un opcode que no está en el contrato', () => {
    const frame = encodeFrame(Opcode.Estado, new Uint8Array(0));
    frame[0] = 0x7f;

    expect(() => decodeFrame(frame)).toThrow(/opcode/i);
  });
});

describe('perfil BLE', () => {
  it('expone el UUID del servicio y los nueve de las características', () => {
    expect(BLE_SERVICE_UUID).toBe('e962ff5a-2123-4b60-b472-27f62c97902e');
    expect(Object.keys(BLE_CHARACTERISTICS)).toHaveLength(9);
    expect(BLE_CHARACTERISTIC_KEYS).toEqual([
      'captura',
      'estado',
      'syncSolicitud',
      'syncDatos',
      'syncConfirmacion',
      'configEscritura',
      'configEstado',
      'resumenEscritura',
      'controlEscritura',
    ]);
  });

  it('mantiene la versión 1 del protocolo', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it('usa UUID v4 en el servicio y en todas las características', () => {
    const uuids = [BLE_SERVICE_UUID, ...Object.values(BLE_CHARACTERISTICS)];

    for (const uuid of uuids) {
      expect(uuid).toMatch(UUID_V4);
    }
  });

  it('no repite ningún UUID', () => {
    const uuids = [BLE_SERVICE_UUID, ...Object.values(BLE_CHARACTERISTICS)];

    expect(new Set(uuids).size).toBe(uuids.length);
  });

  it('congela los UUID del contrato v0.1', () => {
    expect(BLE_CHARACTERISTICS).toEqual({
      captura: 'e605f44c-0ec9-4bf1-9500-c4ed37e3fac2',
      estado: '5b8479b5-a08b-448c-b5a2-fcb0eaae1ee3',
      syncSolicitud: 'f1d9eaec-c057-4424-8430-8bbf8c0caa44',
      syncDatos: '5f0bb6a2-26e0-4f05-a551-e37a02db2be2',
      syncConfirmacion: '57f2fa6a-d641-4915-af5b-e4da1d334861',
      configEscritura: '642892a2-1d00-469f-a6ef-0dcd5a6d4f29',
      configEstado: '92294ea6-4878-4a50-bbdd-40ca5e0de562',
      resumenEscritura: '43d59275-f1d6-4060-a89f-a8b65d97c7db',
      controlEscritura: 'edd4b57c-3a7e-4f71-8b0b-c51c0ccd55c2',
    });
  });
});
