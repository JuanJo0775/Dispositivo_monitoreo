/**
 * Estado de la sincronización de un bastón.
 *
 * `lastConfirmedSequence` es el último `id_registro` que quedó guardado y
 * confirmado; la sincronización reanuda desde ahí (RF-APP-039, RF-APP-041).
 */
export interface SyncState {
  readonly deviceId: string;
  readonly lastConfirmedSequence: number;
  readonly status: 'idle' | 'syncing' | 'error';
  readonly updatedAt: string;
}

/** Almacén del estado de sincronización, uno por bastón. */
export interface SyncStateStore {
  get(deviceId: string): Promise<SyncState | null>;
  save(state: SyncState): Promise<void>;
  list(): Promise<SyncState[]>;
}
