import type { FarmStore } from '@/ports/stores/farm-store';
import type { SessionStore } from '@/ports/stores/session-store';

/** Lote y sesión con los que quedó registrada una captura. */
export interface CaptureAssignment {
  readonly plotId: string | null;
  readonly sessionId: string | null;
}

/** Lo que trae la captura para ubicarla, más el respaldo de la pantalla. */
export interface ResolveCaptureAssignmentInput {
  /** Código de lote que reportó el bastón (`payload.plotCode`). */
  readonly plotCode: string | null;
  /** `config_id` vigente en el bastón cuando se capturó; `0` si no tenía sesión. */
  readonly configId: number;
  /** Lote que la pantalla ya tenía seleccionado, solo si nada más resolvió. */
  readonly fallbackPlotId?: string | null;
}

export interface ResolveCaptureAssignmentDeps {
  readonly farms: FarmStore;
  readonly sessions: SessionStore;
}

/**
 * Decide a qué lote y a qué sesión pertenece una captura.
 *
 * Las reglas, en este orden (diseño §8.1):
 *
 * 1. `plotCode` coincide con el `id` de un lote existente → ese lote.
 * 2. `configId` coincide con una sesión guardada → el lote de la sesión, si el
 *    lote todavía existe.
 * 3. Ninguna regla dio lote → el respaldo que trae la pantalla.
 *
 * La sesión se conserva aunque su lote ya no exista: el motor de diagnóstico la
 * necesita para interpretar la medición, y sin ella el punto quedaría sin
 * dictamen. Nunca se inventa un lote: si nada coincide, queda `null` y la
 * persona puede asignarlo desde el historial.
 */
export async function resolveCaptureAssignment(
  input: ResolveCaptureAssignmentInput,
  deps: ResolveCaptureAssignmentDeps,
): Promise<CaptureAssignment> {
  const session = input.configId > 0 ? await deps.sessions.findByConfigId(input.configId) : null;
  const sessionId = session === null ? null : session.id;
  const codigo = normalizarCodigo(input.plotCode);

  if (codigo !== null) {
    const lote = await deps.farms.getPlot(codigo);

    if (lote !== null) {
      return { plotId: lote.id, sessionId };
    }
  }

  if (session !== null) {
    const lote = await deps.farms.getPlot(session.plotId);

    if (lote !== null) {
      return { plotId: lote.id, sessionId };
    }

    return { plotId: null, sessionId };
  }

  return { plotId: input.fallbackPlotId ?? null, sessionId: null };
}

/** Un código en blanco no es un código: se descarta antes de buscar. */
function normalizarCodigo(plotCode: string | null): string | null {
  if (plotCode === null) {
    return null;
  }

  const limpio = plotCode.trim();

  return limpio === '' ? null : limpio;
}
