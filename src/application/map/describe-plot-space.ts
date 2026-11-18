import { cellForPoint, buildGrid, type Grid, type GridCell } from '@/domain/geo/grid';
import { readPosition, type MeasurementPosition } from '@/domain/geo/position';
import {
  summarizeVariables,
  verdictForCell,
  type CellVerdict,
  type CellDiagnosisInput,
  type VariableSummary,
} from '@/domain/geo/cell-verdict';
import type { DiagnosisAlert, DiagnosisResult } from '@/domain/diagnosis/types';
import type { Plot } from '@/domain/farm/types';
import type { Measurement } from '@/domain/measurement/types';
import type { DiagnosisStore } from '@/ports/stores/diagnosis-store';
import type { FarmStore } from '@/ports/stores/farm-store';
import type { MeasurementStore } from '@/ports/stores/measurement-store';

/** Un punto del lote, con su posición leída y su último dictamen. */
export interface PlotSpacePoint {
  readonly measurement: Measurement;
  readonly position: MeasurementPosition;
  readonly diagnosis: DiagnosisResult | null;
  /** Celda que lo contiene; `null` si no tiene posición o cayó fuera. */
  readonly cellId: string | null;
}

/** Una celda de la malla con su dictamen y el resumen de sus puntos. */
export interface PlotSpaceCell {
  readonly cell: GridCell;
  readonly verdict: CellVerdict;
  /** Mediana y rango por variable; solo cuando el dictamen es `resumen`. */
  readonly summary: readonly VariableSummary[];
  /** Mediciones que caen en la celda, incluida la inválida, en orden de puntos. */
  readonly measurementIds: readonly string[];
}

/** Alerta o aviso agrupado, con el primer punto que lo produce. */
export interface SpaceAlertGroup {
  readonly code: string;
  readonly severity: DiagnosisAlert['severity'];
  readonly message: string;
  readonly count: number;
  readonly firstMeasurementId: string | null;
}

/** Conteos del espacio medido, para la cabecera de la pantalla. */
export interface PlotSpaceCounts {
  readonly cells: number;
  /** Celdas con al menos una medición válida. */
  readonly cellsWithData: number;
  readonly cellsWithoutData: number;
  readonly cellsInconclusive: number;
  readonly points: number;
  readonly withPosition: number;
  readonly withoutPosition: number;
  /** Puntos con posición que no cayeron en ninguna celda. Debe ser 0. */
  readonly outsideArea: number;
  readonly invalid: number;
  /** Mediciones válidas sin diagnóstico guardado. */
  readonly withoutDiagnosis: number;
}

/**
 * Todo lo que la pantalla del lote necesita: la malla, las celdas, los puntos,
 * los conteos y las alertas.
 */
export interface PlotSpace {
  readonly plot: Plot;
  readonly grid: Grid | null;
  readonly cells: readonly PlotSpaceCell[];
  readonly points: readonly PlotSpacePoint[];
  readonly counts: PlotSpaceCounts;
  /** Alertas del motor, agrupadas por código y gravedad. */
  readonly alerts: readonly SpaceAlertGroup[];
  /** Avisos de registro que produce la app, no el motor. */
  readonly recordAlerts: readonly SpaceAlertGroup[];
}

export interface DescribePlotSpaceDeps {
  readonly farms: FarmStore;
  readonly measurements: MeasurementStore;
  readonly diagnoses: DiagnosisStore;
}

/** Orden de gravedad de las alertas: lo que bloquea va primero. */
const GRAVEDAD: readonly DiagnosisAlert['severity'][] = ['blocking', 'warning', 'info'];

/**
 * Modelo de la pantalla de un lote.
 *
 * La malla se arma con las mediciones **con posición** del lote, también las
 * inválidas: el área medida es la que se midió y no se achica por un dato malo.
 * Las inválidas no entran al dictamen de la celda, pero sí a su detalle.
 *
 * El modelo no calcula clases ni promedios: toma el último diagnóstico guardado
 * de cada medición y deja que el dominio dictamine. Un lote sin mediciones no
 * tiene malla (`grid: null`) y no rompe.
 */
