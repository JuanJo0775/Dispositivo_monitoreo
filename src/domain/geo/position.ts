import type { CapturePayload } from '../capture/types';
import type { LatLon } from './types';

/**
 * Calidad de la posición del bastón.
 *
 * La posición es la del GPS del bastón, no la del teléfono que sincroniza. La
 * bandera `positionValid` manda: en `false` no hay posición aunque lleguen
 * coordenadas, porque la bandera existe justamente para decir que no se
 * confíe en ellas, y eso no se puede reconstruir desde las coordenadas.
 *
 * El HDOP es una convención de GPS: se muestra tal cual, nunca se convierte a
 * metros. Si falta, no se afirma una precisión que no se conoce.
 *
 * Módulo de TypeScript puro: sin React Native, Expo ni SQLite.
 */

/** Calidad de la posición medida. */
export type PositionQuality = 'buena' | 'aceptable' | 'imprecisa' | 'ninguna';

/** Posición del punto medido, con los datos de GPS tal como los reportó el bastón. */
export interface MeasurementPosition {
  latLon: LatLon | null;
  quality: PositionQuality;
  /** HDOP reportado por el GPS, sin interpretar ni convertir. */
  hdop: number | null;
  satellites: number | null;
  fixAgeS: number | null;
}

/** HDOP hasta el cual la posición es buena. */
export const GOOD_HDOP_MAX = 2;

/** HDOP hasta el cual la posición es aceptable. */
export const ACCEPTABLE_HDOP_MAX = 5;

/** Coordenadas del payload, o `null` si no hay posición utilizable. */
function coordinatesOf(payload: CapturePayload, positionValid: boolean): LatLon | null {
  if (!positionValid) {
    return null;
  }

  const { latitude, longitude } = payload;

  if (latitude === null || longitude === null) {
    return null;
  }

  // 0,0 es el "null island": un GPS sin fix reporta ceros, no una posición real.
  if (latitude === 0 && longitude === 0) {
    return null;
  }

  return { latitude, longitude };
}

/** Calidad según el HDOP; sin HDOP no se afirma calidad buena. */
function qualityOf(hdop: number | null): PositionQuality {
  if (hdop === null) {
    return 'aceptable';
  }

  if (hdop <= GOOD_HDOP_MAX) {
    return 'buena';
  }

  if (hdop <= ACCEPTABLE_HDOP_MAX) {
    return 'aceptable';
  }

  return 'imprecisa';
}

/** Lee la posición del bastón desde el payload y su bandera de validez. */
export function readPosition(payload: CapturePayload, positionValid: boolean): MeasurementPosition {
  const latLon = coordinatesOf(payload, positionValid);

  return {
    latLon,
    quality: latLon === null ? 'ninguna' : qualityOf(payload.hdop),
    hdop: payload.hdop,
    satellites: payload.satellites,
    fixAgeS: payload.fixAgeS,
  };
}
