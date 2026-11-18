import { validateCapture } from '@/domain/capture/validation';
import type { RawCapture } from '@/domain/capture/types';
import type { Measurement } from '@/domain/measurement/types';
import type { UnitOfWork } from '@/ports/stores/unit-of-work';

export interface IngestCaptureInput {
  readonly capture: RawCapture;
  /** Lote asignado; `null` cuando la captura llegó sin configuración. */
  readonly plotId: string | null;
  /** Sesión con la que se capturó; `null` cuando el bastón no tenía sesión. */
  readonly sessionId?: string | null;
  /** Confirma al bastón que la captura quedó guardada. */
  readonly confirm?: (sequence: number) => Promise<void>;
}

export interface IngestCaptureDeps {
  readonly uow: UnitOfWork;
  readonly clock: () => string;
  readonly newId: () => string;
}

export type IngestCaptureResult =
  | { readonly status: 'saved'; readonly measurementId: string }
  | { readonly status: 'duplicate'; readonly measurementId: null };

/**
 * Guarda una captura y su medición derivada.
 *
 * Orden obligatorio: commit en la base → confirmación al bastón → UI. Si el
 * commit falla, no se confirma y el registro sigue en la microSD del bastón.
 * Un duplicado (`deviceId + sequence`) se ignora sin sobrescribir el primero.
 */
export async function ingestCapture(
  input: IngestCaptureInput,
  deps: IngestCaptureDeps,
): Promise<IngestCaptureResult> {
  const { capture, plotId, sessionId = null, confirm } = input;
  const measurementId = deps.newId();

  const result = await deps.uow.run(async (stores) => {
    const existing = await stores.captures.findByDeviceSequence(capture.deviceId, capture.sequence);

    if (existing !== null) {
      return { status: 'duplicate', measurementId: null } as const;
    }

    const validation = validateCapture(capture);

    await stores.captures.insertRaw(capture);

    const measurement: Measurement = {
      id: measurementId,
      captureId: `${capture.deviceId}:${capture.sequence}`,
      plotId,
      // La sesión la resuelve quien ingiere, con la regla de asignación; acá
      // solo se guarda su identificador para que el motor la use después.
      sessionId,
      payload: capture.payload,
      // La bandera no se deduce de las coordenadas: viaja con la captura.
      positionValid: capture.flags.positionValid,
      capturedAtUtc: capture.capturedAtUtc,
      valid: validation.valid,
      invalidReasons: validation.reasons,
      notes: null,
      photoPath: null,
      discardedAt: null,
      createdAt: deps.clock(),
    };

    await stores.measurements.insert(measurement);

    return { status: 'saved', measurementId } as const;
  });

  if (result.status === 'saved' && confirm !== undefined) {
    await confirm(capture.sequence);
  }

  return result;
}
