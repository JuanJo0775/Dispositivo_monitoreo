import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { listMeasurements } from '@/application/capture/list-measurements';
import { buildCsvFileName } from '@/application/export/csv-file-name';
import { toCsv } from '@/application/export/export-csv';
import { listFarms, listPlots } from '@/application/farm/list-farms';
import type { Farm, Plot } from '@/domain/farm/types';
import type { Measurement } from '@/domain/measurement/types';
import { shareCsv } from '@/infrastructure/files/csv-share';
import { formatDateTimeLocal } from '@/shared/format';
import { ACTIVE_THRESHOLDS_VERSION, FACTORY_CALIBRATION_VERSION } from '@/shared/versions';
import { HistoryList } from '@/ui/components/history-list';
import { PlotPicker } from '@/ui/components/plot-picker';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useApp } from '@/ui/providers/app-context';

/** Motivo con el que la app marca una captura de ensayo. */
const TRIAL_REASON = 'simulated_data';

export default function HistoryScreen() {
  const { stores } = useApp();
  const router = useRouter();
  const [measurements, setMeasurements] = useState<readonly Measurement[]>([]);
  const [plots, setPlots] = useState<readonly Plot[]>([]);
  const [farmNames, setFarmNames] = useState<Readonly<Record<string, string>>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load(): Promise<void> {
        try {
          const [rows, farms] = await Promise.all([
            listMeasurements(stores.measurements),
            listFarms({ farms: stores.farms }),
          ]);
          const lotes = await listPlots(null, { farms: stores.farms });

          if (!cancelled) {
            setMeasurements(rows);
            setPlots(lotes);
            setFarmNames(nombresDeFincas(farms, lotes));
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

  async function handleAssignPlot(plot: Plot): Promise<void> {
    if (assigningId === null) {
      return;
    }

    try {
      // Solo cambia el lote: el contenido medido y su diagnóstico no se tocan.
      await stores.measurements.setPlotId(assigningId, plot.id);
      const rows = await listMeasurements(stores.measurements);

      setMeasurements(rows);
      setAssigningId(null);
      setError(null);
      setMessage(`Se asignó el lote ${plot.name} a la medición.`);
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'No se pudo asignar el lote');
    }
  }

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

  const trialMeasurementIds = measurements
    .filter((measurement) => measurement.invalidReasons.includes(TRIAL_REASON))
    .map((measurement) => measurement.id);

  const asignando = measurements.find((measurement) => measurement.id === assigningId) ?? null;

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
        <PrimaryButton
          label="Ajustes"
          variant="secondary"
          onPress={() => {
            router.push('/settings');
          }}
        />
      </View>

      {asignando === null ? null : (
        <View style={styles.assignPanel}>
          <Text style={styles.assignTitle}>
            Lote de la medición del {formatDateTimeLocal(asignando.capturedAtUtc)}
          </Text>
          <Text style={styles.assignDetail}>
            Cambiar el lote ordena la medición; los valores medidos y su diagnóstico quedan igual.
          </Text>

          <ScrollView style={styles.assignPicker} nestedScrollEnabled>
            <PlotPicker
              plots={plots}
              farmNames={farmNames}
              onSelect={handleAssignPlot}
              emptyMessage="Todavía no hay lotes. Crea una finca y su lote primero."
            />
          </ScrollView>

          <PrimaryButton
            label="Cancelar"
            variant="secondary"
            onPress={() => setAssigningId(null)}
          />
        </View>
      )}

      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <HistoryList
        measurements={measurements}
        onSelect={(measurement) => {
          router.push({ pathname: '/diagnosis', params: { measurementId: measurement.id } });
        }}
        trialMeasurementIds={trialMeasurementIds}
        plotNames={nombresDeLotes(plots)}
        onAssignPlot={(measurement) => {
          setMessage(null);
          setAssigningId(measurement.id);
        }}
      />
    </View>
  );
}

/** Nombre de cada lote, con su id como clave. */
function nombresDeLotes(plots: readonly Plot[]): Readonly<Record<string, string>> {
  const nombres: Record<string, string> = {};

  for (const plot of plots) {
    nombres[plot.id] = plot.name;
  }

  return nombres;
}

/** Nombre de la finca de cada lote, con el id del lote como clave. */
function nombresDeFincas(
  farms: readonly Farm[],
  plots: readonly Plot[],
): Readonly<Record<string, string>> {
  const porId = new Map(farms.map((farm) => [farm.id, farm.name]));
  const nombres: Record<string, string> = {};

  for (const plot of plots) {
    const nombre = porId.get(plot.farmId);

    if (nombre !== undefined) {
      nombres[plot.id] = nombre;
    }
  }

  return nombres;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  count: {
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 14,
    color: '#4E5D59',
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  message: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 15,
    color: '#0F4B42',
  },
  assignPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1D6C7',
    backgroundColor: '#FFFFFF',
  },
  assignTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F4B42',
  },
  assignDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4E5D59',
  },
  assignPicker: {
    maxHeight: 260,
  },
  error: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 15,
    color: '#8D321D',
  },
});
