import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlotSpace } from '@/application/map/describe-plot-space';

import {
  cellBorderColor,
  cellFillColor,
  cellLabel,
  CLASS_LABELS,
  fillColorForClasses,
  INCONCLUSIVE_COLOR,
} from './map-colors';
import {
  percentCells,
  percentPoints,
  spaceAspectRatio,
  type PercentCell,
  type PercentPoint,
} from './map-geometry';

export interface FallbackMapProps {
  space: PlotSpace;
  onSelectCell?: (cellId: string) => void;
  onSelectPoint?: (measurementId: string) => void;
}

/**
 * Croquis del área medida para cuando no hay paquete de teselas.
 *
 * Usa la misma proyección local que el mapa real: la malla se dibuja sobre un
 * lienzo con la relación ancho/alto del área medida, así las celdas conservan
 * su forma y los puntos caen donde se midieron. No hay relieve, vías ni ríos:
 * se dice, para que nadie confunda el croquis con un mapa topográfico.
 */
export function FallbackMap({ space, onSelectCell, onSelectPoint }: FallbackMapProps) {
  const celdas = percentCells(space);
  const puntos = percentPoints(space);

  return (
    <View style={styles.container} testID="mapa-sin-teselas">
      <Text style={styles.title}>Mapa sin teselas</Text>
      <Text style={styles.hint}>
        Sin paquete de teselas no hay relieve ni vías. El croquis conserva la forma del área medida
        y la posición de cada punto.
      </Text>

      {celdas.length === 0 ? (
        <Text style={styles.empty}>Todavía no hay puntos con posición en este lote.</Text>
      ) : (
        <View style={[styles.canvas, { aspectRatio: spaceAspectRatio(space) }]} testID="croquis">
          {celdas.map((porcentaje) => (
            <CellBox
              key={porcentaje.cell.cell.id}
              percent={porcentaje}
              onPress={
                onSelectCell === undefined ? undefined : () => onSelectCell(porcentaje.cell.cell.id)
              }
            />
          ))}

          {puntos.map((porcentaje) => (
            <PointDot
              key={porcentaje.point.measurement.id}
              percent={porcentaje}
              onPress={
                onSelectPoint === undefined
                  ? undefined
                  : () => onSelectPoint(porcentaje.point.measurement.id)
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CellBox({ percent, onPress }: { percent: PercentCell; onPress?: () => void }) {
  const { cell, leftPct, topPct, widthPct, heightPct } = percent;
  const etiqueta = cellLabel(cell.verdict);

  return (
    <Pressable
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      accessibilityLabel={`Celda ${etiqueta}`}
      disabled={onPress === undefined}
      onPress={onPress}
      style={[
        styles.cell,
        {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          backgroundColor: cellFillColor(cell.verdict),
          borderColor: cellBorderColor(cell.verdict),
        },
      ]}
      testID={`celda-${cell.cell.id}`}
    />
  );
}

function PointDot({ percent, onPress }: { percent: PercentPoint; onPress?: () => void }) {
  const { point, leftPct, topPct } = percent;
  const clases = point.diagnosis?.classes ?? [];
  const relleno = point.measurement.valid ? fillColorForClasses(clases) : INCONCLUSIVE_COLOR;
  const nombre =
    clases.length === 0 ? 'sin clase' : clases.map((clase) => CLASS_LABELS[clase]).join(' o ');

  return (
    <Pressable
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      accessibilityLabel={`Punto ${nombre}`}
      disabled={onPress === undefined}
      onPress={onPress}
      style={[
        styles.point,
        point.position.quality === 'imprecisa' ? styles.pointHollow : null,
        {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          backgroundColor: point.position.quality === 'imprecisa' ? '#FFFFFF' : relleno,
          borderColor: relleno,
        },
      ]}
      testID={`punto-${point.measurement.id}`}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 16,
    backgroundColor: '#F7F5EF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
  },
  hint: {
    fontSize: 13,
    color: '#4A4A4A',
  },
  empty: {
    fontSize: 14,
    color: '#4A4A4A',
    paddingVertical: 24,
    textAlign: 'center',
  },
  canvas: {
    width: '100%',
    minHeight: 160,
    backgroundColor: '#EDEAE0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  cell: {
    position: 'absolute',
    borderWidth: 1,
    opacity: 0.9,
  },
  point: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    borderWidth: 2,
  },
  pointHollow: {
    borderWidth: 3,
  },
});
