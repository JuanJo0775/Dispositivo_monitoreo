/**
 * Trama del protocolo BLE ESP32 ↔ App v0.1.
 *
 * ```
 * byte 0     opcode
 * byte 1     versión del protocolo (1)
 * bytes 2-3  longitud del cuerpo (uint16 LE)
 * bytes 4-5  CRC-16/CCITT-FALSE del cuerpo
 * bytes 6..  cuerpo
 * ```
 *
 * El CRC se calcula sobre los bytes del cuerpo tal como viajan (cifrados
 * incluidos), para detectar corrupción del transporte.
 *
 * TypeScript puro: no usa `Buffer` (el runtime es Hermes) ni ninguna
 * biblioteca de BLE.
 */

import { PROTOCOL_VERSION } from './ble-profile';

/** Códigos de mensaje del contrato. */
export enum Opcode {
  Captura = 0x01,
  Estado = 0x02,
  SyncSolicitud = 0x03,
  SyncDatos = 0x04,
  SyncConfirmacion = 0x05,
  ConfigEscritura = 0x06,
  ConfigEstado = 0x07,
  ResumenEscritura = 0x08,
  ControlEscritura = 0x09,
}

/** Bytes fijos de cabecera: opcode, versión, longitud (2) y CRC (2). */
export const FRAME_HEADER_BYTES = 6;

/** Longitud máxima del cuerpo, en bytes (uint16 de la cabecera). */
export const MAX_BODY_BYTES = 0xffff;

/** Trama decodificada: el opcode, la versión y el cuerpo tal cual viaja. */
export interface DecodedFrame {
  readonly opcode: Opcode;
  readonly version: number;
  readonly body: Uint8Array;
}

/** Códigos de opcode del contrato, para validar los que llegan por BLE. */
const KNOWN_OPCODES: readonly number[] = [
  Opcode.Captura,
  Opcode.Estado,
  Opcode.SyncSolicitud,
  Opcode.SyncDatos,
  Opcode.SyncConfirmacion,
  Opcode.ConfigEscritura,
  Opcode.ConfigEstado,
  Opcode.ResumenEscritura,
  Opcode.ControlEscritura,
];

/** Polinomio del CRC-16/CCITT-FALSE. */
const CRC16_POLYNOMIAL = 0x1021;

/** Valor inicial del CRC-16/CCITT-FALSE. */
const CRC16_INIT = 0xffff;

/**
 * CRC-16/CCITT-FALSE: polinomio 0x1021, valor inicial 0xFFFF, sin reflexión
 * ni xor final.
 *
 * Vector de verificación: la cadena ASCII `123456789` da 0x29B1.
 */
export function crc16(bytes: Uint8Array): number {
  let crc = CRC16_INIT;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= (bytes[index] ?? 0) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ CRC16_POLYNOMIAL) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc & 0xffff;
}

/**
 * Arma una trama completa: cabecera con opcode, versión, longitud y CRC, y
 * el cuerpo al final.
 */
export function encodeFrame(opcode: Opcode, body: Uint8Array): Uint8Array {
  if (body.length > MAX_BODY_BYTES) {
    throw new Error(
      `El cuerpo no cabe en una trama: ${body.length} bytes superan el máximo de ${MAX_BODY_BYTES}.`,
    );
  }

  const frame = new Uint8Array(FRAME_HEADER_BYTES + body.length);
  frame[0] = opcode;
  frame[1] = PROTOCOL_VERSION;
  frame[2] = body.length & 0xff;
  frame[3] = (body.length >>> 8) & 0xff;

  const crc = crc16(body);
  frame[4] = crc & 0xff;
  frame[5] = (crc >>> 8) & 0xff;

  frame.set(body, FRAME_HEADER_BYTES);

  return frame;
}

/**
 * Lee una trama completa y verifica que sea coherente.
 *
 * Lanza un error en español si la trama está incompleta, si la versión no es
 * la conocida, si el opcode no está en el contrato o si el CRC no cuadra.
 */
export function decodeFrame(bytes: Uint8Array): DecodedFrame {
  if (bytes.length < FRAME_HEADER_BYTES) {
    throw new Error(
      `Trama incompleta: se esperaban ${FRAME_HEADER_BYTES} bytes de cabecera y llegaron ${bytes.length}.`,
    );
  }

  const opcode = bytes[0] ?? 0;
  const version = bytes[1] ?? 0;

  if (version !== PROTOCOL_VERSION) {
    throw new Error(
      `Versión de protocolo desconocida: ${version}. Esta app habla la versión ${PROTOCOL_VERSION}.`,
    );
  }

  if (!isKnownOpcode(opcode)) {
    throw new Error(`Opcode desconocido: 0x${opcode.toString(16).padStart(2, '0')}.`);
  }

  const declaredLength = readUint16Le(bytes, 2);
  const expectedCrc = readUint16Le(bytes, 4);
  const actualLength = bytes.length - FRAME_HEADER_BYTES;

  if (actualLength < declaredLength) {
    throw new Error(
      `Trama incompleta: el cuerpo declara ${declaredLength} bytes y solo llegan ${actualLength}.`,
    );
  }

  if (actualLength > declaredLength) {
    throw new Error(
      `Trama mal formada: el cuerpo declara ${declaredLength} bytes y llegan ${actualLength}.`,
    );
  }

  const body = bytes.slice(FRAME_HEADER_BYTES);
  const actualCrc = crc16(body);

  if (actualCrc !== expectedCrc) {
    throw new Error(
      `CRC inválido: la trama declara 0x${expectedCrc
        .toString(16)
        .padStart(4, '0')} y el cuerpo da 0x${actualCrc.toString(16).padStart(4, '0')}.`,
    );
  }

  return { opcode, version, body };
}

/** Dice si un byte corresponde a un opcode del contrato. */
export function isKnownOpcode(value: number): value is Opcode {
  return KNOWN_OPCODES.includes(value);
}

/** Lee un entero de 16 bits sin signo en orden little-endian. */
function readUint16Le(bytes: Uint8Array, offset: number): number {
  const low = bytes[offset] ?? 0;
  const high = bytes[offset + 1] ?? 0;
  return low | (high << 8);
}
