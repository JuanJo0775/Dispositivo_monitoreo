import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/ui/components/primary-button';
import { ActionCard } from '@/ui/components/ui/action-card';
import { Card } from '@/ui/components/ui/card';
import { SectionHeader } from '@/ui/components/ui/section-header';
import { colors, palette, radius, spacing, typography } from '@/ui/theme';

/**
 * Inicio: qué puede hacer la app, sin menús escondidos.
 *
 * Primero la acción del día (conectar el bastón), después las cuatro tareas
 * frecuentes en tarjetas grandes y, al final, la promesa del producto: todo
 * funciona sin internet.
 */
export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Image
          accessibilityLabel="Agrovia"
          accessibilityRole="image"
          source={require('../assets/brand/agrovia-logo-blanco.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.heroTitle}>El suelo de tu lote, medido y documentado</Text>
        <Text style={styles.heroText}>
          Cada medición queda guardada en el teléfono con su hora y su posición. Sin cuentas, sin
          señal y sin depender de un servidor.
        </Text>
      </View>

      <PrimaryButton label="Conectar bastón" onPress={() => router.push('/connect')} />

      <SectionHeader
        title="Tareas frecuentes"
        detail="Todo lo que ya está en el teléfono, también en campo."
      />

      <View style={styles.grid}>
        <ActionCard
          title="Medir"
          detail="Toma una lectura y guárdala con su contexto."
          accent="accent"
          onPress={() => router.push('/measure')}
        />
        <ActionCard
          title="Historial"
          detail="Revisa capturas, diagnósticos y el lote de cada una."
          accent="wine"
          onPress={() => router.push('/history')}
        />
        <ActionCard
          title="Mapa del lote"
          detail="Malla, celdas y puntos sobre el mapa incluido."
          accent="terracotta"
          onPress={() => router.push('/map')}
        />
        <ActionCard
          title="Sincronizar microSD"
          detail="Trae del bastón lo capturado sin conexión."
          accent="primary"
          onPress={() => router.push('/sync')}
        />
      </View>

      <Card muted accent="primary">
        <Text style={styles.noteTitle}>Funciona sin internet</Text>
        <Text style={styles.note}>
          El bastón guarda cada medición y la app la conserva en el teléfono. El mapa se arma con
          las coordenadas del GPS del bastón y el paquete de mapas viaja dentro de la app.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
    padding: spacing.xl,
    paddingBottom: spacing.xl + spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: palette.forest950,
  },
  logo: {
    width: 168,
    height: 42,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    ...typography.display,
    color: colors.textOnDark,
  },
  heroText: {
    ...typography.subtitle,
    color: colors.textOnDarkMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  noteTitle: {
    ...typography.label,
    color: colors.primary,
  },
  note: {
    ...typography.caption,
  },
});
