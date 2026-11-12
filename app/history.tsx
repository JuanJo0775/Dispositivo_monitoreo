import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { listMeasurements } from '@/application/capture/list-measurements';
import { buildCsvFileName } from '@/application/export/csv-file-name';
import { toCsv } from '@/application/export/export-csv';
import type { Measurement } from '@/domain/measurement/types';
import { shareCsv } from '@/infrastructure/files/csv-share';
import { ACTIVE_THRESHOLDS_VERSION, FACTORY_CALIBRATION_VERSION } from '@/shared/versions';
import { HistoryList } from '@/ui/components/history-list';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useApp } from '@/ui/providers/app-context';

export default function HistoryScreen() {
  const { stores } = useApp();
  const [measurements, setMeasurements] = useState<readonly Measurement[]>([]);
  const [message, setMessage] = useState<string | null>(null);
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

  async function handleExport(): Promise<void> {
    setError(null);
    setMessage(null);

    try {
      const csv = toCsv(measurements, ACTIVE_THRESHOLDS_VERSION, FACTORY_CALIBRATION_VERSION);
      await shareCsv(csv, buildCsvFileName());
      setMessage(
        measurements.length === 1
          ? 'Se exportó 1 medición.'
          : `Se exportaron ${measurements.length} mediciones.`,
      );
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo exportar');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.count}>
        {measurements.length === 1
          ? '1 medición guardada'
          : `${measurements.length} mediciones guardadas`}
      </Text>

      <View style={styles.actions}>
        <PrimaryButton
          label="Exportar CSV"
          variant="secondary"
          disabled={measurements.length === 0}
          onPress={handleExport}
        />
      </View>

      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
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
  actions: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  message: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 15,
    color: '#1B4332',
  },
  error: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 15,
    color: '#8A3B12',
  },
});
