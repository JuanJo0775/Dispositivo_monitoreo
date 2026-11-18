import { boundingBox, boxArea, boxHeight, boxWidth, projectToLocal } from './projection';
import type { LatLon, LocalBox, LocalPoint } from './types';

/**
 * Malla automática de celdas sobre el área medida.
 *
 * La malla sale de los puntos medidos, no de una forma guardada: se proyecta
 * cada punto al plano local (equirectangular con `lat0` = latitud media), se
 * halla la caja envolvente, se agranda hasta el lado objetivo solo en los ejes
 * sin dispersión (un punto suelto, una línea de puntos) y se la divide en
 * celdas rectangulares alineadas al norte.
 *
 * Módulo de TypeScript puro: sin React Native, Expo ni SQLite.
 */

/** Área objetivo de cada celda, en hectáreas. */
export const DEFAULT_CELL_AREA_HA = 0.4;

/** Tope de celdas de una malla; por encima se ajusta el área objetivo. */
export const MAX_CELLS = 400;

/** Relación de aspecto mínima que puede tener una celda. */
export const MIN_ASPECT = 0.4;

/** Relación de aspecto máxima que puede tener una celda. */
export const MAX_ASPECT = 2.5;

/** Cuántos metros cuadrados tiene una hectárea. */
const METROS_CUADRADOS_POR_HECTAREA = 10_000;

/**
 * Tolerancia para comparar áreas y aspectos.
 *
 * Los pares espejo (2 × 3 y 3 × 2) tienen el mismo aspecto y la misma área
 * matemáticamente; sin esta tolerancia el ruido de coma flotante decide el
 * desempate antes de llegar a la regla `columns >= rows`.
 */
const TOLERANCIA = 1e-9;

/** Celda rectangular de la malla. */
export interface GridCell {
  id: string;
  row: number;
  column: number;
  bounds: LocalBox;
  areaHa: number;
}

/** Malla completa derivada de los puntos medidos. */
export interface Grid {
  origin: LatLon;
  box: LocalBox;
  rows: number;
  columns: number;
  cellAreaHa: number;
  targetAreaHa: number;
  adjusted: boolean;
  cells: readonly GridCell[];
}

/** Cantidad de filas y columnas elegida para la malla. */
interface EleccionMalla {
  rows: number;
  columns: number;
}

/** Par de factores de un número de celdas. */
interface ParFilasColumnas {
  rows: number;
  columns: number;
}

/** Par de factores con su área de celda y su relación de aspecto. */
interface ParCalificado extends ParFilasColumnas {
  areaCeldaM2: number;
  aspecto: number;
}

/**
 * Construye la malla que cubre el área medida por los puntos.
 *
 * Devuelve `null` si no hay puntos. El área objetivo es por celda y se puede
 * ajustar una sola vez si la malla supera `MAX_CELLS`.
 */
