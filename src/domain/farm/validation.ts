/**
 * Validación de fincas y lotes.
 *
 * Dominio puro: no conoce la base de datos ni la interfaz. Devuelve el motivo
 * en español para que la UI pueda mostrarlo tal cual.
 */

/** Resultado de una validación: `message` es `null` cuando todo está bien. */
export interface ValidationResult {
  readonly valid: boolean;
  readonly message: string | null;
}

/** Datos del lote que se validan. */
export interface PlotValidationInput {
  readonly name: string;
  readonly depthCm: number | null;
  readonly altitudeM: number | null;
  readonly lastFertilizationDate: string | null;
}

/** Longitud máxima del nombre de una finca o de un lote. */
export const MAX_NAME_LENGTH = 120;

/** Profundidad de muestreo admitida, en centímetros. */
export const MIN_DEPTH_CM = 1;
export const MAX_DEPTH_CM = 300;

/** Franja altitudinal admitida, en metros sobre el nivel del mar. */
export const MIN_ALTITUDE_M = -500;
export const MAX_ALTITUDE_M = 9000;

/** Fecha en formato ISO calendario: `AAAA-MM-DD`. */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const OK: ValidationResult = { valid: true, message: null };

function invalid(message: string): ValidationResult {
  return { valid: false, message };
}

/** Quita los espacios sobrantes de los dos extremos. */
function clean(value: string): string {
  return value.trim();
}

/** Dice si el texto es una fecha real en formato `AAAA-MM-DD`. */
function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Valida el nombre de una finca.
 *
 * Es obligatorio y no puede pasar de 120 caracteres. Los espacios sobrantes de
 * los extremos no cuentan y no se guardan.
 */
export function validateFarmName(name: string): ValidationResult {
  const value = clean(name);

  if (value.length === 0) {
    return invalid('El nombre de la finca es obligatorio.');
  }

  if (value.length > MAX_NAME_LENGTH) {
    return invalid(`El nombre de la finca no puede tener más de ${MAX_NAME_LENGTH} caracteres.`);
  }

  return OK;
}

/**
 * Valida el nombre de un lote.
 *
 * Es obligatorio y no puede pasar de 120 caracteres.
 */
export function validatePlotName(name: string): ValidationResult {
  const value = clean(name);

  if (value.length === 0) {
    return invalid('El nombre del lote es obligatorio.');
  }

  if (value.length > MAX_NAME_LENGTH) {
    return invalid(`El nombre del lote no puede tener más de ${MAX_NAME_LENGTH} caracteres.`);
  }

  return OK;
}

/**
 * Valida los datos de un lote.
 *
 * La profundidad va entre 1 y 300 cm, la altitud entre -500 y 9000 m y la
 * fecha de última fertilización, si se informa, en formato `AAAA-MM-DD`. Un
 * dato ausente se valida como `null`: no es un error, es «sin dato».
 */
export function validatePlot(input: PlotValidationInput): ValidationResult {
  const nameValidation = validatePlotName(input.name);

  if (!nameValidation.valid) {
    return nameValidation;
  }

  if (input.depthCm !== null) {
    if (!Number.isFinite(input.depthCm)) {
      return invalid('La profundidad del lote debe estar entre 1 y 300 cm.');
    }

    if (input.depthCm < MIN_DEPTH_CM || input.depthCm > MAX_DEPTH_CM) {
      return invalid(
        `La profundidad del lote debe estar entre ${MIN_DEPTH_CM} y ${MAX_DEPTH_CM} cm.`,
      );
    }
  }

  if (input.altitudeM !== null) {
    if (!Number.isFinite(input.altitudeM)) {
      return invalid('La altitud del lote debe estar entre -500 y 9000 m.');
    }

    if (input.altitudeM < MIN_ALTITUDE_M || input.altitudeM > MAX_ALTITUDE_M) {
      return invalid(
        `La altitud del lote debe estar entre ${MIN_ALTITUDE_M} y ${MAX_ALTITUDE_M} m.`,
      );
    }
  }

  if (input.lastFertilizationDate !== null && !isIsoDate(input.lastFertilizationDate)) {
    return invalid('La fecha de última fertilización debe tener el formato AAAA-MM-DD.');
  }

  return OK;
}
