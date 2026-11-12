import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

import type { RandomBytes } from '@/ports/random-bytes';

/**
 * Cifrado de la carga útil de las características marcadas «cifrada» en el
 * contrato ESP32 ↔ App v0.1.
 *
 * Sobre: `[versión:1][nonce:24][texto cifrado][etiqueta:16]`, con
 * XChaCha20-Poly1305. La clave se deriva del PIN de emparejamiento con
 * PBKDF2-HMAC-SHA256 y una sal que se intercambia al emparejar.
 *
 * Es TypeScript puro: sin nativo, para que el dominio se pueda probar en
 * cualquier entorno.
 */

/** Versión del sobre cifrado. */
export const PAYLOAD_VERSION = 1;

/** Longitud del nonce de XChaCha20. */
export const NONCE_BYTES = 24;

/** Longitud de la etiqueta Poly1305. */
export const TAG_BYTES = 16;

/** Longitud de la clave. */
export const KEY_BYTES = 32;

/** Longitud de la sal para derivar la clave. */
export const SALT_BYTES = 16;

/** Iteraciones de PBKDF2. */
export const PBKDF2_ITERATIONS = 100000;

/** Longitud del PIN de emparejamiento. */
export const PIN_LENGTH = 6;

function assertKey(key: Uint8Array): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`La clave debe tener ${KEY_BYTES} bytes y tiene ${key.length}.`);
  }
}

/**
 * Deriva la clave de la carga útil a partir del PIN y la sal.
 *
 * El PIN tiene seis dígitos. La sal es aleatoria y se genera al emparejar.
 */
export function deriveKey(pin: string, salt: Uint8Array): Uint8Array {
  if (!/^\d+$/.test(pin) || pin.length !== PIN_LENGTH) {
    throw new Error(`El PIN debe tener ${PIN_LENGTH} dígitos.`);
  }

  if (salt.length === 0) {
    throw new Error('La sal no puede estar vacía.');
  }

  return pbkdf2(sha256, pin, salt, { c: PBKDF2_ITERATIONS, dkLen: KEY_BYTES });
}

/**
 * Cifra un cuerpo y devuelve el sobre.
 *
 * El nonce lo elige quien llama: así el llamador puede garantizar que no se
 * repite con la misma clave.
 */
export function encryptPayload(key: Uint8Array, body: Uint8Array, nonce: Uint8Array): Uint8Array {
  assertKey(key);

  if (nonce.length !== NONCE_BYTES) {
    throw new Error(`El nonce debe tener ${NONCE_BYTES} bytes y tiene ${nonce.length}.`);
  }

  const encrypted = xchacha20poly1305(key, nonce).encrypt(body);
  const envelope = new Uint8Array(1 + NONCE_BYTES + encrypted.length);

  envelope[0] = PAYLOAD_VERSION;
  envelope.set(nonce, 1);
  envelope.set(encrypted, 1 + NONCE_BYTES);

  return envelope;
}

/**
 * Abre un sobre y devuelve el cuerpo en claro.
 *
 * Lanza un error si el sobre está incompleto, si la versión no es la conocida
 * o si la etiqueta no cuadra (clave distinta o bytes alterados).
 */
export function decryptPayload(key: Uint8Array, envelope: Uint8Array): Uint8Array {
  assertKey(key);

  if (envelope.length < 1 + NONCE_BYTES + TAG_BYTES) {
    throw new Error('El sobre cifrado está incompleto.');
  }

  if (envelope[0] !== PAYLOAD_VERSION) {
    throw new Error(`Versión de sobre cifrado desconocida: ${envelope[0]}.`);
  }

  const nonce = envelope.subarray(1, 1 + NONCE_BYTES);
  const encrypted = envelope.subarray(1 + NONCE_BYTES);

  try {
    return xchacha20poly1305(key, nonce).decrypt(encrypted);
  } catch {
    throw new Error('El sobre cifrado no se pudo abrir: clave distinta o contenido alterado.');
  }
}

/** Cifrador con la clave ya derivada. */
export interface PayloadEncryptor {
  encrypt(body: Uint8Array): Uint8Array;
  decrypt(envelope: Uint8Array): Uint8Array;
}

/**
 * Cifrador que nunca repite nonce con la misma clave.
 *
 * El nonce se sortea en cada cifrado y se guarda: si saliera el mismo, se
 * vuelve a sortear. Repetir nonce con la misma clave rompe el cifrado, así que
 * aquí es un error, no un detalle.
 */
export function createEncryptor(key: Uint8Array, random: RandomBytes): PayloadEncryptor {
  assertKey(key);
  const usados = new Set<string>();

  return {
    encrypt(body) {
      let nonce = random.bytes(NONCE_BYTES);

      for (let intento = 0; intento < 8 && usados.has(claveDe(nonce)); intento += 1) {
        nonce = random.bytes(NONCE_BYTES);
      }

      if (usados.has(claveDe(nonce))) {
        throw new Error('No se pudo generar un nonce nuevo para esta clave.');
      }

      usados.add(claveDe(nonce));

      return encryptPayload(key, body, nonce);
    },
    decrypt(envelope) {
      return decryptPayload(key, envelope);
    },
  };
}

function claveDe(nonce: Uint8Array): string {
  return Array.from(nonce)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
