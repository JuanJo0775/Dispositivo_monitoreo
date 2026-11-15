import type { MapPackageFiles } from '@/ports/map-package-files';
import type { MapPackage, MapPackageStore } from '@/ports/stores/map-package-store';
import type { SettingsStore } from '@/ports/stores/settings-store';

/** Clave de `settings` donde vive el paquete detallado activo. */
export const ACTIVE_MAP_PACKAGE_KEY = 'active_map_package_id';

/** Tope de tamaño de un paquete importado: 200 MB. */
export const MAX_MAP_PACKAGE_BYTES = 200 * 1024 * 1024;

export interface ManageMapPackagesDeps {
  readonly packages: MapPackageStore;
  readonly settings: SettingsStore;
  readonly files: MapPackageFiles;
  readonly clock: () => string;
  readonly newId: () => string;
}

/** Lo que se elige para importar: el contenido ya elegido por el selector de archivos. */
export interface ImportMapPackageInput {
  /** Ruta del archivo elegido, tal como la entrega el selector. */
  readonly uri: string;
  /** Nombre original del archivo, el que se muestra en la lista. */
  readonly fileName: string;
}

/**
 * Importa un paquete de teselas al almacenamiento privado.
 *
 * Antes de copiar valida tres cosas: que sea un `.pmtiles`, que no supere el
 * tope de tamaño y que haya espacio libre. El archivo copiado lleva un nombre
 * propio (el identificador) para que dos importaciones con el mismo nombre no
 * se pisen; el nombre original queda en el registro para mostrarlo.
 *
 * Si es el único paquete vigente, queda activo: importar el primero no obliga a
 * un paso extra. La copia ocurre antes de registrar: si falla, no queda una fila
 * apuntando a un archivo que no existe.
 */
export async function importMapPackage(
  input: ImportMapPackageInput,
  deps: ManageMapPackagesDeps,
): Promise<MapPackage> {
  const fileName = input.fileName.trim();

  if (!fileName.toLowerCase().endsWith('.pmtiles')) {
    throw new Error('El archivo debe ser un paquete .pmtiles.');
  }

  const sizeBytes = await deps.files.sizeOf(input.uri);
  const limiteMb = Math.round(MAX_MAP_PACKAGE_BYTES / (1024 * 1024));

  if (sizeBytes > MAX_MAP_PACKAGE_BYTES) {
    throw new Error(`El paquete supera el límite de ${limiteMb} MB.`);
  }

  if ((await deps.files.availableSpaceBytes()) < sizeBytes) {
    throw new Error('No hay espacio suficiente en el teléfono para el paquete.');
  }

  const id = deps.newId();
  const copiado = await deps.files.copyIntoAppStorage(input.uri, `${id}.pmtiles`);
  const mapPackage: MapPackage = {
    id,
    fileName,
    path: copiado.path,
    sizeBytes: copiado.sizeBytes,
    importedAt: deps.clock(),
    deletedAt: null,
  };

  await deps.packages.insert(mapPackage);

  const vigentes = await deps.packages.list();

  if (vigentes.length === 1) {
    await setActiveMapPackage(id, deps);
  }

  return mapPackage;
}

/** Paquetes vigentes, del más reciente al más antiguo; los borrados no aparecen. */
export async function listMapPackages(deps: ManageMapPackagesDeps): Promise<MapPackage[]> {
  return deps.packages.list();
}

/** Identificador del paquete activo, o `null` si no hay o ya fue borrado. */
export async function getActiveMapPackage(
  deps: Pick<ManageMapPackagesDeps, 'packages' | 'settings'>,
): Promise<string | null> {
  const guardado = await deps.settings.get(ACTIVE_MAP_PACKAGE_KEY);

  if (guardado === null || guardado === '') {
    return null;
  }

  const paquete = await deps.packages.get(guardado);

  // Una clave que apunta a un paquete borrado no se considera activa.
  if (paquete === null || paquete.deletedAt !== null) {
    return null;
  }

  return paquete.id;
}

/**
 * Marca un paquete como borrado y elimina su archivo.
 *
 * El archivo se borra primero: si el disco falla, la fila queda viva y se puede
 * reintentar. Si el archivo ya no está, la fila se marca igual. Borrar el
 * paquete activo deja el mapa con el paquete base incluido.
 */
export async function deleteMapPackage(id: string, deps: ManageMapPackagesDeps): Promise<void> {
  const paquete = await deps.packages.get(id);

  if (paquete === null || paquete.deletedAt !== null) {
    return;
  }

  if (await deps.files.existsAt(paquete.path)) {
    await deps.files.deleteAt(paquete.path);
  }

  // Hay que saber si era el activo **antes** del borrado lógico: después, la
  // clave ya no resuelve a un paquete vigente y parecería que no lo era.
  const eraActivo =
    (await getActiveMapPackage({ packages: deps.packages, settings: deps.settings })) === id;

  await deps.packages.markDeleted(id, deps.clock());

  if (eraActivo) {
    await setActiveMapPackage(null, deps);
  }
}

/**
 * Activa un paquete vigente o desactiva el detallado con `null`.
 *
 * No se puede activar un paquete inexistente o borrado: el mapa terminaría
 * apuntando a un archivo que ya no está.
 */
export async function setActiveMapPackage(
  id: string | null,
  deps: ManageMapPackagesDeps,
): Promise<void> {
  if (id === null) {
    await deps.settings.set(ACTIVE_MAP_PACKAGE_KEY, '');
    return;
  }

  const paquete = await deps.packages.get(id);

  if (paquete === null || paquete.deletedAt !== null) {
    throw new Error('El paquete de mapa no existe o ya fue borrado.');
  }

  await deps.settings.set(ACTIVE_MAP_PACKAGE_KEY, id);
}
