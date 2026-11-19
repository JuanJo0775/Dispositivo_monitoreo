import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { listFarms, listPlots } from '@/application/farm/list-farms';
import { describePlotSpace, type PlotSpace } from '@/application/map/describe-plot-space';
import { ensurePlotDiagnoses } from '@/application/map/ensure-plot-diagnoses';
import { getActiveMapPackage } from '@/application/map/manage-map-packages';
import { prepareBaseMap } from '@/application/map/prepare-base-map';
import type { AptitudeClass } from '@/domain/diagnosis/types';
import type { Plot } from '@/domain/farm/types';
import { MAX_CELLS } from '@/domain/geo/grid';
import type { MapPackage } from '@/ports/stores/map-package-store';
import { formatArea } from '@/shared/format';
import { pmtilesFileUri } from '@/shared/pmtiles-uri';
import { CellSheet } from '@/ui/components/map/cell-sheet';
import { FallbackMap } from '@/ui/components/map/fallback-map';
import { MapErrorBoundary } from '@/ui/components/map/map-error-boundary';
import { MapLegend } from '@/ui/components/map/map-legend';
import { PlotMap } from '@/ui/components/map/plot-map';
import { PointList } from '@/ui/components/map/point-list';
import { PlotPicker } from '@/ui/components/plot-picker';
import { useApp } from '@/ui/providers/app-context';

/** Texto cuando la app no pudo completar los diagnósticos que faltaban. */
const AVISO_DIAGNOSTICOS =
  'No se pudieron completar todos los diagnósticos de este lote. El mapa abre con lo que sí se pudo leer.';

/** Texto cuando el paquete de teselas no abre y el mapa cae al croquis. */
const AVISO_TESELAS =
  'El mapa no pudo abrir el paquete de teselas. Se muestra el croquis con las celdas y los puntos medidos.';

/** Texto cuando el mapa incluido no se pudo preparar en el teléfono. */
const AVISO_MAPA_INCLUIDO =
  'No se pudo preparar el mapa incluido en este teléfono. El croquis y los datos del lote siguen disponibles.';

/**
 * Pantalla del lote: encabezado, mapa, resumen, leyenda, alertas y puntos.
 *
 * Antes de dibujar completa los diagnósticos que falten (lo sincronizado y lo
 * importado llegan sin él) y después arma el espacio. Si esa reparación falla,
 * el mapa abre igual y lo avisa: un lote sin diagnóstico sigue teniendo puntos
 * y celdas que mostrar.
 *
 * La pantalla no dictamina: los colores y los textos salen del dominio. El
 * encabezado dice «área medida», no «área del lote»: la malla cubre lo que se
 * midió, no el contorno del lote.
 */
