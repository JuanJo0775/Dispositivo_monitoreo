/**
 * Acceso al paquete base de mapa que viaja con la app.
 *
 * Es un puerto, no una dependencia directa: la app real lo resuelve con
 * `expo-asset` y `expo-file-system`, y las pruebas con un doble, sin tocar el
 * teléfono.
 */
export interface BaseMapSource {
  /**
   * Deja el paquete incluido como archivo real en el almacenamiento privado de
   * la app y devuelve su ruta.
   *
   * El paquete llega comprimido dentro del APK: copiarlo a documentos es lo
   * que permite abrirlo por posiciones. Si ya está copiado no se vuelve a
   * copiar.
   */
  ensureLocalFile(): Promise<string>;
}