export async function describePlotSpace(
  plotId: string,
  deps: DescribePlotSpaceDeps,
): Promise<PlotSpace> {
  const plot = await deps.farms.getPlot(plotId);

  if (plot === null) {
    throw new Error(`El lote ${plotId} no existe`);
  }

  const mediciones = await deps.measurements.list({ plotId });
  const conDictamen = await Promise.all(
    mediciones.map(async (measurement) => ({
      measurement,
      diagnosis: await ultimoDiagnostico(deps.diagnoses, measurement.id),
    })),
  );

  conDictamen.sort(compararPuntos);

  const puntosSinCelda = conDictamen.map(({ measurement, diagnosis }) => ({
    measurement,
    diagnosis,
    position: readPosition(measurement.payload, measurement.positionValid),
  }));

  const grid = buildGrid(
    puntosSinCelda.flatMap((punto) =>
      punto.position.latLon === null ? [] : [punto.position.latLon],
    ),
  );

  const puntos: PlotSpacePoint[] = puntosSinCelda.map((punto) => ({
    ...punto,
    cellId:
      grid === null || punto.position.latLon === null
        ? null
        : (cellForPoint(grid, punto.position.latLon)?.id ?? null),
  }));

  const celdas = grid === null ? [] : grid.cells.map((cell) => construirCelda(cell, puntos));

  const counts = contar(puntos, celdas, grid);

  return {
    plot,
    grid,
    cells: celdas,
    points: puntos,
    counts,
    alerts: agruparAlertasDelMotor(puntos),
    recordAlerts: agruparAvisosDeRegistro(puntos),
  };
}

/** Último diagnóstico guardado: el motor escribe uno nuevo en cada recálculo. */
async function ultimoDiagnostico(
  diagnoses: DiagnosisStore,
  measurementId: string,
): Promise<DiagnosisResult | null> {
  const filas = await diagnoses.listByMeasurement(measurementId);

  return filas[filas.length - 1]?.result ?? null;
}

/** Más reciente primero; a igual hora, por identificador para no depender del orden de guardado. */
function compararPuntos(a: { measurement: Measurement }, b: { measurement: Measurement }): number {
  if (a.measurement.capturedAtUtc !== b.measurement.capturedAtUtc) {
    return a.measurement.capturedAtUtc < b.measurement.capturedAtUtc ? 1 : -1;
  }

  return a.measurement.id < b.measurement.id ? -1 : a.measurement.id > b.measurement.id ? 1 : 0;
}

/** Dictamen de una celda con los puntos que caen en ella. */
function construirCelda(cell: GridCell, puntos: readonly PlotSpacePoint[]): PlotSpaceCell {
  const miembros = puntos.filter((punto) => punto.cellId === cell.id);
  const entradas: CellDiagnosisInput[] = miembros.map((punto) => ({
    measurementId: punto.measurement.id,
    valid: punto.measurement.valid,
    diagnosis: punto.diagnosis,
  }));
  const verdict = verdictForCell(entradas);

  // La mediana solo tiene sentido cuando los puntos coinciden en su conjunto de
  // clases; en un dictamen no concluyente promediar sería inventar consenso.
  const summary =
    verdict.state === 'resumen'
      ? summarizeVariables(
          miembros.flatMap((punto) =>
            punto.measurement.valid && punto.diagnosis !== null ? [punto.diagnosis] : [],
          ),
        )
      : [];

  return {
    cell,
    verdict,
    summary,
    measurementIds: miembros.map((punto) => punto.measurement.id),
  };
}

/** Conteos del espacio; las celdas vacías cuentan como sin dato. */
function contar(
  puntos: readonly PlotSpacePoint[],
  celdas: readonly PlotSpaceCell[],
  grid: Grid | null,
): PlotSpaceCounts {
  let withPosition = 0;
  let outsideArea = 0;
  let invalid = 0;
  let withoutDiagnosis = 0;

  for (const punto of puntos) {
    if (punto.position.latLon === null) {
      // Sin posición no hay celda ni punto en el mapa.
    } else {
      withPosition += 1;

      if (grid !== null && punto.cellId === null) {
        outsideArea += 1;
      }
    }

    if (!punto.measurement.valid) {
      invalid += 1;
    } else if (punto.diagnosis === null) {
      withoutDiagnosis += 1;
    }
  }

  return {
    cells: grid === null ? 0 : grid.cells.length,
    cellsWithData: celdas.filter((celda) => celda.verdict.state !== 'sin_dato').length,
    cellsWithoutData: celdas.filter((celda) => celda.verdict.state === 'sin_dato').length,
    cellsInconclusive: celdas.filter((celda) => celda.verdict.state === 'no_concluyente').length,
    points: puntos.length,
    withPosition,
    withoutPosition: puntos.length - withPosition,
    outsideArea,
    invalid,
    withoutDiagnosis,
  };
}

