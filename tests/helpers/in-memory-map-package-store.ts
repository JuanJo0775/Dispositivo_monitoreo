import type { MapPackage, MapPackageStore } from '@/ports/stores/map-package-store';

/**
 * Implementación en memoria del almacén de paquetes de mapa.
 *
 * `list` no trae los borrados lógicamente y ordena del más reciente al más
 * antiguo, como la consulta real. `packageRows` queda a la vista para afirmar
 * qué se guardó de verdad, incluidos los borrados.
 */
export function makeInMemoryMapPackageStore(seed: readonly MapPackage[] = []) {
  const packageRows: MapPackage[] = [...seed];

  const packages: MapPackageStore = {
    async insert(mapPackage) {
      packageRows.push(mapPackage);
    },
    async get(id) {
      return packageRows.find((row) => row.id === id) ?? null;
    },
    async list() {
      return packageRows
        .filter((row) => row.deletedAt === null)
        .sort((a, b) => (a.importedAt < b.importedAt ? 1 : a.importedAt > b.importedAt ? -1 : 0));
    },
    async listAll() {
      return [...packageRows];
    },
    async markDeleted(id, deletedAt) {
      const indice = packageRows.findIndex((row) => row.id === id);

      if (indice >= 0) {
        const fila = packageRows[indice];

        if (fila !== undefined) {
          packageRows[indice] = { ...fila, deletedAt };
        }
      }
    },
    async remove(id) {
      const indice = packageRows.findIndex((row) => row.id === id);

      if (indice >= 0) {
        packageRows.splice(indice, 1);
      }
    },
  };

  return { packages, packageRows };
}
