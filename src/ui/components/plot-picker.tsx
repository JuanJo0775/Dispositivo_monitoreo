import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Plot } from '@/domain/farm/types';

export interface PlotPickerProps {
  /** Lotes que se pueden elegir. */
  plots: readonly Plot[];
  /** Lote elegido, si ya hay uno. */
  selectedPlotId?: string | null;
  /** Se llama con el lote que el usuario elige. */
  onSelect: (plot: Plot) => void;
  /** Finca de cada lote, con el id del lote como clave, para distinguirlos. */
  farmNames?: Readonly<Record<string, string>>;
  /** Texto cuando no hay lotes; por defecto «Todavía no hay lotes registrados.». */
  emptyMessage?: string;
}

/**
 * Selector de lote: lista los lotes y avisa cuando no hay ninguno.
 *
 * Solo presenta y llama; no decide nada del lote. El lote elegido se marca
 * con la palabra «Seleccionado», no solo con el color.
 */
export function PlotPicker({
  plots,
  selectedPlotId = null,
  onSelect,
  farmNames = {},
  emptyMessage = 'Todavía no hay lotes registrados.',
}: PlotPickerProps) {
  if (plots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.empty}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {plots.map((plot) => {
        const seleccionado = plot.id === selectedPlotId;
        const farmName = farmNames[plot.id];

        return (
          <Pressable
            key={plot.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: seleccionado }}
            accessibilityLabel={`Lote ${plot.name}`}
            onPress={() => onSelect(plot)}
            style={({ pressed }) => [
              styles.row,
              seleccionado && styles.rowSelected,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.text}>
              <Text style={[styles.name, seleccionado && styles.nameSelected]}>{plot.name}</Text>
              {farmName === undefined ? null : <Text style={styles.farm}>{farmName}</Text>}
            </View>
            {seleccionado ? <Text style={styles.tag}>Seleccionado</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  emptyContainer: {
    paddingVertical: 16,
  },
  empty: {
    fontSize: 15,
    color: '#4E5D59',
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1D6C7',
    backgroundColor: '#FFFFFF',
  },
  rowSelected: {
    borderWidth: 2,
    borderColor: '#015439',
  },
  rowPressed: {
    backgroundColor: '#E2F0E3',
  },
  name: {
    fontSize: 16,
    color: '#2D3733',
  },
  text: {
    flexShrink: 1,
    gap: 2,
  },
  farm: {
    fontSize: 13,
    color: '#4E5D59',
  },
  nameSelected: {
    fontWeight: '700',
    color: '#015439',
  },
  tag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#015439',
  },
});
