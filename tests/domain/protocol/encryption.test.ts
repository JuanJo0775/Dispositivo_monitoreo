import {
  createEncryptor,
  decryptPayload,
  deriveKey,
  encryptPayload,
  KEY_BYTES,
  NONCE_BYTES,
  PBKDF2_ITERATIONS,
  PAYLOAD_VERSION,
  SALT_BYTES,
  TAG_BYTES,
} from '@/domain/protocol/encryption';

const PIN = '000000';
const SAL = new Uint8Array(SALT_BYTES).fill(7);

function clave(): Uint8Array {
  return deriveKey(PIN, SAL);
}

function nonceFijo(): Uint8Array {
  return new Uint8Array(NONCE_BYTES).fill(3);
}

describe('deriveKey', () => {
  it('devuelve 32 bytes', () => {
    expect(clave()).toHaveLength(KEY_BYTES);
  });

  it('es determinista con el mismo PIN y la misma sal', () => {
    expect(clave()).toEqual(clave());
  });

  it('cambia con la sal', () => {
    const otra = deriveKey(PIN, new Uint8Array(SALT_BYTES).fill(8));

    expect(otra).not.toEqual(clave());
  });

  it('rechaza un PIN que no son seis dígitos', () => {
    expect(() => deriveKey('12345', SAL)).toThrow();
    expect(() => deriveKey('abcdef', SAL)).toThrow();
    expect(() => deriveKey('1234567', SAL)).toThrow();
  });
});

describe('encryptPayload y decryptPayload', () => {
  it('abre el sobre y devuelve el cuerpo', () => {
    const cuerpo = new Uint8Array([1, 2, 3, 4, 5]);

    const sobre = encryptPayload(clave(), cuerpo, nonceFijo());

    expect(decryptPayload(clave(), sobre)).toEqual(cuerpo);
  });

  it('el sobre no contiene el cuerpo en claro', () => {
    const cuerpo = new Uint8Array([10, 20, 30]);

    const sobre = encryptPayload(clave(), cuerpo, nonceFijo());

    expect(Array.from(sobre)).not.toContain(10);
  });

  it('el sobre tiene la longitud esperada', () => {
    const cuerpo = new Uint8Array(10);

    const sobre = encryptPayload(clave(), cuerpo, nonceFijo());

    expect(sobre).toHaveLength(1 + NONCE_BYTES + cuerpo.length + TAG_BYTES);
    expect(sobre[0]).toBe(PAYLOAD_VERSION);
  });

  it('rechaza un byte alterado', () => {
    const sobre = encryptPayload(clave(), new Uint8Array([1, 2, 3]), nonceFijo());
    sobre[sobre.length - 1] = (sobre[sobre.length - 1] ?? 0) ^ 0xff;

    expect(() => decryptPayload(clave(), sobre)).toThrow();
  });

  it('rechaza una clave distinta', () => {
    const sobre = encryptPayload(clave(), new Uint8Array([1, 2, 3]), nonceFijo());
    const otra = deriveKey('111111', SAL);

    expect(() => decryptPayload(otra, sobre)).toThrow();
  });

  it('rechaza un sobre incompleto o de versión desconocida', () => {
    expect(() => decryptPayload(clave(), new Uint8Array(4))).toThrow();

    const sobre = encryptPayload(clave(), new Uint8Array([1, 2, 3]), nonceFijo());
    sobre[0] = 9;

    expect(() => decryptPayload(clave(), sobre)).toThrow();
  });

  it('rechaza una clave de tamaño equivocado', () => {
    expect(() => encryptPayload(new Uint8Array(16), new Uint8Array([1]), nonceFijo())).toThrow();
  });
});

describe('createEncryptor', () => {
  it('nunca repite nonce con la misma clave', () => {
    let contador = 0;
    const cifrador = createEncryptor(clave(), {
      bytes: (length) => {
        contador += 1;

        return new Uint8Array(length).fill(contador);
      },
    });

    const primer = cifrador.encrypt(new Uint8Array([1]));
    const segundo = cifrador.encrypt(new Uint8Array([2]));

    expect(primer.subarray(1, 1 + NONCE_BYTES)).not.toEqual(segundo.subarray(1, 1 + NONCE_BYTES));
  });

  it('abre lo que él mismo cifró', () => {
    const cifrador = createEncryptor(clave(), {
      bytes: (length) => new Uint8Array(length).fill(9),
    });

    const cuerpo = new Uint8Array([4, 5, 6]);
    const sobre = cifrador.encrypt(cuerpo);

    expect(cifrador.decrypt(sobre)).toEqual(cuerpo);
  });
});

describe('constantes del contrato', () => {
  it('publica los valores que el firmware usa', () => {
    expect(PAYLOAD_VERSION).toBe(1);
    expect(NONCE_BYTES).toBe(24);
    expect(TAG_BYTES).toBe(16);
    expect(KEY_BYTES).toBe(32);
    expect(SALT_BYTES).toBe(16);
    expect(PBKDF2_ITERATIONS).toBe(100000);
  });
});
