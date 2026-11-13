import type { RandomBytes } from '@/ports/random-bytes';

/**
 * Bytes aleatorios del sistema para el cifrado y el emparejamiento.
 *
 * Usa `expo-crypto`, que toma los bytes del generador seguro de Android. El
 * módulo se carga con `require` diferido para que las pruebas —y cualquier
 * entorno sin nativo— no dependan de él.
 *
 * No se usa `Math.random`: no es un generador seguro y una sal predecible
 * dejaría la clave del bastón al alcance de cualquiera.
 */
export const expoRandomBytes: RandomBytes = {
  bytes(length: number): Uint8Array {
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error(`La cantidad de bytes debe ser un entero positivo y es ${length}.`);
    }

    const { getRandomBytes } = loadCrypto();

    return getRandomBytes(length);
  },
};

interface ExpoCryptoModule {
  getRandomBytes(byteCount: number): Uint8Array;
}

function loadCrypto(): ExpoCryptoModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-crypto') as ExpoCryptoModule;
  } catch {
    throw new Error(
      'La app necesita un build nativo para generar bytes aleatorios seguros: ' +
        'ejecuta `expo prebuild` y usa un dev client o un APK.',
    );
  }
}
