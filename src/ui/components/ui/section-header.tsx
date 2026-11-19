import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/ui/theme';

export interface SectionHeaderProps {
  title: string;
  /** Línea corta debajo del título; opcional. */
  detail?: string;
  /** Contenido a la derecha, por ejemplo un distintivo o un enlace. */
  trailing?: ReactNode;
}

/** Título de sección con una línea de apoyo y un espacio a la derecha. */
export function SectionHeader({ title, detail, trailing }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.texts}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {detail === undefined ? null : <Text style={styles.detail}>{detail}</Text>}
      </View>
      {trailing ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  texts: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    ...typography.title,
    color: colors.primary,
  },
  detail: {
    ...typography.caption,
  },
});
