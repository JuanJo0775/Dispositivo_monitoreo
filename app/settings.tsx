import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { getSettings } from '@/application/settings/get-settings';
import { setTrialMode } from '@/application/settings/set-trial-mode';
import { deleteUserData } from '@/application/privacy/delete-user-data';
import { FACTORY_CALIBRATION_VERSION, ENGINE_VERSION } from '@/shared/versions';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useApp } from '@/ui/providers/app-context';

/**
 * Ajustes mínimos.
 *
 * Solo presenta lo que hay y llama a los casos de uso: no borra datos ni decide reglas.
 */
export default function SettingsScreen() {
  const { stores, thresholds, mapFiles } = useApp();
  const router = useRouter();

  const [trialMode, setTrialModeValue] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  async function handleDeleteAll(): Promise<void> {
    setError(null);
    setMessage(null);
    setDeleting(true);

    try {
      const result = await deleteUserData({
        userData: stores.userData,
        mapPackages: stores.mapPackages,
        files: mapFiles,
      });

      const partes = [
        `${result.erased.measurements} ${result.erased.measurements === 1 ? 'medición' : 'mediciones'}`,
        `${result.erased.plots} ${result.erased.plots === 1 ? 'lote' : 'lotes'}`,
        `${result.erased.farms} ${result.erased.farms === 1 ? 'finca' : 'fincas'}`,
      ];
      let texto = `Se borraron ${partes.join(', ')}.`;

      if (result.erased.mapPackages > 0) {
        texto += ` También se borraron ${result.erased.mapPackages} ${
          result.erased.mapPackages === 1
            ? 'paquete de mapa importado'
            : 'paquetes de mapa importados'
        }.`;
      }

      if (result.failedFiles > 0) {
        texto +=
          ' Algunos archivos de mapa no se pudieron borrar del almacenamiento; el resto de sus datos sí se borró.';
      }

      setTrialModeValue(false);
      setConfirmingDelete(false);
      setMessage(texto);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'No se pudieron borrar los datos',
      );
    } finally {
      setDeleting(false);
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
            trackColor={{ false: '#D8CDBC', true: '#0F4B42' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sus datos</Text>

        {confirmingDelete ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>¿Borrar todos sus datos?</Text>
            <Text style={styles.hint}>
              Se borran las fincas, los lotes, las capturas, las mediciones, los diagnósticos, las
              sesiones y los paquetes de mapa importados. No se puede deshacer. Se conservan los
              umbrales científicos y el mapa incluido en la app.
            </Text>

            <PrimaryButton
              label={deleting ? 'Borrando…' : 'Sí, borrar todo'}
              variant="danger"
              disabled={deleting}
              onPress={() => {
                void handleDeleteAll();
              }}
            />
            <PrimaryButton
              label="Cancelar"
              variant="secondary"
              disabled={deleting}
              onPress={() => {
                setConfirmingDelete(false);
              }}
            />
          </View>
        ) : (
          <>
            <Text style={styles.hint}>
              Fincas, lotes, mediciones y diagnósticos viven solo en este teléfono. Puede borrarlos
              aquí cuando quiera.
            </Text>
            <PrimaryButton
              label="Borrar todos mis datos"
              variant="secondary"
              onPress={() => {
                setMessage(null);
                setError(null);
                setConfirmingDelete(true);
              }}
            />
          </>
        )}
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
    backgroundColor: '#F7F1E8',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1D6C7',
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#4E5D59',
  },
  label: {
    fontSize: 16,
    color: '#4E5D59',
  },
  value: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F4B42',
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
    lineHeight: 20,
    color: '#4E5D59',
  },
  confirmBox: {
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9B7A4',
    backgroundColor: '#FDF3EA',
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8D321D',
  },
  message: {
    fontSize: 15,
    color: '#0F4B42',
  },
  error: {
    fontSize: 15,
    color: '#8D321D',
  },
  actions: {
    gap: 12,
  },
});
