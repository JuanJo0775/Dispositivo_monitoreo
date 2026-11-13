import { createContext, useContext } from 'react';

import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import type { CaptureStore } from '@/ports/stores/capture-store';
import type { DiagnosisStore } from '@/ports/stores/diagnosis-store';
import type { FarmStore } from '@/ports/stores/farm-store';
import type { MeasurementStore } from '@/ports/stores/measurement-store';
import type { SessionStore } from '@/ports/stores/session-store';
import type { SettingsStore } from '@/ports/stores/settings-store';
import type { SyncStateStore } from '@/ports/stores/sync-state-store';
import type { StoreTransaction, UnitOfWork } from '@/ports/stores/unit-of-work';
import type { StickGateway } from '@/ports/stick-gateway';
import type { StickSync } from '@/ports/stick-sync';

/** Almacenes que la UI usa: fincas, lotes, sesiones, diagnósticos, ajustes y sincronización. */
export interface AppStores extends StoreTransaction {
  readonly farms: FarmStore;
  readonly sessions: SessionStore;
  readonly diagnoses: DiagnosisStore;
  readonly settings: SettingsStore;
  readonly captures: CaptureStore;
  readonly measurements: MeasurementStore;
  readonly syncState: SyncStateStore;
}

/** Servicios ya cableados que consume la UI. */
export interface AppServices {
  readonly stores: AppStores;
  readonly uow: UnitOfWork;
  readonly gateway: StickGateway;
  /** La misma vía hacia el bastón, vista como sincronización por microSD. */
  readonly sync: StickSync;
  /** Identificador del bastón; sin él no se puede conectar ni sincronizar. */
  readonly deviceId: string;
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
