import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlotSpace, PlotSpacePoint } from '@/application/map/describe-plot-space';
import { formatCoordinate, formatDateTimeLocal, formatNumber } from '@/shared/format';

import { classRangeLabel, INCONCLUSIVE_LABEL } from './map-colors';

export interface PointListProps {
  space: PlotSpace;
  /** Toca una medición para abrir su diagnóstico. */
  onSelectMeasurement?: (measurementId: string) => void;
}

/**
 * Puntos documentados del lote.
 *
 * Cada fila dice la hora, las coordenadas o «sin posición», la calidad del GPS,
 * la clase del punto y sus alertas. Un punto sin posición se queda en la lista:
 * existe, se midió y el mapa simplemente no puede ubicarlo.
 */
export function PointList({ space, onSelectMeasurement }: PointListProps) {
  if (space.points.length === 0) {
    return <Text style={styles.empty}>Todavía no hay mediciones en este lote.</Text>;
  }

  return (
    <View style={styles.list}>
      {space.points.map((punto) => (
        <PointRow
          key={punto.measurement.id}
          punto={punto}
          onPress={
            onSelectMeasurement === undefined
              ? undefined
              : () => onSelectMeasurement(punto.measurement.id)
          }
        />
      ))}
    </View>
  );
}

function PointRow({ punto, onPress }: { punto: PlotSpacePoint; onPress?: () => void }) {
  const { measurement, position, diagnosis } = punto;
  const hora = formatDateTimeLocal(measurement.capturedAtUtc);
  const estado = estadoDelPunto(punto);
  const coordenadas =
    position.latLon === null
      ? 'sin posición'
      : `${formatCoordinate(position.latLon.latitude)}, ${formatCoordinate(position.latLon.longitude)}`;
  const alertas = diagnosis?.alerts ?? [];

  return (
    <Pressable
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      accessibilityLabel={`Medición del ${hora}, ${estado}`}
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.header}>
        <Text style={styles.time}>{hora}</Text>
        <Text style={styles.state}>{estado}</Text>
      </View>

      <Text style={styles.coordinates}>{coordenadas}</Text>
      <Text style={styles.quality}>{calidadDelPunto(punto)}</Text>

      {alertas.map((alerta) => (
        <Text key={`${alerta.code}|${alerta.message}`} style={styles.alert}>
          {alerta.message}
        </Text>
      ))}
    </Pressable>
  );
}

/** Clase del punto, o el motivo por el que no la tiene. */
function estadoDelPunto(punto: PlotSpacePoint): string {
  if (!punto.measurement.valid) {
    return 'Medición inválida: no entra al dictamen.';
  }

  if (punto.diagnosis === null) {
    return 'Sin diagnóstico: falta el contexto de la sesión.';
  }

  return classRangeLabel(punto.diagnosis.classes) ?? INCONCLUSIVE_LABEL;
}

/** Texto de la calidad de la posición, con el HDOP tal como lo reportó el bastón. */
function calidadDelPunto(punto: PlotSpacePoint): string {
  const { position } = punto;

  if (position.latLon === null) {
    return 'Sin posición del GPS: no se puede ubicar en el mapa.';
  }

  if (position.hdop === null) {
    return `posición ${position.quality}`;
  }

  return `posición ${position.quality} · HDOP ${formatNumber(position.hdop)}`;
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  empty: {
    fontSize: 15,
    color: '#4E5D59',
  },
  row: {
    gap: 2,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1D6C7',
  },
  rowPressed: {
    backgroundColor: '#E2F0E3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  time: {
    fontSize: 15,
    fontWeight: '600',
    color: '#015439',
  },
  state: {
    flexShrink: 1,
    fontSize: 14,
    color: '#2D3733',
    textAlign: 'right',
  },
  coordinates: {
    fontSize: 14,
    color: '#2D3733',
  },
  quality: {
    fontSize: 13,
    color: '#4E5D59',
  },
  alert: {
    fontSize: 13,
    color: '#8D321D',
  },
});
