/**
 * Archivos que Metro empaqueta como recursos.
 *
 * Metro reemplaza cada `require` de un recurso por un número que identifica el
 * archivo en el registro de recursos; `expo-asset` lo resuelve a una ruta real
 * del teléfono.
 */
declare module '*.pmtiles' {
  const assetId: number;

  export default assetId;
}
