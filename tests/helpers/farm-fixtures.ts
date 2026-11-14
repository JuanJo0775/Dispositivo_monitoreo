import type { Plot } from '@/domain/farm/types';
import type { Session } from '@/ports/stores/session-store';

/** Lote de prueba con todos los campos del dominio. */
export function makePlot(overrides: Partial<Plot> = {}): Plot {
  return {
    id: 'plot-1',
    farmId: 'farm-1',
    name: 'Lote El Guamo',
    cropPrimary: 'cafe',
    cropSecondary: null,
    depthCm: 20,
    cartographicUnit: 'chinchina',
    lastFertilizationDate: '2026-07-15',
    drainage: 'bien_drenado',
    shading: null,
    density: null,
    plantingDensityHa: 1800,
    altitudeM: 1550,
    slope: null,
    notes: null,
    deletedAt: null,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

/** Sesión de medición de prueba, ya enviada al bastón. */
export function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    plotId: 'plot-1',
    configId: 7,
    cropPrimary: 'cafe',
    cropSecondary: null,
    depthCm: 20,
    cartographicUnit: 'chinchina',
    lastFertilizationDate: '2026-07-15',
    thresholdsVersion: '2026.11-v1',
    firmwareVersion: '0.1.0',
    sentAt: '2026-11-12T16:50:00Z',
    acceptedAt: null,
    status: 'sent',
    ...overrides,
  };
}
