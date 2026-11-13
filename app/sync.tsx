import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { importCsvFromStick } from '@/application/sync/import-csv';
import { syncFromStick, type SyncSummary } from '@/application/sync/sync-from-stick';
import type { SyncState } from '@/ports/stores/sync-state-store';
import { PrimaryButton } from '@/ui/components/primary-button';
import { SyncStatus } from '@/ui/components/sync-status';
import { useStickStatus } from '@/ui/hooks/use-stick-status';
import { useApp } from '@/ui/providers/app-context';

/**
 * Identificador único para cada medición importada.
 *
 * El número de secuencia del bastón no sirve solo: la misma captura puede
 * entrar en vivo y volver por la microSD, y las dos veces la medición lleva su
 * propio identificador.
 */
function makeMeasurementIds(deviceId: string): () => string {
  let contador = 0;

  return () => {
    contador += 1;

    return `${deviceId}:${contador}:${Date.now().toString(36)}:medicion`;
  };
}

export default function SyncScreen() {
  const router = useRouter();
  const { stores, uow, sync, gateway, deviceId } = useApp();
  const status = useStickStatus(gateway);

  const [savedState, setSavedState] = useState<SyncState | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setSavedState(await stores.syncState.get(deviceId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No se pudo leer el estado de sincronización',
      );
    }
  }, [deviceId, stores]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleSync(): Promise<void> {
    setError(null);
    setMessage(null);

    if (!status.connected) {
      setError('El bastón no está conectado. Conéctalo antes de sincronizar.');
      return;
    }

    setBusy(true);

    try {
      const resultado = await syncFromStick(
        { deviceId },
        {
          sync,
          syncState: stores.syncState,
          uow,
          clock: () => new Date().toISOString(),
          newId: makeMeasurementIds(deviceId),
        },
      );

      setSummary(resultado);
      await load();

      setMessage(
        resultado.imported === 0
          ? 'No había registros nuevos en la microSD del bastón.'
          : `Se guardaron ${resultado.imported} registros de la microSD.`,
      );
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'No se pudo sincronizar');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(): Promise<void> {
    setError(null);
    setMessage(null);
    setBusy(true);

    try {
      const elegido = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (elegido.canceled) {
        return;
      }

      const archivo = elegido.assets[0];

      if (archivo === undefined) {
        setError('No se pudo leer el archivo elegido.');
        return;
      }

      const contenido = await new File(archivo.uri).text();
      const resultado = await importCsvFromStick(contenido, {
        uow,
        clock: () => new Date().toISOString(),
        newId: makeMeasurementIds(deviceId),
      });

      setSummary(resultado);
      setMessage(
        `Archivo «${archivo.name}»: ${resultado.imported} registros guardados de ${
          resultado.received
        } leídos.`,
      );
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : 'No se pudo importar el archivo',
      );
    } finally {
      setBusy(false);
    }
  }

  const pendientes =
    status.pendingCount === null || status.pendingCount === undefined ? null : status.pendingCount;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Sincronizar</Text>
      <Text style={styles.subtitle}>
        Los registros que el bastón guardó en su microSD se copian al teléfono. La sincronización se
        reanuda donde quedó y nunca borra nada antes de confirmarlo.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Bastón</Text>
        <Text style={styles.detail}>Estado: {status.connected ? 'conectado' : 'desconectado'}</Text>
        <Text style={styles.detail}>
          Registros en la microSD:{' '}
          {status.recordCount === null || status.recordCount === undefined
            ? 'sin dato'
            : String(status.recordCount)}
        </Text>
        <Text style={styles.detail}>
          Pendientes de copiar: {pendientes === null ? 'sin dato' : String(pendientes)}
        </Text>
      </View>

      <SyncStatus
        summary={summary}
        lastConfirmedSequence={savedState?.lastConfirmedSequence ?? null}
        status={busy ? 'syncing' : (savedState?.status ?? null)}
      />

      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton
          label="Sincronizar ahora"
          disabled={busy}
          onPress={() => {
            void handleSync();
          }}
        />
        <PrimaryButton
          label="Importar CSV del bastón"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            void handleImport();
          }}
        />
        {!status.connected ? (
          <PrimaryButton
            label="Ir a conectar el bastón"
            variant="secondary"
            onPress={() => router.push('/connect')}
          />
        ) : null}
      </View>

      <Text style={styles.note}>
        Si el bastón no está a la mano, el archivo CSV de la microSD se puede importar a mano: entra
        por el mismo camino, con la misma deduplicación y el mismo aviso de conflicto.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B4332',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: '#3F3F3F',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#5A5A5A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detail: {
    fontSize: 15,
    color: '#2F2F2F',
  },
  actions: {
    gap: 12,
  },
  message: {
    fontSize: 15,
    color: '#1B4332',
  },
  error: {
    fontSize: 15,
    color: '#8A3B12',
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A4A4A',
  },
});
