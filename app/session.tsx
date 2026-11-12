import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import { listFarms, listPlots } from '@/application/farm/list-farms';
import { startSession } from '@/application/session/start-session';
import type { Plot } from '@/domain/farm/types';
import type { SettingsStore } from '@/ports/stores/settings-store';
import { Field } from '@/ui/components/field';
import { PlotPicker } from '@/ui/components/plot-picker';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useStickStatus } from '@/ui/hooks/use-stick-status';
import { useApp } from '@/ui/providers/app-context';

/** Clave de ajustes donde vive el contador de sesiones. */
const CONTADOR_SESIONES = 'next_session_id';

/**
 * Identificador legible de sesión: `sesion-1`, `sesion-2`, …
 *
 * El contador vive en los ajustes para que el identificador no se repita
 * aunque la app se reinicie.
 */
async function nextSessionId(settings: SettingsStore): Promise<string> {
  const guardado = await settings.get(CONTADOR_SESIONES);
  const leido = guardado === null ? Number.NaN : Number.parseInt(guardado, 10);
  const siguiente = Number.isInteger(leido) && leido >= 1 ? leido : 1;

  await settings.set(CONTADOR_SESIONES, String(siguiente + 1));

  return `sesion-${siguiente}`;
}

export default function SessionScreen() {
  const { stores, thresholds, gateway } = useApp();
  const status = useStickStatus(gateway);
  const params = useLocalSearchParams<{ plotId?: string }>();

  const [plots, setPlots] = useState<readonly Plot[]>([]);
  const [farmNames, setFarmNames] = useState<Record<string, string>>({});
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(params.plotId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [fincas, lotes] = await Promise.all([
        listFarms({ farms: stores.farms }),
        listPlots(null, { farms: stores.farms }),
      ]);

      const nombres: Record<string, string> = {};

      for (const farm of fincas) {
        for (const plot of lotes) {
          if (plot.farmId === farm.id) {
            nombres[plot.id] = farm.name;
          }
        }
      }

      setPlots(lotes);
      setFarmNames(nombres);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron leer los lotes');
    }
  }, [stores]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const plot = plots.find((item) => item.id === selectedPlotId) ?? null;

  function etiquetaCultivo(clave: string | null): string | null {
    if (clave === null) {
      return null;
    }

    return thresholds.crops[clave]?.label ?? clave;
  }

  function etiquetaUnidad(clave: string | null): string | null {
    if (clave === null) {
      return null;
    }

    return thresholds.cartographicUnits[clave]?.label ?? clave;
  }

  async function handleSave(): Promise<void> {
    setError(null);
    setMessage(null);

    if (plot === null) {
      setError('Elige el lote que vas a medir.');
      return;
    }

    if (plot.cropPrimary === null) {
      setError('El lote no tiene cultivo principal: edítalo antes de iniciar la sesión.');
      return;
    }

    setBusy(true);

    try {
      const id = await nextSessionId(stores.settings);

      const session = await startSession(
        {
          plotId: plot.id,
          cropPrimary: plot.cropPrimary,
          cropSecondary: plot.cropSecondary,
          depthCm: plot.depthCm,
          cartographicUnit: plot.cartographicUnit,
          lastFertilizationDate: plot.lastFertilizationDate,
        },
        {
          farms: stores.farms,
          sessions: stores.sessions,
          settings: stores.settings,
          gateway,
          clock: { now: () => new Date().toISOString() },
          thresholds,
          newId: () => id,
        },
      );

      setMessage(
        `Sesión guardada con la configuración ${session.configId}. Ya puedes medir en ese lote.`,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo iniciar la sesión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Sesión de medición</Text>
      <Text style={styles.subtitle}>
        Elige el lote y revisa el contexto antes de escribir la configuración al bastón.
      </Text>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Bastón:</Text>
        <Text style={styles.statusValue}>{status.connected ? 'conectado' : 'desconectado'}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Lote</Text>
        <PlotPicker
          plots={plots}
          selectedPlotId={selectedPlotId}
          onSelect={(item) => setSelectedPlotId(item.id)}
          farmNames={farmNames}
          emptyMessage="Todavía no hay lotes registrados. Crea una finca y un lote primero."
        />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Contexto de la sesión</Text>

        {plot === null ? (
          <Text style={styles.empty}>Elige un lote para ver su contexto.</Text>
        ) : (
          <View style={styles.fields}>
            <Field label="Lote" value={plot.name} />
            <Field label="Cultivo principal" value={etiquetaCultivo(plot.cropPrimary)} />
            <Field label="Cultivo asociado" value={etiquetaCultivo(plot.cropSecondary)} />
            <Field label="Unidad cartográfica" value={etiquetaUnidad(plot.cartographicUnit)} />
            <Field
              label="Profundidad de muestreo"
              value={plot.depthCm === null ? null : `${plot.depthCm} cm`}
            />
            <Field label="Última fertilización" value={plot.lastFertilizationDate} />
            <Field label="Versión de umbrales" value={thresholds.version} />
          </View>
        )}
      </View>

      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton
          label="Guardar sesión en el bastón"
          disabled={busy || plot === null}
          onPress={() => {
            void handleSave();
          }}
        />
      </View>

      <Text style={styles.note}>
        En este corte el bastón sigue siendo simulado: la configuración se guarda en el teléfono y
        no llega a un bastón real.
      </Text>
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
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: '#3F3F3F',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B4332',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5A5A5A',
  },
  fields: {
    gap: 12,
  },
  empty: {
    fontSize: 15,
    color: '#4A4A4A',
  },
  actions: {
    gap: 12,
  },
  message: {
    fontSize: 15,
    color: '#1B4332',
  },
  error: {
    fontSize: 15,
    color: '#8A3B12',
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A4A4A',
  },
});
