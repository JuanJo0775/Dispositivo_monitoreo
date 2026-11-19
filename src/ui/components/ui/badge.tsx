import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/ui/theme';

/** Tono del distintivo; el color nunca va solo: siempre lleva texto. */
export type BadgeTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'wine';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  testID?: string;
}

const TONES: Record<BadgeTone, { background: string; text: string }> = {
  neutral: { background: colors.neutralSoft, text: colors.neutral },
  primary: { background: colors.primarySoft, text: colors.primary },
  info: { background: colors.accentSoft, text: colors.accent },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  danger: { background: colors.dangerSoft, text: colors.danger },
  wine: { background: colors.wineSoft, text: colors.wine },
};

/**
 * Distintivo compacto de estado.
 *
 * Sirve para decir «En uso», «Sin datos» o «Pendiente» al lado de un título.
 * Nunca reemplaza al texto que explica el estado.
 */
export function Badge({ label, tone = 'neutral', testID }: BadgeProps) {
  const { background, text } = TONES[tone];

  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
