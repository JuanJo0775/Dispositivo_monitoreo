import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Measurement } from '@/domain/measurement/types';
import { formatDateTimeLocal, formatMeasure } from '@/shared/format';

export interface HistoryListProps {
  measurements: readonly Measurement[];
  onSelect: (measurement: Measurement) => void;
  emptyMessage?: string;
}

function MeasurementRow({
  measurement,
  onSelect,
}: {
  measurement: Measurement;
  onSelect: (measurement: Measurement) => void;
}) {
  const status = measurement.valid ? 'válida' : 'revisar';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Medición del ${formatDateTimeLocal(measurement.capturedAtUtc)}, ${status}`}
      onPress={() => onSelect(measurement)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.date}>{formatDateTimeLocal(measurement.capturedAtUtc)}</Text>
        <Text style={measurement.valid ? styles.statusValid : styles.statusWarning}>{status}</Text>
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
    </Pressable>
  );
}

/** Lista de mediciones del historial. No consulta datos: recibe y muestra. */
export function HistoryList({
  measurements,
  onSelect,
  emptyMessage = 'Todavía no hay mediciones guardadas.',
}: HistoryListProps) {
  return (
    <FlatList
      data={measurements}
      keyExtractor={(measurement) => measurement.id}
      contentContainerStyle={measurements.length === 0 ? styles.emptyContainer : styles.list}
      renderItem={({ item }) => <MeasurementRow measurement={item} onSelect={onSelect} />}
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
    color: '#4A4A4A',
    textAlign: 'center',
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#DCE3DA',
  },
  rowPressed: {
    backgroundColor: '#EEF3EC',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
  },
  statusValid: {
    fontSize: 13,
    color: '#1B4332',
  },
  statusWarning: {
    fontSize: 13,
    color: '#8A3B12',
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
    color: '#5A5A5A',
  },
  value: {
    fontSize: 17,
    color: '#1F1F1F',
  },
});
