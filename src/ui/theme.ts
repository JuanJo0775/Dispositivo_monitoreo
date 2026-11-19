import type { TextStyle } from 'react-native';

/**
 * Sistema de diseño de la app.
 *
 * La paleta viene de la guía de marca de Cofinet (verdes de montaña, vinos y
 * terracotas de café, beiges de pradera) y se adapta a este producto: verde
 * profundo para lo principal, turquesa para lo activo, vino y terracota para
 * lo que pide atención. Los colores de aptitud del mapa **no** salen de acá:
 * esos son semánticos y viven en `map-colors.ts`.
 */
export const palette = {
  forest950: '#013322',
  forest900: '#015439',
  forest700: '#2D963B',
  forest600: '#3F5B46',
  forest300: '#A9CBB5',
  slate900: '#263849',
  slate700: '#385457',
  wine900: '#46122F',
  wine700: '#671741',
  wine500: '#932553',
  wine100: '#F4E2EA',
  terracotta900: '#601E18',
  terracotta700: '#8D321D',
  terracotta100: '#F9E6DA',
  clay: '#B37956',
  cream: '#EFDDC9',
  sand: '#F0E7DF',
} as const;

/** Colores por uso, no por tono: la pantalla pide `colors.text`, no un hex. */
export const colors = {
  background: '#F7F1E8',
  surface: '#FFFFFF',
  surfaceMuted: '#F3ECE2',
  border: '#E1D6C7',
  borderStrong: '#D8CDBC',
  text: '#2D3733',
  textMuted: '#4E5D59',
  textSoft: '#6B7671',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#DCEAE2',
  primary: palette.forest900,
  primaryPressed: palette.forest950,
  primarySoft: '#E2F0E3',
  accent: palette.forest700,
  accentSoft: '#E4F3E0',
  wine: palette.wine700,
  wineSoft: palette.wine100,
  terracotta: palette.terracotta700,
  terracottaSoft: palette.terracotta100,
  warning: palette.terracotta700,
  warningSoft: '#FBEDE0',
  danger: palette.terracotta900,
  dangerSoft: '#F7DED4',
  success: palette.forest700,
  successSoft: '#E4F3E0',
  neutral: palette.forest600,
  neutralSoft: '#E9E4DA',
  overlay: 'rgba(29, 59, 55, 0.08)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Sombras suaves: dan profundidad sin ensuciar el fondo beige. */
export const elevation = {
  card: {
    shadowColor: palette.forest950,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

/** Escala tipográfica. Los tamaños grandes son para leer bajo el sol. */
export const typography: Record<
  'display' | 'title' | 'subtitle' | 'body' | 'label' | 'caption',
  TextStyle
> = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: colors.text,
  },
  title: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.textMuted,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSoft,
  },
};
