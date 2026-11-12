import rawBundledSet from '../../../assets/thresholds/2026.11-v1.json';

import { parseThresholdSet, type ThresholdSet } from '@/domain/diagnosis/threshold-set';

/**
 * Carga de sets de umbrales desde los assets del APK.
 *
 * El set viaja dentro del APK para que la app arranque sin red. Cada versión se valida con Zod
 * antes de usarse: un set inválido no se importa y la app sigue con el último set válido.
 */

const BUNDLED_SETS: Record<string, unknown> = {
  '2026.11-v1': rawBundledSet,
};

export class UnknownThresholdVersionError extends Error {
  constructor(version: string) {
    super(`No hay un set de umbrales con la versión ${version}`);
    this.name = 'UnknownThresholdVersionError';
  }
}

/** Versiones de set que trae el APK. */
export function bundledThresholdVersions(): string[] {
  return Object.keys(BUNDLED_SETS);
}

/**
 * Carga y valida un set de umbrales.
 *
 * @throws UnknownThresholdVersionError si la versión no viene en el APK.
 * @throws ZodError si el set no cumple el esquema.
 */
export async function loadThresholdSet(version: string): Promise<ThresholdSet> {
  const raw = BUNDLED_SETS[version];

  if (raw === undefined) {
    throw new UnknownThresholdVersionError(version);
  }

  return parseThresholdSet(raw);
}

/** JSON canónico: mismas claves siempre en el mismo orden, para poder comparar huellas. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);

  return `{${entries.join(',')}}`;
}

/**
 * Huella de contenido de 32 bits (FNV-1a) del set.
 *
 * Detecta corrupción o edición del asset; no es una firma criptográfica y no pretende serlo.
 */
export function contentChecksum(value: unknown): string {
  const text = canonicalJson(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