export default function MapScreen() {
  const { stores, thresholds, baseMap } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ plotId?: string }>();
  const plotParam = typeof params.plotId === 'string' ? params.plotId : null;

  const [plots, setPlots] = useState<readonly Plot[]>([]);
  const [farmNames, setFarmNames] = useState<Record<string, string>>({});
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [space, setSpace] = useState<PlotSpace | null>(null);
  const [baseUri, setBaseUri] = useState<string | null>(null);
  const [detailUri, setDetailUri] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPlots, setLoadingPlots] = useState(true);
  const [loadingSpace, setLoadingSpace] = useState(false);

  const loadPlots = useCallback(async (): Promise<void> => {
    setLoadingPlots(true);

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
      setSelectedPlotId((actual) => {
        if (actual !== null && lotes.some((plot) => plot.id === actual)) {
          return actual;
        }

        if (plotParam !== null && lotes.some((plot) => plot.id === plotParam)) {
          return plotParam;
        }

        return lotes[0]?.id ?? null;
      });
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron leer los lotes');
    } finally {
      setLoadingPlots(false);
    }
  }, [plotParam, stores.farms]);

  useFocusEffect(
    useCallback(() => {
      void loadPlots();
    }, [loadPlots]),
  );

  useEffect(() => {
    if (selectedPlotId === null) {
      return;
    }

    let cancelled = false;
    const plotId = selectedPlotId;

    async function load(): Promise<void> {
      setLoadingSpace(true);
      setWarning(null);
      setSelectedCellId(null);
      setTilesFailed(false);
      setBaseUri(null);

      try {
        let aviso: string | null = null;

        try {
          const completados = await ensurePlotDiagnoses(plotId, {
            measurements: stores.measurements,
            diagnoses: stores.diagnoses,
            sessions: stores.sessions,
            farms: stores.farms,
            thresholds,
            clock: { now: () => new Date().toISOString() },
            newId: () =>
              `${plotId}:diagnostico:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
          });

          if (completados.failed > 0) {
            aviso = AVISO_DIAGNOSTICOS;
          }
        } catch {
          aviso = AVISO_DIAGNOSTICOS;
        }

        const descrito = await describePlotSpace(plotId, {
          farms: stores.farms,
          measurements: stores.measurements,
          diagnoses: stores.diagnoses,
        });
        const paquete = await paqueteActivo();
        const base = await prepararBaseMapa();

        if (!cancelled) {
          setSpace(descrito);
          setBaseUri(base);
          setDetailUri(paquete === null ? null : pmtilesFileUri(paquete.path));
          setWarning(aviso ?? (base === null ? AVISO_MAPA_INCLUIDO : null));
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'No se pudo preparar el mapa del lote',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingSpace(false);
        }
      }
    }

    async function paqueteActivo(): Promise<MapPackage | null> {
      const id = await getActiveMapPackage({
        packages: stores.mapPackages,
        settings: stores.settings,
      });

      return id === null ? null : stores.mapPackages.get(id);
    }

    /**
     * El mapa incluido es opcional: si no se puede preparar, el lote abre con
     * el croquis. Nunca se deja el área en blanco (diseño §11.4).
     */
    async function prepararBaseMapa(): Promise<string | null> {
      try {
        return await prepareBaseMap(baseMap);
      } catch {
        return null;
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [selectedPlotId, stores, thresholds, baseMap]);

  const clases = useMemo<readonly AptitudeClass[]>(() => {
    if (space === null) {
      return [];
    }

    const presentes = new Set<AptitudeClass>();

    for (const celda of space.cells) {
      for (const clase of celda.verdict.classes) {
        presentes.add(clase);
      }
    }

    return [...presentes];
  }, [space]);

  const hayDosClases =
    space !== null && space.cells.some((celda) => celda.verdict.classes.length > 1);
  const plot = plots.find((item) => item.id === selectedPlotId) ?? null;

  function abrirDiagnostico(measurementId: string): void {
    router.push({ pathname: '/diagnosis', params: { measurementId } });
  }

  function abrirLote(): void {
    if (selectedPlotId !== null) {
      router.push({ pathname: '/plot-form', params: { id: selectedPlotId } });
    }
  }

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

  if (loadingPlots) {
    return <Text style={styles.note}>Cargando lotes…</Text>;
  }

  if (plots.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Todavía no hay lotes registrados.</Text>
        <Text style={styles.emptyDetail}>
          Crea una finca y su primer lote para ver acá la malla de lo medido.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ir a fincas y lotes"
          onPress={() => router.push('/farms')}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Ir a fincas y lotes</Text>
        </Pressable>
      </View>
    );
  }

  const cultivo = plot === null ? null : etiquetaCultivo(plot.cropPrimary);
  const unidad = plot === null ? null : etiquetaUnidad(plot.cartographicUnit);
  const faltaContexto = plot !== null && (cultivo === null || unidad === null);
  const areaMedida =
    space === null || space.grid === null
      ? 'sin dato'
      : formatArea(space.grid.cellAreaHa * space.cells.length);
  // Cuando el área medida no cabe en 400 celdas de 0,4 ha, la malla sube el
  // tamaño de celda: se dice, para que nadie lea la malla como si fuera la
  // original (diseño §7.2).
  const notaMalla =
    space !== null && space.grid !== null && space.grid.adjusted
      ? `Malla ajustada a celdas de ${formatArea(space.grid.cellAreaHa)} para no pasar de ${MAX_CELLS} celdas.`
      : null;
  // El paquete base se abre como archivo real; el detallado se importa aparte
  // y también se abre desde el almacenamiento de la app.
  const sinTeselas = !loadingSpace && baseUri === null && detailUri === null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PlotPicker
        plots={plots}
        selectedPlotId={selectedPlotId}
        farmNames={farmNames}
        onSelect={(elegido) => setSelectedPlotId(elegido.id)}
      />

      {plot === null ? null : (
        <View style={styles.header}>
          <Text style={styles.plotName}>{plot.name}</Text>
          <Text style={styles.headerLine}>Cultivo: {cultivo ?? 'sin dato'}</Text>
          <Text style={styles.headerLine}>Unidad cartográfica: {unidad ?? 'sin dato'}</Text>
          <Text style={styles.headerLine}>Área medida: {areaMedida}</Text>
          {notaMalla === null ? null : <Text style={styles.headerNote}>{notaMalla}</Text>}

          {faltaContexto ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Completar los datos del lote"
              onPress={abrirLote}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>Completar lote</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      {warning !== null ? <Text style={styles.warning}>{warning}</Text> : null}

      {space === null ? (
        <Text style={styles.note}>
          {loadingSpace ? 'Preparando el mapa del lote…' : 'El lote todavía no tiene mediciones.'}
        </Text>
      ) : (
        <>
          <View style={styles.mapBlock}>
            {detailUri === null ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  Mapa con el paquete incluido: no hay un paquete detallado activo.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver paquetes de mapa"
                  onPress={() => router.push('/map-packages')}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>Ver paquetes de mapa</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.mapFrame}>
              {tilesFailed || sinTeselas ? (
                <FallbackMap
                  space={space}
                  onSelectCell={setSelectedCellId}
                  onSelectPoint={abrirDiagnostico}
                />
              ) : (
                <MapErrorBoundary
                  fallback={
                    <FallbackMap
                      space={space}
                      onSelectCell={setSelectedCellId}
                      onSelectPoint={abrirDiagnostico}
                    />
                  }
                >
                  <PlotMap
                    key={mapKey}
                    space={space}
                    baseUri={baseUri}
                    detailUri={detailUri}
                    onSelectCell={setSelectedCellId}
                    onSelectPoint={abrirDiagnostico}
                    onTilesFailed={() => setTilesFailed(true)}
                  />
                </MapErrorBoundary>
              )}
            </View>

            {tilesFailed ? <Text style={styles.warning}>{AVISO_TESELAS}</Text> : null}

            <View style={styles.mapFooter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Encuadrar el mapa en los puntos medidos"
                onPress={() => setMapKey((valor) => valor + 1)}
                style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomPressed]}
              >
                <Text style={styles.zoomText}>Encuadrar</Text>
              </Pressable>
              <Text style={styles.attribution}>Teselas © OpenStreetMap · Protomaps</Text>
            </View>
          </View>

          <Text style={styles.summary}>{resumenDeConteos(space)}</Text>

          {loadingSpace ? <Text style={styles.note}>Actualizando el mapa…</Text> : null}

          <MapLegend classes={clases} showTwoTone={hayDosClases} />

          {selectedCellId === null ? null : (
            <CellSheet
              space={space}
              cellId={selectedCellId}
              onClose={() => setSelectedCellId(null)}
              onSelectMeasurement={abrirDiagnostico}
            />
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alertas del motor</Text>

            {space.alerts.length === 0 ? (
              <Text style={styles.sectionEmpty}>Ningún punto tiene alertas del motor.</Text>
            ) : (
              space.alerts.map((alerta) => (
                <AlertRow
                  key={`${alerta.code}|${alerta.severity}`}
                  count={alerta.count}
                  message={alerta.message}
                  measurementId={alerta.firstMeasurementId}
                  onOpen={abrirDiagnostico}
                />
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Avisos de calidad del registro</Text>

            {space.recordAlerts.length === 0 ? (
              <Text style={styles.sectionEmpty}>No hay avisos de registro.</Text>
            ) : (
              space.recordAlerts.map((aviso) => (
                <AlertRow
                  key={aviso.code}
                  count={aviso.count}
                  message={aviso.message}
                  measurementId={aviso.firstMeasurementId}
                  onOpen={abrirDiagnostico}
                />
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Puntos documentados</Text>
            <PointList space={space} onSelectMeasurement={abrirDiagnostico} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function AlertRow({
  count,
  message,
  measurementId,
  onOpen,
}: {
  count: number;
  message: string;
  measurementId: string | null;
  onOpen: (measurementId: string) => void;
}) {
  const abrir = measurementId === null ? undefined : () => onOpen(measurementId);

  return (
    <Pressable
      accessibilityRole={abrir === undefined ? undefined : 'button'}
      accessibilityLabel={message}
      disabled={abrir === undefined}
      onPress={abrir}
      style={({ pressed }) => [styles.alertRow, pressed && styles.alertPressed]}
    >
      <Text style={styles.alertCount}>{count}</Text>
      <Text style={styles.alertMessage}>{message}</Text>
    </Pressable>
  );
}

/** Conteo de la pantalla: celdas, puntos y puntos sin posición. No es un veredicto. */
function resumenDeConteos(space: PlotSpace): string {
  const { counts } = space;
  const celdas = counts.cells === 1 ? '1 celda' : `${counts.cells} celdas`;
  const puntos = counts.points === 1 ? '1 punto' : `${counts.points} puntos`;

  return `${celdas}: ${counts.cellsWithData} con dato, ${counts.cellsWithoutData} sin dato, ${counts.cellsInconclusive} no concluyente · ${puntos} · ${counts.withoutPosition} sin posición`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 2,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1D6C7',
  },
  plotName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#015439',
  },
  headerLine: {
    fontSize: 14,
    color: '#2D3733',
  },
  headerNote: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4E5D59',
  },
  mapBlock: {
    gap: 8,
  },
  mapFrame: {
    minHeight: 260,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E9DFD2',
  },
  notice: {
    gap: 2,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#E1D6C7',
  },
  noticeText: {
    fontSize: 14,
    color: '#2D3733',
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  zoomButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#015439',
    backgroundColor: '#FFFFFF',
  },
  zoomPressed: {
    backgroundColor: '#E2F0E3',
  },
  zoomText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#015439',
  },
  attribution: {
    flexShrink: 1,
    fontSize: 12,
    color: '#4E5D59',
    textAlign: 'right',
  },
  summary: {
    fontSize: 15,
    color: '#2D3733',
  },
  section: {
    gap: 6,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#015439',
  },
  sectionEmpty: {
    fontSize: 14,
    color: '#4E5D59',
  },
  alertRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1D6C7',
  },
  alertPressed: {
    backgroundColor: '#E2F0E3',
  },
  alertCount: {
    minWidth: 20,
    fontSize: 14,
    fontWeight: '700',
    color: '#015439',
  },
  alertMessage: {
    flexShrink: 1,
    fontSize: 14,
    color: '#2D3733',
  },
  note: {
    padding: 16,
    fontSize: 14,
    color: '#4E5D59',
  },
  warning: {
    padding: 12,
    fontSize: 14,
    color: '#8D321D',
    backgroundColor: '#FBEDE0',
    borderRadius: 10,
  },
  error: {
    fontSize: 15,
    color: '#8D321D',
  },
  linkButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#015439',
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
    color: '#015439',
    textAlign: 'center',
  },
  emptyDetail: {
    fontSize: 15,
    color: '#4E5D59',
    textAlign: 'center',
  },
});
