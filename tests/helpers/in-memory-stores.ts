import type { RawCapture } from '@/domain/capture/types';
import type { Measurement } from '@/domain/measurement/types';
import type { CaptureStore } from '@/ports/stores/capture-store';
import type { MeasurementFilter, MeasurementStore } from '@/ports/stores/measurement-store';
import type { StoreTransaction, UnitOfWork } from '@/ports/stores/unit-of-work';

export interface InMemoryStoresOptions {
  /** Fuerza un fallo al insertar la medición, después de insertar la captura. */
  failMeasurementInsert?: boolean;
}

export interface InMemoryStores extends StoreTransaction {
  uow: UnitOfWork;
  /** Registra un callback que se ejecuta al confirmar la transacción. */
  onCommit(callback: () => void): void;
}

/**
 * Implementación en memoria de los puertos de almacenamiento para pruebas.
 *
 * Simula la transacción: si el callback falla, restaura el estado anterior.
 * No conoce SQLite ni React Native.
 */
export function makeInMemoryStores(options: InMemoryStoresOptions = {}): InMemoryStores {
  let captureRows: RawCapture[] = [];
  let measurementRows: Measurement[] = [];
  const commitCallbacks: Array<() => void> = [];

  const captures: CaptureStore = {
    async insertRaw(capture) {
      captureRows.push(capture);
    },
    async findByDeviceSequence(deviceId, sequence) {
      return (
        captureRows.find((row) => row.deviceId === deviceId && row.sequence === sequence) ?? null
      );
    },
  };

  const measurements: MeasurementStore = {
    async insert(measurement) {
      if (options.failMeasurementInsert) {
        throw new Error('fallo simulado al insertar la medición');
      }
      measurementRows.push(measurement);
    },
    async list(filter: MeasurementFilter = {}) {
      return measurementRows.filter((measurement) => {
        if (filter.plotId !== undefined && measurement.plotId !== filter.plotId) {
          return false;
        }
        return filter.includeDiscarded === true || measurement.discardedAt === null;
      });
    },
    async get(id) {
      return measurementRows.find((measurement) => measurement.id === id) ?? null;
    },
  };

  const uow: UnitOfWork = {
    async run(work) {
      const capturesBefore = [...captureRows];
      const measurementsBefore = [...measurementRows];

      try {
        const result = await work({ captures, measurements });
        commitCallbacks.forEach((callback) => callback());
        return result;
      } catch (error) {
        captureRows = capturesBefore;
        measurementRows = measurementsBefore;
        throw error;
      }
    },
  };

  return {
    uow,
    captures,
    measurements,
    onCommit(callback) {
      commitCallbacks.push(callback);
    },
  };
}
