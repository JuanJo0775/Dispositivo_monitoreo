import type { CaptureStore } from './capture-store';
import type { MeasurementStore } from './measurement-store';

/** Almacenes ligados a una transacción abierta. */
export interface StoreTransaction {
  readonly captures: CaptureStore;
  readonly measurements: MeasurementStore;
}

/**
 * Frontera transaccional.
 *
 * `run` confirma todo o nada. La confirmación al bastón ocurre después de que
 * `run` resuelva, nunca dentro: si el commit falla, el registro sigue en la
 * microSD del bastón y se reintenta.
 */
export interface UnitOfWork {
  run<T>(work: (stores: StoreTransaction) => Promise<T>): Promise<T>;
}
