import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Measurement } from '@/domain/measurement/types';
import { formatDateTimeLocal, formatMeasure } from '@/shared/format';

export interface HistoryListProps {
  measurements: readonly Measurement[];
  onSelect: (measurement: Measurement) => void;
  emptyMessage?: string;
  /** Identificadores de las mediciones marcadas como ensayo. */
  trialMeasurementIds?: readonly string[];
  /** Nombre del lote de cada medición, con el id del lote como clave. */
  plotNames?: Readonly<Record<string, string>>;
  /**
   * Si viene, las mediciones sin lote muestran el botón «Asignar lote».
   * La lista no asigna nada: avisa y la pantalla decide.
   */
  onAssignPlot?: (measurement: Measurement) => void;
}

function textoDelLote(
  measurement: Measurement,
  plotNames: Readonly<Record<string, string>>,
): string {
  if (measurement.plotId === null) {
    return 'Sin lote asignado';
  }

  return `Lote: ${plotNames[measurement.plotId] ?? 'no disponible'}`;
}

function MeasurementRow({
  measurement,
  onSelect,
  onAssign,
  trial,
  plotNames,
}: {
  measurement: Measurement;
  onSelect: (measurement: Measurement) => void;
  onAssign?: (measurement: Measurement) => void;
  trial: boolean;
  plotNames: Readonly<Record<string, string>>;
}) {
  const status = measurement.valid ? 'válida' : 'revisar';
  const fecha = formatDateTimeLocal(measurement.capturedAtUtc);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Medición del ${fecha}, ${status}`}
      onPress={() => onSelect(measurement)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.date}>{fecha}</Text>
        <View style={styles.badges}>
          {trial ? <Text style={styles.trial}>ensayo</Text> : null}
          <Text style={measurement.valid ? styles.statusValid : styles.statusWarning}>
            {status}
          </Text>
        </View>
      </View>

      <View style={styles.values}>
        <View style={styles.valueBlock}>
          <Text style={styles.label}>Humedad</Text>
          <Text style={styles.value}>
            {formatMeasure(measurement.payload.humidityPct, '% v/v')}
          </Text>
        </View>
        <View style={styles.valueBlock}>
          <Text style={styles.label}>pH</Text>
          <Text style={styles.value}>{formatMeasure(measurement.payload.ph, '')}</Text>
        </View>
        <View style={styles.valueBlock}>
          <Text style={styles.label}>CE</Text>
          <Text style={styles.value}>{formatMeasure(measurement.payload.ecUsCm, 'µS/cm')}</Text>
        </View>
      </View>

      <View style={styles.plotRow}>
        <Text style={styles.plot}>{textoDelLote(measurement, plotNames)}</Text>
        {measurement.plotId === null && onAssign !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Asignar lote a la medición del ${fecha}`}
            onPress={() => onAssign(measurement)}
            style={({ pressed }) => [styles.assign, pressed && styles.assignPressed]}
          >
            <Text style={styles.assignText}>Asignar lote</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Lista de mediciones del historial. No consulta datos: recibe y muestra. */
export function HistoryList({
  measurements,
  onSelect,
  emptyMessage = 'Todavía no hay mediciones guardadas.',
  trialMeasurementIds = [],
  plotNames = {},
  onAssignPlot,
}: HistoryListProps) {
  return (
    <FlatList
      data={measurements}
      keyExtractor={(measurement) => measurement.id}
      contentContainerStyle={measurements.length === 0 ? styles.emptyContainer : styles.list}
      renderItem={({ item }) => (
        <MeasurementRow
          measurement={item}
          onSelect={onSelect}
          onAssign={onAssignPlot}
          trial={trialMeasurementIds.includes(item.id)}
          plotNames={plotNames}
        />
      )}
      ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  empty: {
    fontSize: 16,
    color: '#4E5D59',
    textAlign: 'center',
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E1D6C7',
  },
  rowPressed: {
    backgroundColor: '#E3EFEA',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trial: {
    fontSize: 13,
    color: '#4E5D59',
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#D8CDBC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F4B42',
  },
  statusValid: {
    fontSize: 13,
    color: '#0F4B42',
  },
  statusWarning: {
    fontSize: 13,
    color: '#8D321D',
    fontWeight: '600',
  },
  values: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  valueBlock: {
    minWidth: 84,
  },
  label: {
    fontSize: 12,
    color: '#4E5D59',
  },
  value: {
    fontSize: 17,
    color: '#2D3733',
  },
  plotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E3EFEA',
    paddingTop: 8,
  },
  plot: {
    flexShrink: 1,
    fontSize: 14,
    color: '#4E5D59',
  },
  assign: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0F4B42',
  },
  assignPressed: {
    backgroundColor: '#E3EFEA',
  },
  assignText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F4B42',
  },
});
