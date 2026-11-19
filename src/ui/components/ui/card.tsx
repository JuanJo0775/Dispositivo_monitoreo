import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, elevation, radius, spacing } from '@/ui/theme';

/** Franja de color que identifica el tipo de tarjeta. */
export type CardAccent = 'none' | 'primary' | 'accent' | 'wine' | 'terracotta';

export interface CardProps {
  children: ReactNode;
  /** Franja vertical a la izquierda; por defecto ninguna. */
  accent?: CardAccent;
  /** Fondo tenue para información secundaria. */
  muted?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const ACCENT_COLORS: Record<CardAccent, string> = {
  none: 'transparent',
  primary: colors.primary,
  accent: colors.accent,
  wine: colors.wine,
  terracotta: colors.terracotta,
};

/**
 * Contenedor de información agrupada.
 *
 * Reemplaza los `View` con borde repetidos: fondo, borde, sombra y radio salen
 * del tema, y la franja de color sirve para distinguir secciones sin gritar.
 */
export function Card({ children, accent = 'none', muted = false, testID, style }: CardProps) {
  return (
    <View testID={testID} style={[styles.card, muted && styles.muted, style]}>
      {accent === 'none' ? null : (
        <View
          testID={testID === undefined ? undefined : `${testID}-accent`}
          style={[styles.accent, { backgroundColor: ACCENT_COLORS[accent] }]}
        />
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.card,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  accent: {
    width: 6,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
