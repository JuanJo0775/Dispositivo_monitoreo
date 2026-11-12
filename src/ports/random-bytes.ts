/**
 * Bytes aleatorios.
 *
 * Es un puerto porque el dominio no puede depender de un módulo nativo: la
 * app usa el del sistema y las pruebas usan uno determinista.
 */
export interface RandomBytes {
  /** Devuelve `length` bytes aleatorios. */
  bytes(length: number): Uint8Array;
}
