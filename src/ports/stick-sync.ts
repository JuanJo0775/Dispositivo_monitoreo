/**
 * Puerto de salida para la sincronización por microSD.
 *
 * La app real lo implementa con BLE (el gateway habla el bloque de registros
 * del contrato); las pruebas, con un doble en memoria. Ninguna capa de
 * aplicación sabe cómo se habla con el bastón.
 */

/** Un bloque de registros que entrega el bastón. */
export interface SyncChunk {
  /** Líneas CSV del contrato, en orden. */
  readonly records: readonly string[];
  /** Último id_registro del bloque. */
  readonly lastSequence: number;
}

export interface StickSync {
  /**
   * Pide al bastón los registros desde `fromSequence` y los entrega por
   * bloques, ya validados.
   *
   * El bloque se entrega completo o no se entrega: si el CRC no cuadra, el
   * bastón no lo manda y la app reintenta desde el último id confirmado.
   */
  syncFrom(
    deviceId: string,
    fromSequence: number,
    onChunk: (chunk: SyncChunk) => Promise<void>,
  ): Promise<void>;
  /**
   * Confirma al bastón el último id recibido y guardado.
   *
   * Solo después de esta confirmación el bastón borra los registros de su
   * microSD (RF-APP-039).
   */
  confirmRecords(deviceId: string, lastSequence: number): Promise<void>;
}
