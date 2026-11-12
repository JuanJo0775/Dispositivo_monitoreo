import { useSyncExternalStore } from 'react';

import type { StickGateway, StickStatus } from '@/ports/stick-gateway';

/**
 * Estado del bastón suscrito al gateway.
 *
 * Usa `useSyncExternalStore` en vez de un efecto con `setState`: el gateway es
 * una fuente externa y la suscripción debe limpiarse sin renders en cascada.
 */
export function useStickStatus(gateway: StickGateway): StickStatus {
  return useSyncExternalStore(
    (onStoreChange) => gateway.onStatus(onStoreChange),
    () => gateway.status(),
    () => gateway.status(),
  );
}
