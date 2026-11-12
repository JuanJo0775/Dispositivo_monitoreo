export const APP_VERSION = '0.1.0';

/**
 * Calibración de fábrica del MVP: identidad sobre el valor crudo.
 *
 * Existe para que todo diagnóstico tenga una versión de calibración. La
 * calibración individual por sonda llega en el corte 4 (v1.0).
 */
export const FACTORY_CALIBRATION_VERSION = 'factory-v1';

/**
 * Versión de umbrales activa. En el corte 0 todavía no hay set cargado, así
 * que se declara explícitamente en vez de inventar un número.
 */
export const ACTIVE_THRESHOLDS_VERSION = 'sin-umbrales';
