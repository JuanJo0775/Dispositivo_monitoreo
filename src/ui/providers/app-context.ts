import { createContext, useContext } from 'react';

import type { StoreTransaction, UnitOfWork } from '@/ports/stores/unit-of-work';
import type { StickGateway } from '@/ports/stick-gateway';

/** Servicios ya cableados que consume la UI. */
export interface AppServices {
  readonly stores: StoreTransaction;
  readonly uow: UnitOfWork;
  readonly gateway: StickGateway;
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
