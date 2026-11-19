import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, elevation, radius, spacing, typography } from '@/ui/theme';

import type { CardAccent } from './card';

export interface ActionCardProps {
  title: string;
  detail: string;
  accent?: Exclude<CardAccent, 'none'>;
  onPress: () => void;
  /** Texto para lectores de pantalla; por defecto, el título. */
  accessibilityLabel?: string;
}

const ACCENT_COLORS: Record<Exclude<CardAccent, 'none'>, string> = {
  primary: colors.primary,
  accent: colors.accent,
  wine: colors.wine,
  terracotta: colors.terracotta,
};

/**
 * Tarjeta que abre otra pantalla.
 *
 * Más grande que un botón y con una descripción corta: en campo se toca con
 * guantes y con el teléfono al sol. La zona táctil ocupa toda la tarjeta.
 */
export function ActionCard({
  title,
  detail,
  accent = 'primary',
  onPress,
  accessibilityLabel,
}: ActionCardProps) {
  const color = ACCENT_COLORS[accent];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.accent, { backgroundColor: color }]} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
        <Text style={[styles.open, { color }]}>Abrir ›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '44%',
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.card,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  accent: {
    width: 6,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: 2,
    minHeight: 116,
  },
  title: {
    ...typography.label,
    color: colors.text,
  },
  detail: {
    ...typography.caption,
    flexGrow: 1,
  },
  open: {
    marginTop: spacing.xs,
    fontSize: 13,
    fontWeight: '700',
  },
});
