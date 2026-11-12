import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { savePlot } from '@/application/farm/save-plot';
import type { Drainage } from '@/domain/farm/types';
import { MAX_NAME_LENGTH } from '@/domain/farm/validation';
import type { SettingsStore } from '@/ports/stores/settings-store';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useApp } from '@/ui/providers/app-context';

/** Clave de ajustes donde vive el contador de lotes. */
const CONTADOR_LOTES = 'next_plot_id';

/** Profundidad de muestreo que se ofrece por defecto, en centímetros. */
const PROFUNDIDAD_POR_DEFECTO = '20';

interface Opcion<T extends string | null> {
  valor: T;
  etiqueta: string;
}

interface GrupoOpcionesProps<T extends string | null> {
  label: string;
  opciones: readonly Opcion<T>[];
  valor: T;
  onChange: (valor: T) => void;
  textoSinElegir: string;
}

/**
 * Identificador legible de lote: `lote-1`, `lote-2`, …
 *
 * El contador vive en los ajustes para que el identificador no se repita
 * aunque la app se reinicie.
 */
async function nextPlotId(settings: SettingsStore): Promise<string> {
  const guardado = await settings.get(CONTADOR_LOTES);
  const leido = guardado === null ? Number.NaN : Number.parseInt(guardado, 10);
  const siguiente = Number.isInteger(leido) && leido >= 1 ? leido : 1;

  await settings.set(CONTADOR_LOTES, String(siguiente + 1));

  return `lote-${siguiente}`;
}

/** Convierte el texto de un campo numérico; `null` cuando está vacío. */
function textoANumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');

  if (limpio.length === 0) {
    return null;
  }

  return Number(limpio);
}

