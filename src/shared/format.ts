/** Texto único para un dato ausente. Nunca se muestra 0 en su lugar. */
export const MISSING_VALUE_TEXT = 'sin dato';

const numberFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Formatea un número con separador decimal de Colombia. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Formatea una medición con su unidad, o «sin dato» si no hay valor. */
export function formatMeasure(value: number | null, unit: string): string {
  if (value === null) {
    return MISSING_VALUE_TEXT;
  }

  return `${formatNumber(value)} ${unit}`;
}

/**
 * Convierte un instante UTC al formato local de Colombia (UTC−5).
 *
 * El almacenamiento siempre es UTC; esta función es la única que cambia de
 * zona, y solo para mostrar.
 */
export function formatDateTimeLocal(isoUtc: string): string {
  return dateTimeFormatter.format(new Date(isoUtc));
}
