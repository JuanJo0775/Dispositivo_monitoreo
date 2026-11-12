import { createContext, useContext } from 'react';

import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { DiagnosisStore } from '@/ports/stores/diagnosis-store';
import type { FarmStore } from '@/ports/stores/farm-store';
import type { SessionStore } from '@/ports/stores/session-store';
import type { SettingsStore } from '@/ports/stores/settings-store';
import type { StoreTransaction, UnitOfWork } from '@/ports/stores/unit-of-work';
import type { StickGateway } from '@/ports/stick-gateway';

/** Almacenes que la UI usa: fincas, lotes, sesiones, diagnósticos y ajustes. */
export interface AppStores extends StoreTransaction {
  readonly farms: FarmStore;
  readonly sessions: SessionStore;
  readonly diagnoses: DiagnosisStore;
  readonly settings: SettingsStore;
}

/** Servicios ya cableados que consume la UI. */
export interface AppServices {
  readonly stores: AppStores;
  readonly uow: UnitOfWork;
  readonly gateway: StickGateway;
  /** Set de umbrales activo: el motor lo usa para interpretar cualquier lectura. */
  readonly thresholds: ThresholdSet;
}

export interface AppContextValue {
  readonly services: AppServices | null;
  readonly error: Error | null;
}

export const AppContext = createContext<AppContextValue>({ services: null, error: null });

/** Acceso a los servicios de la app. Falla si se usa antes de estar lista. */
export function useApp(): AppServices {
  const { services } = useContext(AppContext);

  if (services === null) {
    throw new Error('Los servicios de la app todavía no están disponibles');
  }

  return services;
}
