import type { CapturePayload } from '@/domain/capture/types';
import type { Measurement } from '@/domain/measurement/types';

import { DEFAULT_PAYLOAD } from './captures';

/** Medición de prueba con valores realistas; sobrescribe solo lo que importa. */
export function makeMeasurement(
  payload: Partial<CapturePayload> = {},
  overrides: Partial<Measurement> = {},
): Measurement {
  return {
    id: 'm-1',
    captureId: 'stick-01:1',
    plotId: 'plot-1',
    payload: { ...DEFAULT_PAYLOAD, ...payload },
    capturedAtUtc: '2026-11-12T17:05:00Z',
    valid: true,
    invalidReasons: [],
    notes: null,
    photoPath: null,
    discardedAt: null,
    createdAt: '2026-11-12T17:05:01Z',
    ...overrides,
  };
}
