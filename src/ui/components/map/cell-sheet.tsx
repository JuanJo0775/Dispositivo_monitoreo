import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PlotSpace, PlotSpacePoint } from '@/application/map/describe-plot-space';
import type { CellVerdict } from '@/domain/geo/cell-verdict';
import { formatArea, formatDateTimeLocal, formatNumber } from '@/shared/format';
import { VARIABLE_LABELS } from '@/ui/labels';

import { cellLabel, classRangeLabel, CLASS_LABELS, INCONCLUSIVE_LABEL } from './map-colors';

export interface CellSheetProps {
  space: PlotSpace;
  /** Celda que se muestra; si no existe, la hoja no se dibuja. */
  cellId: string;
  onClose: () => void;
  /** Toca una medición para abrir su diagnóstico. */
  onSelectMeasurement?: (measurementId: string) => void;
}

/**
 * Hoja inferior con el detalle de una celda.
 *
 * Dice el estado, el área, las clases y su conteo, el resumen por variable y las
 * mediciones que caen dentro. En una celda no concluyente **no** elige una
 * clase: muestra cómo se reparten los puntos y el motivo.
 */
export function CellSheet({ space, cellId, onClose, onSelectMeasurement }: CellSheetProps) {
  const celda = space.cells.find((item) => item.cell.id === cellId);

  if (celda === undefined) {
    return null;
  }

  const verdict = celda.verdict;
  const miembros = celda.measurementIds.flatMap((id) => {
    const punto = space.points.find((item) => item.measurement.id === id);

    return punto === undefined ? [] : [punto];
  });

  return (
    <View style={styles.sheet} testID="hoja-celda">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{cellLabel(verdict)}</Text>
          <Text style={styles.subtitle}>{describirConteo(verdict)}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar el detalle de la celda"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        >
          <Text style={styles.closeText}>Cerrar</Text>
        </Pressable>
      </View>

      <Text style={styles.area}>Área de la celda: {formatArea(celda.cell.areaHa)}</Text>

      {verdict.reason === null ? null : (
        <Text style={styles.reason}>{textoDelMotivo(verdict.reason)}</Text>
      )}

      {verdict.groups.length > 0 ? (
        <View style={styles.groups}>
          {verdict.groups.map((grupo) => (
            <Text key={grupo.classes.join('-')} style={styles.group}>
              {grupo.count} {classRangeLabel(grupo.classes) ?? INCONCLUSIVE_LABEL}
            </Text>
          ))}
        </View>
      ) : null}

      {celda.summary.length > 0 ? (
        <View style={styles.summary}>
          <Text style={styles.sectionTitle}>Resumen por variable</Text>

          {celda.summary.map((fila) => (
            <Text key={fila.variable} style={styles.summaryRow}>
              {VARIABLE_LABELS[fila.variable]}: mediana {formatNumber(fila.median)} {fila.unit} ·
              mínimo {formatNumber(fila.min)} · máximo {formatNumber(fila.max)} ({fila.points}{' '}
              {fila.points === 1 ? 'punto' : 'puntos'})
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Mediciones de la celda</Text>

      {miembros.length === 0 ? (
        <Text style={styles.empty}>Ninguna medición cayó en esta celda.</Text>
      ) : (
        <ScrollView style={styles.list} nestedScrollEnabled>
          {miembros.map((punto) => (
            <MeasurementRow
              key={punto.measurement.id}
              punto={punto}
              onPress={
                onSelectMeasurement === undefined
                  ? undefined
                  : () => onSelectMeasurement(punto.measurement.id)
              }
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function MeasurementRow({ punto, onPress }: { punto: PlotSpacePoint; onPress?: () => void }) {
  const clases = punto.diagnosis?.classes ?? [];
  const estado = !punto.measurement.valid
    ? 'inválida'
    : clases.length === 0
      ? 'sin diagnóstico'
      : (classRangeLabel(clases) ?? INCONCLUSIVE_LABEL);

  return (
    <Pressable
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      accessibilityLabel={`Medición del ${formatDateTimeLocal(punto.measurement.capturedAtUtc)}, ${estado}`}
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.measurement, pressed && styles.measurementPressed]}
    >
      <Text style={styles.measurementTime}>
        {formatDateTimeLocal(punto.measurement.capturedAtUtc)}
      </Text>
      <Text style={styles.measurementState}>{estado}</Text>
    </Pressable>
  );
}

/** Texto de cuántos puntos sostienen el dictamen. */
function describirConteo(verdict: CellVerdict): string {
  const validos = verdict.validPoints;
  const invalidas =
    verdict.invalidPoints === 0
      ? ''
      : ` · ${verdict.invalidPoints} ${verdict.invalidPoints === 1 ? 'inválida' : 'inválidas'}`;

  if (verdict.state === 'sin_dato') {
    return validos === 0 && verdict.invalidPoints === 0
      ? 'Sin mediciones en la celda.'
      : `Sin mediciones válidas${invalidas}`;
  }

  if (verdict.state === 'un_punto') {
    return `1 punto válido${invalidas}`;
  }

  return `${validos} puntos válidos${invalidas}`;
}

/** Motivo del dictamen no concluyente, en texto. */
function textoDelMotivo(reason: string): string {
  switch (reason) {
    case 'sin_diagnostico':
      return 'Hay puntos sin diagnóstico: sin él, la celda no puede dictaminar.';
    case 'diagnostico_bloqueado':
      return 'El diagnóstico está bloqueado por un dato que impide dictaminar.';
    case 'datos_insuficientes':
      return 'Los datos alcanzan para describir el suelo, pero no para dar una clase.';
    case 'clases_distintas':
      return 'Los puntos no coinciden en su conjunto de clases: no se promedia ni se elige uno.';
    default:
      return reason;
  }
}

// Reexportado para que la pantalla y las pruebas nombren la misma tabla.
export { CLASS_LABELS };

const styles = StyleSheet.create({
  sheet: {
    gap: 8,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    maxHeight: 420,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B4332',
  },
  subtitle: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  close: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  closePressed: {
    opacity: 0.6,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
  },
  area: {
    fontSize: 14,
    color: '#1F1F1F',
  },
  reason: {
    fontSize: 14,
    color: '#8A3B12',
  },
  groups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  group: {
    fontSize: 14,
    color: '#1F1F1F',
    backgroundColor: '#F2F0E9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  summary: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
    marginTop: 4,
  },
  summaryRow: {
    fontSize: 14,
    color: '#1F1F1F',
  },
  empty: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  list: {
    maxHeight: 160,
  },
  measurement: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0EA',
  },
  measurementPressed: {
    backgroundColor: '#EEF3EC',
  },
  measurementTime: {
    fontSize: 14,
    color: '#1F1F1F',
  },
  measurementState: {
    fontSize: 14,
    color: '#4A4A4A',
  },
});
