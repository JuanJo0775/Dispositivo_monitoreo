import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { getSettings } from '@/application/settings/get-settings';
import { setTrialMode } from '@/application/settings/set-trial-mode';
import { FACTORY_CALIBRATION_VERSION, ENGINE_VERSION } from '@/shared/versions';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useApp } from '@/ui/providers/app-context';

/**
 * Ajustes mínimos.
 *
 * Solo presenta lo que hay y llama a los casos de uso: no borra datos ni decide reglas.
 */
export default function SettingsScreen() {
  const { stores, thresholds } = useApp();
  const router = useRouter();

  const [trialMode, setTrialModeValue] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load(): Promise<void> {
        try {
          const settings = await getSettings({ settings: stores.settings });

          if (!cancelled) {
            setTrialModeValue(settings.trialMode);
          }
        } catch (loadError) {
          if (!cancelled) {
            setError(
              loadError instanceof Error ? loadError.message : 'No se pudieron leer los ajustes',
            );
          }
        }
      }

      void load();

      return () => {
        cancelled = true;
      };
    }, [stores]),
  );

  async function handleTrialMode(enabled: boolean): Promise<void> {
    setError(null);
    setMessage(null);

    try {
      await setTrialMode(enabled, { settings: stores.settings });
      setTrialModeValue(enabled);
      setMessage(
        enabled
          ? 'Modo ensayo activado: las capturas quedan marcadas como ensayo.'
          : 'Modo ensayo desactivado.',
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el ajuste');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Versiones activas</Text>

        <Text style={styles.label}>Versión de umbrales</Text>
        <Text style={styles.value}>{thresholds.version}</Text>

        <Text style={styles.label}>Versión de calibración</Text>
        <Text style={styles.value}>{FACTORY_CALIBRATION_VERSION}</Text>

        <Text style={styles.label}>Versión del motor de diagnóstico</Text>
        <Text style={styles.value}>{ENGINE_VERSION}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Modo ensayo</Text>

        <View style={styles.switchRow}>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: trialMode }}
            accessibilityLabel="Modo ensayo"
            onPress={() => {
              void handleTrialMode(!trialMode);
            }}
            style={styles.switchLabel}
          >
            <Text style={styles.label}>Modo ensayo</Text>
            <Text style={styles.hint}>
              En modo ensayo las capturas no son productivas: sirven para probar el equipo.
            </Text>
          </Pressable>

          <Switch
            value={trialMode}
            onValueChange={(value) => {
              void handleTrialMode(value);
            }}
            trackColor={{ false: '#C9D3C4', true: '#1B4332' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton
          label="Ver aviso de privacidad"
          variant="secondary"
          onPress={() => {
            router.push('/privacy');
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F2',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5A5A5A',
  },
  label: {
    fontSize: 16,
    color: '#3F3F3F',
  },
  value: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1B4332',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  switchLabel: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    gap: 2,
  },
  hint: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  message: {
    fontSize: 15,
    color: '#1B4332',
  },
  error: {
    fontSize: 15,
    color: '#8A3B12',
  },
  actions: {
    gap: 12,
  },
});