/** Agrupa las alertas del motor por `code` + `severity` en todos los puntos. */
function agruparAlertasDelMotor(puntos: readonly PlotSpacePoint[]): readonly SpaceAlertGroup[] {
  const grupos = new Map<string, SpaceAlertGroup>();

  for (const punto of puntos) {
    if (punto.diagnosis === null) {
      continue;
    }

    for (const alerta of punto.diagnosis.alerts) {
      const clave = `${alerta.code}|${alerta.severity}`;
      const grupo = grupos.get(clave);

      if (grupo === undefined) {
        grupos.set(clave, {
          code: alerta.code,
          severity: alerta.severity,
          message: alerta.message,
          count: 1,
          firstMeasurementId: punto.measurement.id,
        });
      } else {
        grupos.set(clave, { ...grupo, count: grupo.count + 1 });
      }
    }
  }

  return [...grupos.values()].sort(compararAlertas);
}

/** Gravedad primero; a igual gravedad, el grupo con más puntos y luego el código. */
function compararAlertas(a: SpaceAlertGroup, b: SpaceAlertGroup): number {
  const porGravedad = GRAVEDAD.indexOf(a.severity) - GRAVEDAD.indexOf(b.severity);

  if (porGravedad !== 0) {
    return porGravedad;
  }

  if (a.count !== b.count) {
    return b.count - a.count;
  }

  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

/**
 * Avisos que produce la app por cómo llegó el dato, no el motor.
 *
 * Van en bloque aparte para no confundirlos con un dictamen agronómico. El
 * orden es fijo y sigue el del diseño §10; solo aparecen los que tienen puntos.
 */
function agruparAvisosDeRegistro(puntos: readonly PlotSpacePoint[]): readonly SpaceAlertGroup[] {
  const sinPosicion = puntos.filter((punto) => punto.position.latLon === null);
  const imprecisas = puntos.filter((punto) => punto.position.quality === 'imprecisa');
  const fuera = puntos.filter((punto) => punto.position.latLon !== null && punto.cellId === null);
  const invalidas = puntos.filter((punto) => !punto.measurement.valid);
  const sinDiagnostico = puntos.filter(
    (punto) => punto.measurement.valid && punto.diagnosis === null,
  );

  const avisos: SpaceAlertGroup[] = [];

  if (sinPosicion.length > 0) {
    avisos.push({
      code: 'sin_posicion',
      severity: 'warning',
      message: 'Hay puntos sin posición del GPS: no se pueden ubicar en el mapa.',
      count: sinPosicion.length,
      firstMeasurementId: sinPosicion[0]?.measurement.id ?? null,
    });
  }

  if (imprecisas.length > 0) {
    avisos.push({
      code: 'posicion_imprecisa',
      severity: 'warning',
      message: 'La posición de algunos puntos es imprecisa (HDOP mayor a 5).',
      count: imprecisas.length,
      firstMeasurementId: imprecisas[0]?.measurement.id ?? null,
    });
  }

  if (fuera.length > 0) {
    avisos.push({
      code: 'fuera_del_area',
      severity: 'warning',
      message: 'Hay puntos con posición que no caen en el área medida.',
      count: fuera.length,
      firstMeasurementId: fuera[0]?.measurement.id ?? null,
    });
  }

  if (invalidas.length > 0) {
    avisos.push({
      code: 'mediciones_invalidas',
      severity: 'warning',
      message: 'Hay mediciones inválidas: no entran al dictamen de las celdas.',
      count: invalidas.length,
      firstMeasurementId: invalidas[0]?.measurement.id ?? null,
    });
  }

  if (sinDiagnostico.length > 0) {
    avisos.push({
      code: 'sin_diagnostico',
      severity: 'warning',
      message: 'Hay mediciones sin diagnóstico: sin él, la celda no concluye.',
      count: sinDiagnostico.length,
      firstMeasurementId: sinDiagnostico[0]?.measurement.id ?? null,
    });
  }

  return avisos;
}
