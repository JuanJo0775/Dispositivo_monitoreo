import { StyleSheet, Text, View } from 'react-native';

import type { AptitudeClass } from '@/domain/diagnosis/types';

import {
  CLASS_COLORS,
  CLASS_LABELS,
  CLASS_ORDER,
  INCONCLUSIVE_COLOR,
  INCONCLUSIVE_LABEL,
  NO_DATA_COLOR,
  NO_DATA_LABEL,
} from './map-colors';

export interface MapLegendProps {
  /** Clases que aparecen en el lote; las demás no se listan. */
  classes: readonly AptitudeClass[];
  /** Muestra de dos tonos, para explicar el relleno y el borde. */
  showTwoTone?: boolean;
}

/**
 * Leyenda del mapa.
 *
 * Repite el nombre de cada estado junto a su color: el color no es el único
 * canal. “Sin dato” se muestra siempre para dejar claro que una celda vacía no
 * tiene color de clase.
 */
export function MapLegend({ classes, showTwoTone = false }: MapLegendProps) {
  const presentes = CLASS_ORDER.filter((clase) => classes.includes(clase));

  return (
    <View style={styles.container} accessibilityLabel="Leyenda del mapa">
      <Text style={styles.title}>Leyenda</Text>

      <View style={styles.items}>
        {presentes.map((clase) => (
          <LegendEntry
            key={clase}
            color={CLASS_COLORS[clase]}
            label={CLASS_LABELS[clase]}
            testID={`leyenda-${clase}`}
            swatchTestID={`muestra-${clase}`}
          />
        ))}

        <LegendEntry
          color={NO_DATA_COLOR}
          label={NO_DATA_LABEL}
          testID="leyenda-sin-dato"
          swatchTestID="muestra-sin-dato"
        />

        <LegendEntry
          color={INCONCLUSIVE_COLOR}
          label={INCONCLUSIVE_LABEL}
          testID="leyenda-no-concluyente"
          swatchTestID="muestra-no-concluyente"
        />

        {showTwoTone ? (
          <View style={styles.entry} testID="leyenda-dos-tonos">
            <View
              style={[
                styles.swatch,
                styles.twoToneSwatch,
                {
                  backgroundColor: CLASS_COLORS.S1,
                  borderColor: CLASS_COLORS.S2,
                },
              ]}
              testID="muestra-dos-tonos"
            />
            <Text style={styles.label}>Dos clases posibles: relleno la mejor, borde la peor</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function LegendEntry({
  color,
  label,
  testID,
  swatchTestID,
}: {
  color: string;
  label: string;
  testID: string;
  swatchTestID: string;
}) {
  return (
    <View style={styles.entry} testID={testID}>
      <View style={[styles.swatch, { backgroundColor: color }]} testID={swatchTestID} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#015439',
  },
  items: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  twoToneSwatch: {
    borderWidth: 3,
  },
  label: {
    fontSize: 14,
    color: '#2D3733',
  },
});
