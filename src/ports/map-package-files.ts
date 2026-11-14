/** Archivo copiado al almacenamiento privado de la app. */
export interface CopiedMapFile {
  /** Ruta absoluta del archivo copiado, en formato `file://`. */
  readonly path: string;
  /** Tamaño del archivo ya copiado, en bytes. */
  readonly sizeBytes: number;
}

/**
 * Operaciones de disco que necesita la gestión de paquetes de mapa.
 *
 * Es un puerto, no una dependencia directa: la app real usa `expo-file-system`
 * y las pruebas usan un doble, sin tocar el dispositivo.
 */
export interface MapPackageFiles {
  /** Tamaño del archivo de origen, en bytes. */
  sizeOf(uri: string): Promise<number>;
  /** Espacio libre en el volumen donde se guarda el paquete, en bytes. */
  availableSpaceBytes(): Promise<number>;
  /** Copia el archivo elegido al almacenamiento privado con el nombre indicado. */
  copyIntoAppStorage(uri: string, fileName: string): Promise<CopiedMapFile>;
  /** Borra el archivo; falla si no existe. */
  deleteAt(path: string): Promise<void>;
  /** Dice si el archivo sigue en disco. */
  existsAt(path: string): Promise<boolean>;
}
