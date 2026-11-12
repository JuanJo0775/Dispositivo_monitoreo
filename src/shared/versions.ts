export const APP_VERSION = '0.1.0';

/**
 * Calibración de fábrica del MVP: identidad sobre el valor crudo.
 *
 * Existe para que todo diagnóstico tenga una versión de calibración. La
 * calibración individual por sonda llega en el corte 4 (v1.0).
 */
export const FACTORY_CALIBRATION_VERSION = 'factory-v1';

/**
 * Versión del set de umbrales que trae el APK.
 *
 * Cambia cuando se importa otra versión del set; nunca se edita en sitio.
 */
export const ACTIVE_THRESHOLDS_VERSION = '2026.11-v1';

/**
 * Versión del motor de diagnóstico.
 *
 * Sube cuando cambia una regla o una fórmula del motor. Todo diagnóstico
 * guarda esta versión junto con las de umbrales, calibración y firmware.
 */
export const ENGINE_VERSION = 'engine-v1';