export function buildGrid(
  points: readonly LatLon[],
  targetAreaHa: number = DEFAULT_CELL_AREA_HA,
): Grid | null {
  if (points.length === 0) {
    return null;
  }

  // 1. Proyección local con la latitud media de los puntos como origen.
  const origin = centroDe(points);
  const locales = points.map((punto) => projectToLocal(origin, punto));

  // 2. Caja envolvente; solo los ejes sin dispersión crecen hasta el lado objetivo.
  const ladoObjetivo = Math.sqrt(targetAreaHa * METROS_CUADRADOS_POR_HECTAREA);
  const caja = cajaConEjesDegenerados(locales, ladoObjetivo);

  if (caja === null) {
    return null;
  }

  const areaM2 = boxArea(caja);
  const objetivoM2 = targetAreaHa * METROS_CUADRADOS_POR_HECTAREA;
  let objetivoHa = targetAreaHa;
  let ajustado = false;

  // El tope se aplica **antes** de factorizar: con un área desmedida (una
  // coordenada mala del GPS en una esquina lejana), buscar los divisores del
  // número de celdas objetivo costaría cientos de millones de vueltas y la
  // pantalla se congelaría. Subiendo el área objetivo de entrada, el número de
  // celdas queda en el tope y la búsqueda es barata.
  if (areaM2 / objetivoM2 > MAX_CELLS) {
    ajustado = true;
  }

  let eleccion = elegirMalla(caja, ajustado ? areaM2 / MAX_CELLS : objetivoM2);

  if (ajustado) {
    objetivoHa = areaM2 / MAX_CELLS / METROS_CUADRADOS_POR_HECTAREA;
  }

  // Red de seguridad: el redondeo de los candidatos podría dejar la malla un
  // poco por encima del tope aunque el área objetivo ya se haya ajustado.
  if (eleccion.rows * eleccion.columns > MAX_CELLS) {
    objetivoHa = areaM2 / METROS_CUADRADOS_POR_HECTAREA / MAX_CELLS;
    eleccion = elegirMalla(caja, objetivoHa * METROS_CUADRADOS_POR_HECTAREA);
    ajustado = true;
  }

  const anchoCelda = boxWidth(caja) / eleccion.columns;
  const altoCelda = boxHeight(caja) / eleccion.rows;
  const celdas: GridCell[] = [];

  // 6. Celdas completas, alineadas al norte, sin recorte. La fila 0 es la del norte.
  for (let fila = 0; fila < eleccion.rows; fila += 1) {
    const maxY = caja.maxY - fila * altoCelda;
    const minY = maxY - altoCelda;

    for (let columna = 0; columna < eleccion.columns; columna += 1) {
      const minX = caja.minX + columna * anchoCelda;
      const maxX = minX + anchoCelda;

      celdas.push({
        // 7. Identificador estable de la celda.
        id: `r${fila}c${columna}`,
        row: fila,
        column: columna,
        bounds: { minX, minY, maxX, maxY },
        areaHa: (anchoCelda * altoCelda) / METROS_CUADRADOS_POR_HECTAREA,
      });
    }
  }

  return {
    origin,
    box: caja,
    rows: eleccion.rows,
    columns: eleccion.columns,
    cellAreaHa: areaM2 / celdas.length / METROS_CUADRADOS_POR_HECTAREA,
    targetAreaHa: objetivoHa,
    adjusted: ajustado,
    cells: celdas,
  };
}

/**
 * Devuelve la celda que contiene la posición, o `null` si cae fuera de la caja.
 *
 * La fila 0 es la del norte y la columna 0 la del oeste; un punto sobre un
 * borde interno cae en la celda que empieza en ese borde.
 */
export function cellForPoint(grid: Grid, point: LatLon): GridCell | null {
  const local = projectToLocal(grid.origin, point);
  const { box } = grid;

  if (local.x < box.minX || local.x > box.maxX || local.y < box.minY || local.y > box.maxY) {
    return null;
  }

  const anchoCelda = boxWidth(box) / grid.columns;
  const altoCelda = boxHeight(box) / grid.rows;
  const columna = Math.min(
    grid.columns - 1,
    Math.max(0, Math.floor((local.x - box.minX) / anchoCelda)),
  );
  const fila = Math.min(grid.rows - 1, Math.max(0, Math.floor((box.maxY - local.y) / altoCelda)));

  return grid.cells[fila * grid.columns + columna] ?? null;
}

/** Centro geográfico de los puntos, usado como origen de la proyección. */
function centroDe(puntos: readonly LatLon[]): LatLon {
  let sumaLatitud = 0;
  let sumaLongitud = 0;

  for (const punto of puntos) {
    sumaLatitud += punto.latitude;
    sumaLongitud += punto.longitude;
  }

  return {
    latitude: sumaLatitud / puntos.length,
    longitude: sumaLongitud / puntos.length,
  };
}

/**
 * Caja envolvente con los ejes sin dispersión expandidos hasta `ladoObjetivo`,
 * centrados en los puntos. Un solo punto produce una caja de
 * `ladoObjetivo × ladoObjetivo`; una línea de puntos solo crece en el eje
 * degenerado. Un eje con dispersión medida nunca se agranda: la malla no
 * inventa área que los puntos no delimitan.
 */
