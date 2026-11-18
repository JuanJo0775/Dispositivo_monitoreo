import type { CopiedMapFile, MapPackageFiles } from '@/ports/map-package-files';

export interface InMemoryMapPackageFilesSeed {
  /** Tamaño en bytes de cada archivo de origen, por URI. */
  readonly sizes?: Readonly<Record<string, number>>;
  /** Cabecera simulada de cada archivo de origen, por URI; por defecto, PMTiles. */
  readonly headers?: Readonly<Record<string, Uint8Array>>;
  /** Espacio libre simulado del volumen, en bytes. */
  readonly availableSpaceBytes?: number;
  /** Archivos que el doble considera ya presentes en disco. */
  readonly existingPaths?: readonly string[];
  /** Prefijo de la ruta privada donde se copian los archivos. */
  readonly directory?: string;
}

export interface InMemoryMapPackageFiles {
  /** Doble del puerto de disco. */
  readonly files: MapPackageFiles;
  /** Copias hechas al almacenamiento privado, en orden. */
  readonly copies: readonly CopiedMapFile[];
  /** Rutas borradas, en orden. */
  readonly deleted: readonly string[];
  /** Archivos que el doble considera presentes en disco. */
  readonly existing: ReadonlySet<string>;
}

/**
 * Implementación en memoria del disco de los paquetes de mapa.
 *
 * Un archivo de origen que no esté en `sizes` mide 0 bytes, como un archivo
 * vacío. Las copias quedan registradas con su ruta privada y el borrado se
 * puede afirmar sin tocar el dispositivo.
 */
export function makeInMemoryMapPackageFiles(
  seed: InMemoryMapPackageFilesSeed = {},
): InMemoryMapPackageFiles {
  const sizes = seed.sizes ?? {};
  const headers = seed.headers ?? {};
  const disponible = seed.availableSpaceBytes ?? 1024 * 1024 * 1024;
  const directorio =
    seed.directory ?? 'file:///data/user/0/com.semillero.monitoreosuelo/files/maps';
  const copies: CopiedMapFile[] = [];
  const deleted: string[] = [];
  const existing = new Set<string>(seed.existingPaths ?? []);
  const firmaPmtiles = new Uint8Array([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73]);

  const files: MapPackageFiles = {
    async sizeOf(uri) {
      return sizes[uri] ?? 0;
    },
    async readFirstBytes(uri, count) {
      return (headers[uri] ?? firmaPmtiles).slice(0, count);
    },
    async availableSpaceBytes() {
      return disponible;
    },
    async copyIntoAppStorage(uri, fileName) {
      const copiado: CopiedMapFile = {
        path: `${directorio}/${fileName}`,
        sizeBytes: sizes[uri] ?? 0,
      };

      copies.push(copiado);
      existing.add(copiado.path);

      return copiado;
    },
    async deleteAt(path) {
      deleted.push(path);
      existing.delete(path);
    },
    async existsAt(path) {
      return existing.has(path);
    },
  };

  return { files, copies, deleted, existing };
}
