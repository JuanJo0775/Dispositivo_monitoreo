import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import type { DiagnosisResult } from '@/domain/diagnosis/types';
import { formatDateTimeLocal } from '@/shared/format';
import { DiagnosisCard } from '@/ui/components/diagnosis-card';
import { useApp } from '@/ui/providers/app-context';

/**
 * Diagnóstico de una medición.
 *
 * La pantalla no calcula: busca el diagnóstico guardado y lo presenta. Si la medición no tiene
 * diagnóstico, lo dice con palabras.
 */
export default function DiagnosisScreen() {
  const { stores } = useApp();
  const params = useLocalSearchParams<{ measurementId?: string | string[] }>();
  const measurementId = typeof params.measurementId === 'string' ? params.measurementId : null;

  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load(): Promise<void> {
        if (measurementId === null) {
          if (!cancelled) {
            setError('No se recibió el identificador de la medición.');
          }

          return;
        }

        try {
          const rows = await stores.diagnoses.listByMeasurement(measurementId);
          const last = rows[rows.length - 1] ?? null;
          const measurement = await stores.measurements.get(measurementId);

          if (!cancelled) {
            setResult(last === null ? null : last.result);
            setCapturedAt(
              measurement === null ? null : formatDateTimeLocal(measurement.capturedAtUtc),
            );
            setError(null);
          }
        } catch (loadError) {
          if (!cancelled) {
            setError(
              loadError instanceof Error ? loadError.message : 'No se pudo leer el diagnóstico',
            );
          }
        }
      }

      void load();

      return () => {
        cancelled = true;
      };
    }, [measurementId, stores]),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {capturedAt !== null ? <Text style={styles.date}>Medición del {capturedAt}</Text> : null}

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      {result === null ? (
        <View style={styles.card}>
          <Text style={styles.empty}>
            {error !== null
              ? 'No hay diagnóstico para mostrar.'
              : 'Esta medición todavía no tiene diagnóstico. Configurá una sesión y volvé a medir para obtenerlo.'}
          </Text>
        </View>
      ) : (
        <DiagnosisCard result={result} />
      )}
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
    gap: 12,
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 6,
  },
  empty: {
    fontSize: 16,
    color: '#4A4A4A',
  },
  error: {
    fontSize: 15,
    color: '#8A3B12',
  },
});
