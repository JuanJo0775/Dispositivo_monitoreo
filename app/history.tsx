import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { listMeasurements } from '@/application/capture/list-measurements';
import type { Measurement } from '@/domain/measurement/types';
import { HistoryList } from '@/ui/components/history-list';
import { useApp } from '@/ui/providers/app-context';

export default function HistoryScreen() {
  const { stores } = useApp();
  const [measurements, setMeasurements] = useState<readonly Measurement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load(): Promise<void> {
        try {
          const rows = await listMeasurements(stores.measurements);
          if (!cancelled) {
            setMeasurements(rows);
            setError(null);
          }
        } catch (loadError) {
          if (!cancelled) {
            setError(
              loadError instanceof Error ? loadError.message : 'No se pudo leer el historial',
            );
          }
        }
      }

      void load();

      return () => {
        cancelled = true;
      };
    }, [stores]),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.count}>
        {measurements.length === 1
          ? '1 medición guardada'
          : `${measurements.length} mediciones guardadas`}
      </Text>
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <HistoryList measurements={measurements} onSelect={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  count: {
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 14,
    color: '#4A4A4A',
  },
  error: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 15,
    color: '#8A3B12',
  },
});