/** Grupo de opciones excluyentes. La elección se dice con palabras, no solo con color. */
function GrupoOpciones<T extends string | null>({
  label,
  opciones,
  valor,
  onChange,
  textoSinElegir,
}: GrupoOpcionesProps<T>) {
  const elegida = opciones.find((opcion) => opcion.valor === valor);

  return (
    <View style={styles.grupo}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.opciones}>
        {opciones.map((opcion) => {
          const activa = opcion.valor === valor;

          return (
            <Pressable
              key={opcion.valor ?? 'sin-valor'}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              onPress={() => onChange(opcion.valor)}
              style={({ pressed }) => [
                styles.opcion,
                activa && styles.opcionActiva,
                pressed && styles.presionado,
              ]}
            >
              <Text style={[styles.opcionTexto, activa && styles.opcionTextoActiva]}>
                {opcion.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.elegido}>
        {elegida === undefined ? textoSinElegir : `Elegido: ${elegida.etiqueta}`}
      </Text>
    </View>
  );
}

export default function PlotFormScreen() {
  const { stores, thresholds } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; farmId?: string }>();
  const plotId = params.id;
  const farmIdParam = params.farmId;

  const [name, setName] = useState('');
  const [cropPrimary, setCropPrimary] = useState<string | null>(null);
  const [cropSecondary, setCropSecondary] = useState<string | null>(null);
  const [depthCm, setDepthCm] = useState(PROFUNDIDAD_POR_DEFECTO);
  const [cartographicUnit, setCartographicUnit] = useState<string | null>(null);
  const [lastFertilizationDate, setLastFertilizationDate] = useState('');
  const [drainage, setDrainage] = useState<Drainage | null>(null);
  const [plantingDensityHa, setPlantingDensityHa] = useState('');
  const [altitudeM, setAltitudeM] = useState('');
  const [notes, setNotes] = useState('');

  const [farmId, setFarmId] = useState<string | null>(farmIdParam ?? null);
  const [farmName, setFarmName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opcionesCultivo = useMemo<Opcion<string>[]>(
    () =>
      Object.entries(thresholds.crops).map(([clave, cultivo]) => ({
        valor: clave,
        etiqueta: cultivo.label,
      })),
    [thresholds],
  );

  const opcionesUnidad = useMemo<Opcion<string>[]>(
    () =>
      Object.entries(thresholds.cartographicUnits).map(([clave, unidad]) => ({
        valor: clave,
        etiqueta: unidad.label,
      })),
    [thresholds],
  );

  const opcionesCultivoSecundario = useMemo<Opcion<string | null>[]>(
    () => [{ valor: null, etiqueta: 'Ninguno' }, ...opcionesCultivo],
    [opcionesCultivo],
  );

  const opcionesDrenaje = useMemo<Opcion<Drainage>[]>(
    () => [
      { valor: 'bien_drenado', etiqueta: 'Bien drenado' },
      { valor: 'moderado', etiqueta: 'Moderado' },
      { valor: 'deficiente', etiqueta: 'Deficiente' },
      { valor: 'encharcado', etiqueta: 'Encharcado' },
    ],
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadFarmName(id: string): Promise<void> {
      const farm = await stores.farms.getFarm(id);

      if (!cancelled) {
        setFarmName(farm?.name ?? null);
      }
    }

    async function load(): Promise<void> {
      try {
        if (plotId !== undefined) {
          const plot = await stores.farms.getPlot(plotId);

          if (cancelled) {
            return;
          }

          if (plot === null) {
            setError('El lote que se quiere editar no existe.');
            return;
          }

          setName(plot.name);
          setCropPrimary(plot.cropPrimary);
          setCropSecondary(plot.cropSecondary);
          setDepthCm(plot.depthCm === null ? '' : String(plot.depthCm));
          setCartographicUnit(plot.cartographicUnit);
          setLastFertilizationDate(plot.lastFertilizationDate ?? '');
          setDrainage(plot.drainage);
          setPlantingDensityHa(
            plot.plantingDensityHa === null ? '' : String(plot.plantingDensityHa),
          );
          setAltitudeM(plot.altitudeM === null ? '' : String(plot.altitudeM));
          setNotes(plot.notes ?? '');
          setFarmId(plot.farmId);

          await loadFarmName(plot.farmId);
          return;
        }

        if (farmIdParam !== undefined) {
          setFarmId(farmIdParam);
          await loadFarmName(farmIdParam);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudo leer el lote');
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
  }, [farmIdParam, plotId, stores]);

  async function handleSave(): Promise<void> {
    setError(null);

    if (farmId === null) {
      setError('No se sabe a qué finca pertenece el lote.');
      return;
    }

    const profundidad = textoANumero(depthCm);

    if (profundidad !== null && !Number.isFinite(profundidad)) {
      setError('La profundidad debe ser un número de centímetros.');
      return;
    }

    const altitud = textoANumero(altitudeM);

    if (altitud !== null && !Number.isFinite(altitud)) {
      setError('La altitud debe ser un número de metros.');
      return;
    }

    const densidad = textoANumero(plantingDensityHa);

    if (densidad !== null && !Number.isFinite(densidad)) {
      setError('La densidad de siembra debe ser un número de plantas por hectárea.');
      return;
    }

    setBusy(true);

    try {
      const id = plotId === undefined ? await nextPlotId(stores.settings) : plotId;

      await savePlot(
        {
          ...(plotId === undefined ? {} : { id: plotId }),
          farmId,
          name,
          cropPrimary,
          cropSecondary,
          depthCm: profundidad,
          cartographicUnit,
          lastFertilizationDate:
            lastFertilizationDate.trim() === '' ? null : lastFertilizationDate.trim(),
          drainage,
          plantingDensityHa: densidad,
          altitudeM: altitud,
          notes: notes.trim() === '' ? null : notes.trim(),
        },
        {
          farms: stores.farms,
          clock: { now: () => new Date().toISOString() },
          newId: () => id,
        },
      );

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/farms');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el lote');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{plotId === undefined ? 'Nuevo lote' : 'Editar lote'}</Text>
      <Text style={styles.subtitle}>
        {farmName === null ? 'Lote de la finca' : `Lote de la finca ${farmName}`}
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Nombre del lote</Text>
        <TextInput
          accessibilityLabel="Nombre del lote"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Lote 1"
          maxLength={MAX_NAME_LENGTH}
          editable={!loading}
        />
        <Text style={styles.help}>Obligatorio. Máximo {MAX_NAME_LENGTH} caracteres.</Text>
      </View>

      <View style={styles.form}>
        <GrupoOpciones
          label="Cultivo principal"
          opciones={opcionesCultivo}
          valor={cropPrimary}
          onChange={setCropPrimary}
          textoSinElegir="Sin cultivo principal elegido"
        />

        <GrupoOpciones
          label="Cultivo asociado"
          opciones={opcionesCultivoSecundario}
          valor={cropSecondary}
          onChange={setCropSecondary}
          textoSinElegir="Sin cultivo asociado"
        />

        <GrupoOpciones
          label="Unidad cartográfica"
          opciones={opcionesUnidad}
          valor={cartographicUnit}
          onChange={setCartographicUnit}
          textoSinElegir="Sin unidad cartográfica"
        />

        <GrupoOpciones
          label="Drenaje"
          opciones={opcionesDrenaje}
          valor={drainage}
          onChange={setDrainage}
          textoSinElegir="Drenaje sin informar"
        />
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Profundidad de muestreo (cm)</Text>
        <TextInput
          accessibilityLabel="Profundidad de muestreo en centímetros"
          style={styles.input}
          value={depthCm}
          onChangeText={setDepthCm}
          keyboardType="numeric"
          placeholder="20"
          editable={!loading}
        />

        <Text style={styles.label}>Fecha de última fertilización</Text>
        <TextInput
          accessibilityLabel="Fecha de última fertilización"
          style={styles.input}
          value={lastFertilizationDate}
          onChangeText={setLastFertilizationDate}
          placeholder="AAAA-MM-DD"
          autoCapitalize="none"
          editable={!loading}
        />
        <Text style={styles.help}>Opcional. Formato AAAA-MM-DD.</Text>

        <Text style={styles.label}>Densidad de siembra (plantas por hectárea)</Text>
        <TextInput
          accessibilityLabel="Densidad de siembra en plantas por hectárea"
          style={styles.input}
          value={plantingDensityHa}
          onChangeText={setPlantingDensityHa}
          keyboardType="numeric"
          placeholder="1500"
          editable={!loading}
        />
        <Text style={styles.help}>Opcional.</Text>

        <Text style={styles.label}>Altitud (m)</Text>
        <TextInput
          accessibilityLabel="Altitud en metros"
          style={styles.input}
          value={altitudeM}
          onChangeText={setAltitudeM}
          keyboardType="numeric"
          placeholder="1550"
          editable={!loading}
        />
        <Text style={styles.help}>Opcional.</Text>

        <Text style={styles.label}>Notas</Text>
        <TextInput
          accessibilityLabel="Notas del lote"
          style={[styles.input, styles.inputNotas]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Observaciones del lote"
          multiline
          editable={!loading}
        />
        <Text style={styles.help}>Opcional.</Text>
      </View>

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton
          label={plotId === undefined ? 'Crear lote' : 'Guardar cambios'}
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
  grupo: {
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5A5A5A',
  },
  opciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  opcion: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    backgroundColor: '#FFFFFF',
  },
  opcionActiva: {
    borderWidth: 2,
    borderColor: '#1B4332',
    backgroundColor: '#EEF3EC',
  },
  presionado: {
    opacity: 0.85,
  },
  opcionTexto: {
    fontSize: 15,
    color: '#1F1F1F',
  },
  opcionTextoActiva: {
    fontWeight: '700',
    color: '#1B4332',
  },
  elegido: {
    fontSize: 13,
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
  inputNotas: {
    minHeight: 96,
    textAlignVertical: 'top',
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
