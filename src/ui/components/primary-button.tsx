import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius } from '@/ui/theme';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

/** Botón grande, legible bajo luz solar y con zona táctil ≥ 48 dp. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: PrimaryButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isDanger && styles.danger,
        variant === 'secondary' && styles.secondary,
        isGhost && styles.ghost,
        pressed && !disabled && (isPrimary || isDanger ? styles.pressedDark : styles.pressedSoft),
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          isPrimary || isDanger ? styles.onDarkLabel : styles.onLightLabel,
          isGhost && styles.ghostLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  pressedDark: {
    backgroundColor: colors.primaryPressed,
    borderColor: colors.primaryPressed,
  },
  pressedSoft: {
    backgroundColor: colors.primarySoft,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
  onDarkLabel: {
    color: colors.textOnDark,
  },
  onLightLabel: {
    color: colors.primary,
  },
  ghostLabel: {
    color: colors.accent,
  },
});
