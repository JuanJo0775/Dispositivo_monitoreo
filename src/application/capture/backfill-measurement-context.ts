import { resolveCaptureAssignment } from '@/application/capture/resolve-capture-assignment';
import type { CaptureStore } from '@/ports/stores/capture-store';
import type { FarmStore } from '@/ports/stores/farm-store';
import type { MeasurementFilter, MeasurementStore } from '@/ports/stores/measurement-store';
import type { SessionStore } from '@/ports/stores/session-store';

export interface BackfillMeasurementContextDeps {
  readonly captures: CaptureStore;
  readonly measurements: MeasurementStore;
  /** Fincas y lotes, para resolver el lote del `plotCode` o de la sesión. */
  readonly farms: FarmStore;
  /** Sesiones guardadas, para resolver la sesión por `configId`. */
  readonly sessions: SessionStore;
}

/** Qué hizo el relleno, para poder mostrarlo o registrarlo. */
export interface BackfillMeasurementContextResult {
  /** Capturas revisadas. */
  readonly checked: number;
  /** Capturas que ganaron lote en la captura o en su medición. */
  readonly plotAssigned: number;
  /** Capturas cuya medición ganó sesión. */
  readonly sessionAssigned: number;
}

/** Filtro que trae también las mediciones descartadas: el metadato no las daña. */
const TODAS_LAS_MEDICIONES: MeasurementFilter = { includeDiscarded: true };

/**
 * Rellena lote y sesión de lo que se guardó antes de que la ingesta los
 * resolviera, y recupera la bandera de posición de su captura.
 *
 * La regla es la misma del diseño §8.1: `plotCode`, luego la sesión del
 * `configId`. Solo llena lo que está vacío: si una persona ya asignó un lote
 * desde el historial, ese lote manda y no se pisa. Es idempotente; la app la
 * corre al arrancar y una segunda vuelta no cambia nada.
 *
 * No es una transacción única: cada fila se actualiza con un `UPDATE` propio.
 * Una interrupción a mitad de camino deja filas pendientes, no filas corruptas,
 * y la siguiente vuelta las termina.
 */
export async function backfillMeasurementContext(
  deps: BackfillMeasurementContextDeps,
): Promise<BackfillMeasurementContextResult> {
  const capturas = await deps.captures.listAll();
  const mediciones = await deps.measurements.list(TODAS_LAS_MEDICIONES);

  const porCaptura = new Map<string, typeof mediciones>();

  for (const medicion of mediciones) {
    const filas = porCaptura.get(medicion.captureId);

    if (filas === undefined) {
      porCaptura.set(medicion.captureId, [medicion]);
    } else {
      filas.push(medicion);
    }
  }

  let plotAssigned = 0;
  let sessionAssigned = 0;

  for (const captura of capturas) {
    const filas = porCaptura.get(`${captura.deviceId}:${captura.sequence}`) ?? [];
    const banderaCaptura = captura.flags.positionValid;
    const faltaLote = captura.plotId === null || filas.some((fila) => fila.plotId === null);
    const faltaSesion = filas.some((fila) => fila.sessionId === null);
    const banderaCambio = filas.some((fila) => fila.positionValid !== banderaCaptura);

    if (!faltaLote && !faltaSesion && !banderaCambio) {
      continue;
    }

    const asignacion =
      faltaLote || faltaSesion
        ? await resolveCaptureAssignment(
            { plotCode: captura.payload.plotCode, configId: captura.configId },
            { farms: deps.farms, sessions: deps.sessions },
          )
        : null;

    // El lote ya asignado a la captura manda: puede venir de una persona.
    const loteEfectivo = captura.plotId ?? asignacion?.plotId ?? null;
    let loteAsignadoAca = false;

    if (captura.plotId === null && loteEfectivo !== null) {
      await deps.captures.setPlotId(captura.deviceId, captura.sequence, loteEfectivo);
      loteAsignadoAca = true;
    }

    let sesionAsignadaAca = false;

    for (const fila of filas) {
      if (fila.plotId === null && loteEfectivo !== null) {
        await deps.measurements.setPlotId(fila.id, loteEfectivo);
        loteAsignadoAca = true;
      }

      if (fila.sessionId === null && asignacion?.sessionId != null) {
        await deps.measurements.setSessionId(fila.id, asignacion.sessionId);
        sesionAsignadaAca = true;
      }

      if (fila.positionValid !== banderaCaptura) {
        await deps.measurements.setPositionValid(fila.id, banderaCaptura);
      }
    }

    if (loteAsignadoAca) {
      plotAssigned += 1;
    }

    if (sesionAsignadaAca) {
      sessionAssigned += 1;
    }
  }

  return { checked: capturas.length, plotAssigned, sessionAssigned };
}
