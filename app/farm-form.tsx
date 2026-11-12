import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { saveFarm } from '@/application/farm/save-farm';
import { MAX_NAME_LENGTH } from '@/domain/farm/validation';
import type { SettingsStore } from '@/ports/stores/settings-store';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useApp } from '@/ui/providers/app-context';

/** Clave de ajustes donde vive el contador de fincas. */
const CONTADOR_FINCAS = 'next_farm_id';

/**
 * Identificador legible de finca: `finca-1`, `finca-2`, …
 *
 * El contador vive en los ajustes para que el identificador no se repita
 * aunque la app se reinicie.
 */
async function nextFarmId(settings: SettingsStore): Promise<string> {
  const guardado = await settings.get(CONTADOR_FINCAS);
  const leido = guardado === null ? Number.NaN : Number.parseInt(guardado, 10);
  const siguiente = Number.isInteger(leido) && leido >= 1 ? leido : 1;

  await settings.set(CONTADOR_FINCAS, String(siguiente + 1));

  return `finca-${siguiente}`;
}

export default function FarmFormScreen() {
  const { stores } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const farmId = params.id;

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(farmId !== undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (farmId === undefined) {
        setLoading(false);
        return;
      }

      try {
        const farm = await stores.farms.getFarm(farmId);

        if (cancelled) {
          return;
        }

        if (farm === null) {
          setError('La finca que se quiere editar no existe.');
        } else {
          setName(farm.name);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudo leer la finca');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [farmId, stores]);

  async function handleSave(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const id = farmId === undefined ? await nextFarmId(stores.settings) : farmId;

      await saveFarm(farmId === undefined ? { name } : { id: farmId, name }, {
        farms: stores.farms,
        clock: { now: () => new Date().toISOString() },
        newId: () => id,
      });

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/farms');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la finca');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{farmId === undefined ? 'Nueva finca' : 'Editar finca'}</Text>
      <Text style={styles.subtitle}>La finca agrupa los lotes donde se mide el suelo.</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Nombre de la finca</Text>
        <TextInput
          accessibilityLabel="Nombre de la finca"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Finca El Mirador"
          maxLength={MAX_NAME_LENGTH}
          editable={!loading}
        />
        <Text style={styles.help}>Obligatorio. Máximo {MAX_NAME_LENGTH} caracteres.</Text>
      </View>

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton
          label={farmId === undefined ? 'Crear finca' : 'Guardar cambios'}
          disabled={busy || loading}
          onPress={() => {
            void handleSave();
          }}
        />
        <PrimaryButton
          label="Cancelar"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/farms');
            }
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B4332',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: '#3F3F3F',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5A5A5A',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F1F1F',
    backgroundColor: '#FFFFFF',
  },
  help: {
    fontSize: 13,
    color: '#5A5A5A',
  },
  actions: {
    gap: 12,
  },
  error: {
    fontSize: 15,
    color: '#8A3B12',
  },
});
