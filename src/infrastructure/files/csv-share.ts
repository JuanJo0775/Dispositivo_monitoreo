import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Escribe el CSV en la caché de la app y abre la hoja de compartir del sistema.
 *
 * No sube nada a la red: el archivo sale del teléfono solo si la persona elige
 * compartirlo.
 */
export async function shareCsv(contents: string, fileName: string): Promise<void> {
  const file = new File(Paths.cache, fileName);

  if (file.exists) {
    file.delete();
  }

  file.create();
  file.write(contents);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('El teléfono no tiene una hoja de compartir disponible');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Exportar mediciones',
  });
}
