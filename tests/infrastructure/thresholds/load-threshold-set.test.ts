import {
  bundledThresholdVersions,
  canonicalJson,
  contentChecksum,
  loadThresholdSet,
  UnknownThresholdVersionError,
} from '@/infrastructure/thresholds/load-threshold-set';

describe('loadThresholdSet', () => {
  it('trae la versión que viene en el APK', async () => {
    expect(bundledThresholdVersions()).toContain('2026.11-v1');
  });

  it('carga y valida el set base', async () => {
    const set = await loadThresholdSet('2026.11-v1');

    expect(set.version).toBe('2026.11-v1');
    expect(set.crops.cafe?.variables.ph).toBeDefined();
  });

  it('falla con una versión que no existe', async () => {
    await expect(loadThresholdSet('2099.01-v1')).rejects.toBeInstanceOf(
      UnknownThresholdVersionError,
    );
  });
});

describe('canonicalJson', () => {
  it('ordena las claves siempre igual', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('conserva el orden de las listas', () => {
    expect(canonicalJson({ a: [3, 1, 2] })).toBe('{"a":[3,1,2]}');
  });
});

describe('contentChecksum', () => {
  it('devuelve una huella estable del mismo contenido', () => {
    expect(contentChecksum({ a: 1, b: 2 })).toBe(contentChecksum({ b: 2, a: 1 }));
  });

  it('cambia cuando cambia el contenido', () => {
    expect(contentChecksum({ a: 1 })).not.toBe(contentChecksum({ a: 2 }));
  });

  it('devuelve ocho dígitos hexadecimales', () => {
    expect(contentChecksum({ a: 1 })).toMatch(/^[0-9a-f]{8}$/);
  });
});
