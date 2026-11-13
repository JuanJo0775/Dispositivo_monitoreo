/**
 * Paquete de teselas PMTiles importado al almacenamiento de la app.
 *
 * El archivo vive en disco; acá solo se guarda su registro. Un paquete borrado
 * conserva la fila con `deletedAt` para no perder el rastro de lo importado.
 */
export interface MapPackage {
  readonly id: string;
  readonly fileName: string;
  readonly path: string;
  readonly sizeBytes: number;
  readonly importedAt: string;
  readonly deletedAt: string | null;
}

/** Almacén de paquetes de mapa. */
export interface MapPackageStore {
  insert(mapPackage: MapPackage): Promise<void>;
  get(id: string): Promise<MapPackage | null>;
  /** Paquetes vigentes, del más reciente al más antiguo. */
  list(): Promise<MapPackage[]>;
  /** Todos los paquetes, incluidos los borrados lógicamente. */
  listAll(): Promise<MapPackage[]>;
  /** Borrado lógico: la fila queda con la fecha y el archivo lo borra la aplicación. */
  markDeleted(id: string, deletedAt: string): Promise<void>;
  /** Borrado físico de la fila, después de borrar el archivo. */
  remove(id: string): Promise<void>;
}
