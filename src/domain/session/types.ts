/**
 * Bloque de configuración de una sesión de medición.
 *
 * Es lo que la app escribe al bastón y lo que el bastón devuelve en cada
 * captura como `configId`. La copia que se guarda en la sesión es inmutable:
 * un diagnóstico se recalcula siempre con el contexto original.
 */
export interface SessionConfig {
  /** Identificador de la configuración; entero creciente que asigna la app. */
  readonly configId: number;
  /** Lote al que pertenece la medición. */
  readonly plotId: string;
  /** Cultivo principal, con la clave del set de umbrales. */
  readonly cropPrimary: string;
  /** Cultivo secundario, si el lote tiene uno. */
  readonly cropSecondary: string | null;
  /** Profundidad de muestreo en centímetros. */
  readonly depthCm: number;
  /** Unidad cartográfica del lote, de la que salen los umbrales del suelo. */
  readonly cartographicUnit: string;
  /** Última fertilización declarada, en formato `AAAA-MM-DD`. */
  readonly lastFertilizationDate: string | null;
  /** Versión del set de umbrales con la que se interpretan las capturas. */
  readonly thresholdsVersion: string;
  /** Instante de creación del bloque, en UTC, ISO 8601. */
  readonly createdAtUtc: string;
}
