import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';

import {
  deleteMapPackage,
  getActiveMapPackage,
  importMapPackage,
  listMapPackages,
  setActiveMapPackage,
} from '@/application/map/manage-map-packages';
import type { MapPackage } from '@/ports/stores/map-package-store';
import { formatBytes } from '@/shared/format';
import { BASE_ARCHIVE_NAME } from '@/shared/pmtiles-uri';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useApp } from '@/ui/providers/app-context';

/**
 * Paquetes de mapa offline.
 *
 * El paquete incluido siempre está; los detallados se importan como archivo
 * `.pmtiles` desde el teléfono y se copian al almacenamiento privado de la app.
 * Importar uno lo deja activo, porque es lo que la persona acaba de elegir.
 *
 * La pantalla no descarga nada: el archivo lo entrega el selector del sistema y
 * todo lo demás ocurre en el teléfono.
 */
export default function MapPackagesScreen() {
  const { stores, mapFiles } = useApp();

  const deps = useMemo(
    () => ({
      packages: stores.mapPackages,
      settings: stores.settings,
      files: mapFiles,
      clock: () => new Date().toISOString(),
      newId: () => `paquete-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    }),
    [mapFiles, stores.mapPackages, stores.settings],
  );

  const [packages, setPackages] = useState<readonly MapPackage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const [lista, activo] = await Promise.all([
        listMapPackages(deps),
        getActiveMapPackage({ packages: deps.packages, settings: deps.settings }),
      ]);

      setPackages(lista);
      setActiveId(activo);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'No se pudieron leer los paquetes de mapa',
      );
    } finally {
      setLoading(false);
    }
  }, [deps]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function handleImport(): Promise<void> {
    setError(null);
    setMessage(null);

    try {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (resultado.canceled) {
        return;
      }

      const asset = resultado.assets[0];

      if (asset === undefined) {
        setError('No se recibió el archivo elegido.');
        return;
      }

      const paquete = await importMapPackage({ uri: asset.uri, fileName: asset.name }, deps);

      // Importar es elegir: el paquete recién copiado queda activo aunque
      // hubiera otro. La persona puede volver al anterior o al incluido.
      await setActiveMapPackage(paquete.id, deps);
      await reload();
      setMessage(`Se importó ${paquete.fileName} y quedó activo.`);
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : 'No se pudo importar el paquete.',
      );
    }
  }

  function confirmarBorrado(paquete: MapPackage): void {
    Alert.alert(
      'Borrar paquete',
      `¿Borrar ${paquete.fileName}? Si estaba activo, el mapa vuelve al paquete incluido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => {
            void borrar(paquete.id);
          },
        },
      ],
    );
  }

  async function borrar(id: string): Promise<void> {
    setError(null);
    setMessage(null);

    try {
      await deleteMapPackage(id, deps);
      await reload();
      setMessage('Paquete borrado.');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'No se pudo borrar el paquete.',
      );
    }
  }

  async function activar(id: string | null): Promise<void> {
    setError(null);
    setMessage(null);

    try {
      await setActiveMapPackage(id, deps);
      await reload();
    } catch (activateError) {
      setError(
        activateError instanceof Error
          ? activateError.message
          : 'No se pudo cambiar el paquete activo.',
      );
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Los paquetes de mapa son archivos del teléfono: la app no descarga nada y todo funciona sin
        internet. El paquete incluido cubre el país con poco detalle; uno importado se dibuja encima
        para la zona que interesa.
      </Text>

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      {message !== null ? <Text style={styles.message}>{message}</Text> : null}

      <PrimaryButton label="Importar paquete .pmtiles" onPress={() => void handleImport()} />

      <View style={styles.card} testID="paquete-incluido">
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Paquete incluido</Text>
          {activeId === null ? <Text style={styles.tag}>En uso</Text> : null}
        </View>
        <Text style={styles.cardDetail}>{BASE_ARCHIVE_NAME} · cobertura general del país</Text>

        {activeId === null ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Usar solo el paquete incluido"
            onPress={() => void activar(null)}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionText}>Usar solo el incluido</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionTitle}>Paquetes importados</Text>

      {loading ? <Text style={styles.note}>Leyendo los paquetes…</Text> : null}

      {!loading && packages.length === 0 ? (
        <Text style={styles.note}>Todavía no hay paquetes importados.</Text>
      ) : (
        packages.map((paquete) => (
          <View key={paquete.id} style={styles.card} testID={`paquete-${paquete.id}`}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{paquete.fileName}</Text>
              {paquete.id === activeId ? <Text style={styles.tag}>Activo</Text> : null}
            </View>
            <Text style={styles.cardDetail}>{formatBytes(paquete.sizeBytes)}</Text>

            <View style={styles.actions}>
              {paquete.id === activeId ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Activar ${paquete.fileName}`}
                  onPress={() => void activar(paquete.id)}
                  style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                >
                  <Text style={styles.actionText}>Activar</Text>
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Borrar ${paquete.fileName}`}
                onPress={() => confirmarBorrado(paquete)}
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              >
                <Text style={styles.actionText}>Borrar</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4E5D59',
  },
  error: {
    fontSize: 15,
    color: '#8D321D',
  },
  message: {
    fontSize: 15,
    color: '#0F4B42',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F4B42',
    marginTop: 4,
  },
  card: {
    gap: 6,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1D6C7',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3733',
  },
  cardDetail: {
    fontSize: 13,
    color: '#4E5D59',
  },
  tag: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F4B42',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0F4B42',
    backgroundColor: '#FFFFFF',
  },
  actionPressed: {
    backgroundColor: '#E3EFEA',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F4B42',
  },
  note: {
    fontSize: 14,
    color: '#4E5D59',
  },
});