function cajaConEjesDegenerados(
  puntos: readonly LocalPoint[],
  ladoObjetivo: number,
): LocalBox | null {
  const caja = boundingBox(puntos);

  if (caja === null) {
    return null;
  }

  let { minX, minY, maxX, maxY } = caja;

  if (maxX - minX === 0) {
    const centroX = (minX + maxX) / 2;
    minX = centroX - ladoObjetivo / 2;
    maxX = centroX + ladoObjetivo / 2;
  }

  if (maxY - minY === 0) {
    const centroY = (minY + maxY) / 2;
    minY = centroY - ladoObjetivo / 2;
    maxY = centroY + ladoObjetivo / 2;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Elige filas y columnas para la caja.
 *
 * Los candidatos de cantidad de celdas son `floor(A / objetivo)` y
 * `ceil(A / objetivo)`. Cada par de factores califica si la celda resultante
 * no es una franja. Gana el área de celda más cercana al objetivo; el parecido
 * con el cuadrado y luego `columns >= rows` desempatan.
 */
function elegirMalla(caja: LocalBox, objetivoM2: number): EleccionMalla {
  const ancho = boxWidth(caja);
  const alto = boxHeight(caja);
  const area = boxArea(caja);
  const cantidades = candidatosDeCeldas(area, objetivoM2);
  const calificados: ParCalificado[] = [];

  for (const cantidad of cantidades) {
    for (const par of paresDeFactores(cantidad)) {
      const aspecto = aspectoDeCelda(ancho / par.columns, alto / par.rows);

      if (aspecto >= MIN_ASPECT && aspecto <= MAX_ASPECT) {
        calificados.push({
          ...par,
          areaCeldaM2: area / cantidad,
          aspecto,
        });
      }
    }
  }

  if (calificados.length === 0) {
    return franjaMasParecida(cantidades, area, ancho, alto, objetivoM2);
  }

  calificados.sort((a, b) => {
    const porArea = Math.abs(a.areaCeldaM2 - objetivoM2) - Math.abs(b.areaCeldaM2 - objetivoM2);

    if (Math.abs(porArea) > TOLERANCIA * objetivoM2) {
      return porArea;
    }

    const porCuadrado = Math.abs(a.aspecto - 1) - Math.abs(b.aspecto - 1);

    if (Math.abs(porCuadrado) > TOLERANCIA) {
      return porCuadrado;
    }

    const columnasA = a.columns >= a.rows ? 0 : 1;
    const columnasB = b.columns >= b.rows ? 0 : 1;

    return columnasA - columnasB;
  });

  const ganador = calificados[0];

  if (ganador === undefined) {
    return franjaMasParecida(cantidades, area, ancho, alto, objetivoM2);
  }

  return { rows: ganador.rows, columns: ganador.columns };
}

/** Cantidades de celdas a probar: `floor` y `ceil`, sin repetir, mínimo 1. */
function candidatosDeCeldas(areaM2: number, objetivoM2: number): readonly number[] {
  const cantidades = new Set<number>();

  for (const cantidad of [Math.floor(areaM2 / objetivoM2), Math.ceil(areaM2 / objetivoM2)]) {
    cantidades.add(Math.max(1, cantidad));
  }

  return [...cantidades];
}

/**
 * Todos los pares `filas × columnas = n`.
 *
 * Recorre solo hasta la raíz cuadrada y agrega las dos orientaciones: con un
 * número grande, un recorrido completo sería trabajo sin techo.
 */
function paresDeFactores(n: number): readonly ParFilasColumnas[] {
  const pares: ParFilasColumnas[] = [];

  for (let rows = 1; rows * rows <= n; rows += 1) {
    if (n % rows === 0) {
      const columns = n / rows;

      pares.push({ rows, columns });

      if (columns !== rows) {
        pares.push({ rows: columns, columns: rows });
      }
    }
  }

  return pares;
}

/** Relación de aspecto de una celda: el lado mayor sobre el menor. */
function aspectoDeCelda(anchoM: number, altoM: number): number {
  return Math.max(anchoM, altoM) / Math.min(anchoM, altoM);
}

/**
 * Malla de una sola fila o de una sola columna para cuando ningún par
 * califica: se queda con la cantidad de celdas de área más cercana al objetivo
 * y con la orientación que deja la celda más parecida a un cuadrado.
 *
 * Es el respaldo para cajas muy alargadas: la celda queda fuera de la banda de
 * aspecto a propósito. Se prefiere una celda fea a agrandar la caja.
 */
function franjaMasParecida(
  cantidades: readonly number[],
  areaM2: number,
  ancho: number,
  alto: number,
  objetivoM2: number,
): EleccionMalla {
  let cantidad = cantidades[0] ?? 1;

  for (const candidata of cantidades) {
    if (Math.abs(areaM2 / candidata - objetivoM2) < Math.abs(areaM2 / cantidad - objetivoM2)) {
      cantidad = candidata;
    }
  }

  const aspectoUnaFila = aspectoDeCelda(ancho / cantidad, alto);
  const aspectoUnaColumna = aspectoDeCelda(ancho, alto / cantidad);

  // Ante el empate gana la fila: `columns >= rows`.
  if (Math.abs(aspectoUnaFila - 1) <= Math.abs(aspectoUnaColumna - 1)) {
    return { rows: 1, columns: cantidad };
  }

  return { rows: cantidad, columns: 1 };
}
