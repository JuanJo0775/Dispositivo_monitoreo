import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { listFarms, listPlots } from '@/application/farm/list-farms';
import type { Farm, Plot } from '@/domain/farm/types';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useApp } from '@/ui/providers/app-context';

export default function FarmsScreen() {
  const { stores, thresholds } = useApp();
  const router = useRouter();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [plotsByFarm, setPlotsByFarm] = useState<Record<string, Plot[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const listaFincas = await listFarms({ farms: stores.farms });
      const lotesPorFinca: Record<string, Plot[]> = {};

      for (const farm of listaFincas) {
        lotesPorFinca[farm.id] = await listPlots(farm.id, { farms: stores.farms });
      }

      setFarms(listaFincas);
      setPlotsByFarm(lotesPorFinca);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron leer las fincas');
    } finally {
      setLoading(false);
    }
  }, [stores]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function etiquetaCultivo(plot: Plot): string {
    if (plot.cropPrimary === null) {
      return 'sin dato';
    }

    return thresholds.crops[plot.cropPrimary]?.label ?? plot.cropPrimary;
  }

  function abrirSesion(plot: Plot): void {
    router.push({ pathname: '/session', params: { plotId: plot.id } });
  }

  function abrirLote(plot: Plot): void {
    router.push({ pathname: '/plot-form', params: { id: plot.id } });
  }

  function abrirFinca(farm: Farm): void {
    router.push({ pathname: '/farm-form', params: { id: farm.id } });
  }

  function crearLote(farm: Farm): void {
    router.push({ pathname: '/plot-form', params: { farmId: farm.id } });
  }

  function crearFinca(): void {
    router.push('/farm-form');
  }

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <PrimaryButton label="Crear finca" onPress={crearFinca} />
      </View>

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? <Text style={styles.note}>Cargando fincas…</Text> : null}

      {!loading && farms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Todavía no hay fincas registradas.</Text>
          <Text style={styles.emptyDetail}>
            Crea la primera finca y después agrega sus lotes para poder medir.
          </Text>
          <PrimaryButton label="Crear la primera finca" onPress={crearFinca} />
        </View>
      ) : (
        <FlatList
          data={farms}
          keyExtractor={(farm) => farm.id}
          contentContainerStyle={styles.list}
          renderItem={({ item: farm }) => {
            const plots = plotsByFarm[farm.id] ?? [];

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.farmName}>{farm.name}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Editar la finca ${farm.name}`}
                    onPress={() => abrirFinca(farm)}
                    style={styles.link}
                  >
                    <Text style={styles.linkText}>Editar</Text>
                  </Pressable>
                </View>

                {plots.length === 0 ? (
                  <Text style={styles.emptyPlots}>Esta finca todavía no tiene lotes.</Text>
                ) : (
                  <View style={styles.plots}>
                    {plots.map((plot) => (
                      <View key={plot.id} style={styles.plotRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Medir en el lote ${plot.name}`}
                          onPress={() => abrirSesion(plot)}
                          style={({ pressed }) => [styles.plotMain, pressed && styles.pressed]}
                        >
                          <Text style={styles.plotName}>{plot.name}</Text>
                          <Text style={styles.plotDetail}>
                            {etiquetaCultivo(plot)}
                            {plot.depthCm === null ? '' : ` · ${plot.depthCm} cm`}
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Editar el lote ${plot.name}`}
                          onPress={() => abrirLote(plot)}
                          style={styles.link}
                        >
                          <Text style={styles.linkText}>Editar</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                <PrimaryButton
                  label="Agregar lote"
                  variant="secondary"
                  onPress={() => crearLote(farm)}
                />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  farmName: {
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '700',
    color: '#1B4332',
  },
  plots: {
    gap: 8,
  },
  plotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    paddingRight: 12,
  },
  plotMain: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  pressed: {
    backgroundColor: '#EEF3EC',
  },
  plotName: {
    fontSize: 16,
    color: '#1F1F1F',
  },
  plotDetail: {
    fontSize: 13,
    color: '#5A5A5A',
  },
  link: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1B4332',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B4332',
    textAlign: 'center',
  },
  emptyDetail: {
    fontSize: 15,
    color: '#4A4A4A',
    textAlign: 'center',
  },
  emptyPlots: {
    fontSize: 15,
    color: '#4A4A4A',
  },
  note: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 14,
    color: '#4A4A4A',
  },
  error: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 15,
    color: '#8A3B12',
  },
});
