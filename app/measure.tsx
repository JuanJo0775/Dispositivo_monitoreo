import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { diagnoseMeasurement } from '@/application/diagnosis/diagnose-measurement';
import { ingestCapture } from '@/application/capture/ingest-capture';
import type { RawCapture } from '@/domain/capture/types';
import type { DiagnosisResult } from '@/domain/diagnosis/types';
import type { Measurement } from '@/domain/measurement/types';
import type { Session } from '@/ports/stores/session-store';
import { useStickStatus } from '@/ui/hooks/use-stick-status';
import { PrimaryButton } from '@/ui/components/primary-button';
import { classesToText } from '@/ui/components/diagnosis-card';
import { useApp } from '@/ui/providers/app-context';
import { formatDateTimeLocal, formatMeasure } from '@/shared/format';

export default function MeasureScreen() {
  const { gateway, uow, stores, thresholds } = useApp();
  const status = useStickStatus(gateway);
  const [lastMeasurement, setLastMeasurement] = useState<Measurement | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Sesión con la que se capturó: la del bastón o la última del lote. */
  const findSession = useCallback(
    async (capture: RawCapture): Promise<Session | null> => {
      if (capture.configId > 0) {
        return stores.sessions.findByConfigId(capture.configId);
      }

      if (capture.plotId !== null) {
        const sessions = await stores.sessions.listByPlot(capture.plotId);

        return sessions[0] ?? null;
      }

      return null;
    },
    [stores],
  );

  /** Diagnóstico de la medición recién guardada; sin sesión no hay diagnóstico. */
  const diagnoseCapture = useCallback(
    async (
      capture: RawCapture,
      measurement: Measurement | null,
    ): Promise<DiagnosisResult | null> => {
      if (measurement === null) {
        return null;
      }

      const session = await findSession(capture);

      return diagnoseMeasurement(
        { measurement, session },
        {
          diagnoses: stores.diagnoses,
          measurements: stores.measurements,
          sessions: stores.sessions,
          farms: stores.farms,
          thresholds,
          clock: { now: () => new Date().toISOString() },
          newId: () => `${measurement.id}:diagnostico:${Date.now()}`,
        },
      );
    },
    [findSession, stores, thresholds],
  );

  useEffect(() => {
    const unsubscribeCapture = gateway.onCapture((capture) => {
      void (async () => {
        try {
          const result = await ingestCapture(
            {
              capture,
              plotId: capture.plotId,
              confirm: (sequence) => gateway.confirm(sequence),
            },
            {
              uow,
              clock: () => new Date().toISOString(),
              newId: () => `${capture.deviceId}:${capture.sequence}:medicion`,
            },
          );

          if (result.status === 'saved') {
            const measurement = await stores.measurements.get(result.measurementId);
            setLastMeasurement(measurement);

            try {
              setDiagnosis(await diagnoseCapture(capture, measurement));
            } catch (diagnosisError) {
              setDiagnosis(null);
              setError(
                diagnosisError instanceof Error
                  ? diagnosisError.message
                  : 'No se pudo calcular el diagnóstico',
              );
            }
          }
        } catch (ingestError) {
          setError(
            ingestError instanceof Error ? ingestError.message : 'No se pudo guardar la captura',
          );
        }
      })();
    });

    return () => {
      unsubscribeCapture();
    };
  }, [diagnoseCapture, gateway, stores, uow]);

  async function handleCapture(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await gateway.requestCapture();
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'No se pudo capturar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Bastón:</Text>
        <Text style={styles.statusValue}>{status.connected ? 'conectado' : 'desconectado'}</Text>
      </View>

      <PrimaryButton
        label="Capturar ahora"
        disabled={busy || !status.connected}
        onPress={handleCapture}
      />

      {!status.connected ? (
        <Text style={styles.note}>Conecta el bastón en la pantalla Conectar para poder medir.</Text>
      ) : null}

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Última captura guardada</Text>
        {lastMeasurement === null ? (
          <Text style={styles.empty}>Todavía no hay capturas en esta sesión.</Text>
        ) : (
          <>
            <Text style={styles.date}>{formatDateTimeLocal(lastMeasurement.capturedAtUtc)}</Text>
            <Text style={styles.value}>
              Humedad: {formatMeasure(lastMeasurement.payload.humidityPct, '% v/v')}
            </Text>
            <Text style={styles.value}>
              Temperatura: {formatMeasure(lastMeasurement.payload.temperatureC, '°C')}
            </Text>
            <Text style={styles.value}>pH: {formatMeasure(lastMeasurement.payload.ph, '')}</Text>
            <Text style={styles.value}>
              CE: {formatMeasure(lastMeasurement.payload.ecUsCm, 'µS/cm')}
            </Text>
            <Text style={styles.value}>
              {lastMeasurement.valid
                ? 'Dato válido para diagnóstico.'
                : `Revisar: ${lastMeasurement.invalidReasons.join(', ')}`}
            </Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Diagnóstico</Text>
        {lastMeasurement === null ? (
          <Text style={styles.empty}>Todavía no hay una medición que diagnosticar.</Text>
        ) : diagnosis === null ? (
          <Text style={styles.empty}>
            Esta medición todavía no tiene diagnóstico. Configurá una sesión de medición para que la
            app pueda interpretarla.
          </Text>
        ) : (
          <>
            <Text style={styles.diagnosisClass}>Clase: {classesToText(diagnosis.classes)}</Text>
            <Text style={styles.explanation}>{diagnosis.explanation}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: '#3F3F3F',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B4332',
  },
  note: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  error: {
    fontSize: 15,
    color: '#8A3B12',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5A5A5A',
  },
  empty: {
    fontSize: 15,
    color: '#4A4A4A',
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
  },
  value: {
    fontSize: 16,
    color: '#1F1F1F',
  },
  diagnosisClass: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B4332',
  },
  explanation: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F1F1F',
  },
});
