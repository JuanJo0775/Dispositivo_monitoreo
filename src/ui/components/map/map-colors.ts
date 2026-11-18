import type { AptitudeClass } from '@/domain/diagnosis/types';
import type { CellVerdict } from '@/domain/geo/cell-verdict';
import { CLASS_LABELS } from '@/ui/labels';

/**
 * Colores y rótulos del mapa.
 *
 * El color nunca va solo: cada estado tiene un texto que lo nombra, en la
 * leyenda y en el detalle. Una celda vacía no toma el color de ninguna clase.
 */

export { CLASS_LABELS };

/** Orden de aptitud, de la mejor a la peor. */
export const CLASS_ORDER: readonly AptitudeClass[] = ['S1', 'S2', 'S3', 'N'];

/** Color de cada clase de aptitud (diseño §6.4). */
export const CLASS_COLORS: Record<AptitudeClass, string> = {
  S1: '#2E7D32',
  S2: '#7CB342',
  S3: '#F9A825',
  N: '#C62828',
};

/** Celda sin ninguna medición válida: no se colorea por clase. */
export const NO_DATA_COLOR = '#EDEAE0';

/** Celda con mediciones que no permiten dar una clase. */
export const INCONCLUSIVE_COLOR = '#CFCBC0';

export const NO_DATA_LABEL = 'Sin dato';
export const INCONCLUSIVE_LABEL = 'No concluyente';

/** Borde de una celda o punto de una sola clase. */
export const CLASS_BORDER_COLOR = '#FFFFFF';

/** Opacidad del relleno de las celdas: el mapa se sigue leyendo debajo. */
export const CELL_FILL_OPACITY = 0.45;

/** Relleno de una celda según su dictamen. */
export function cellFillColor(verdict: CellVerdict): string {
  if (verdict.state === 'sin_dato') {
    return NO_DATA_COLOR;
  }

  if (verdict.state === 'no_concluyente') {
    return INCONCLUSIVE_COLOR;
  }

  return fillColorForClasses(verdict.classes);
}

/**
 * Borde de una celda según su dictamen.
 *
 * Con dos clases posibles el borde toma el color de la peor y el relleno el de
 * la mejor: el par se ve completo sin elegir una sola clase.
 */
export function cellBorderColor(verdict: CellVerdict): string {
  return borderColorForClasses(verdict.classes);
}

/** Texto corto del dictamen, para la hoja de la celda y la leyenda. */
export function cellLabel(verdict: CellVerdict): string {
  if (verdict.state === 'sin_dato') {
    return NO_DATA_LABEL;
  }

  if (verdict.state === 'no_concluyente') {
    return INCONCLUSIVE_LABEL;
  }

  return classRangeLabel(verdict.classes) ?? INCONCLUSIVE_LABEL;
}

/** Relleno de una clase o de un par de clases: siempre el de la mejor. */
export function fillColorForClasses(classes: readonly AptitudeClass[]): string {
  const mejor = classes[0];

  return mejor === undefined ? INCONCLUSIVE_COLOR : CLASS_COLORS[mejor];
}

/** Borde de una clase o de un par: blanco si es una sola, el de la peor si son dos. */
export function borderColorForClasses(classes: readonly AptitudeClass[]): string {
  if (classes.length < 2) {
    return CLASS_BORDER_COLOR;
  }

  const peor = classes[classes.length - 1];

  return peor === undefined ? CLASS_BORDER_COLOR : CLASS_COLORS[peor];
}

/**
 * Nombre de un conjunto de clases.
 *
 * Con dos clases el motor devuelve una incertidumbre que cruza un umbral y el
 * texto lo dice completo: “entre Apto y Moderadamente apto”. No se elige una.
 */
export function classRangeLabel(classes: readonly AptitudeClass[]): string | null {
  const primera = classes[0];

  if (primera === undefined) {
    return null;
  }

  const ultima = classes[classes.length - 1];

  if (ultima === undefined || ultima === primera) {
    return CLASS_LABELS[primera];
  }

  return `entre ${CLASS_LABELS[primera]} y ${CLASS_LABELS[ultima]}`;
}
