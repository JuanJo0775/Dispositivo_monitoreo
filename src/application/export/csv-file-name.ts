/**
 * Nombre estable del archivo exportado: `mediciones-AAAAMMDD-HHmm.csv`.
 *
 * Se calcula en UTC para que dos teléfonos en zonas distintas no generen
 * nombres distintos del mismo instante. Vive en la capa de aplicación porque
 * es una convención de exportación, no una capacidad del sistema de archivos.
 */
export function buildCsvFileName(now: Date = new Date()): string {
  const iso = now.toISOString();
  const date = iso.slice(0, 10).replace(/-/g, '');
  const time = iso.slice(11, 16).replace(':', '');

  return `mediciones-${date}-${time}.csv`;
}
