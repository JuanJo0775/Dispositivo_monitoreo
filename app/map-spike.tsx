import { Component, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';

/**
 * Pincho temporal del corte 3: comprueba si MapLibre abre un archivo `.pmtiles`
 * que ya está en el teléfono, sin internet.
 *
 * La pantalla muestra dos mapas, uno encima del otro:
 *
 * - A: el archivo empaquetado en el APK, con la URI `pmtiles://asset://<archivo>`.
 * - B: el mismo archivo copiado al almacenamiento privado de la app, con la URI
 *   `pmtiles://file://<ruta absoluta>`.
 *
 * La tarea 15 del corte 3 borra esta pantalla y la reemplaza por el mapa real.
 */

const NOMBRE_ARCHIVO = 'prueba.pmtiles';
const URL_DESDE_ASSETS = `pmtiles://asset://${NOMBRE_ARCHIVO}`;

/** Centro de los Alpes centrales, que es lo que cubre el archivo de prueba. */
const CENTRO: [number, number] = [12, 47.5];
const ZOOM = 8;

type ModuloMapLibre = typeof import('@maplibre/maplibre-react-native');

/**
 * Estilo mínimo con una sola fuente ráster que apunta al archivo `.pmtiles`.
 *
 * El archivo de prueba es ráster (PNG), así que no sirven las capas vectoriales
 * de Protomaps: se usa un estilo raster plano, sin glifos ni sprites.
 */
function estiloRaster(url: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      imagery: {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
      },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': '#101418' } },
      { id: 'imagery', type: 'raster', source: 'imagery' },
    ],
  };
}

/**
 * Copia el archivo empaquetado al almacenamiento privado de la app y devuelve
 * la URI que usa MapLibre para leerlo, con el tamaño del archivo copiado.
 */
async function copiarAlAlmacenamiento(): Promise<{ url: string; bytes: number }> {
  const origen = new File(Paths.bundle, NOMBRE_ARCHIVO);
  const destino = new File(Paths.document, NOMBRE_ARCHIVO);

  await origen.copy(destino, { overwrite: true });

  return { url: `pmtiles://${destino.uri}`, bytes: destino.size };
}

function describirError(error: unknown): string {
  return error instanceof Error ? error.message : 'Error desconocido';
}

/**
 * Impide que un fallo del módulo nativo de MapLibre tumbe la pantalla: los
 * rótulos y las URI se pueden leer igual.
 */
class FronteraDeError extends Component<{ children: ReactNode }, { fallo: string | null }> {
  override state: { fallo: string | null } = { fallo: null };

  static getDerivedStateFromError(error: unknown): { fallo: string } {
    return { fallo: describirError(error) };
  }

  override render(): ReactNode {
    if (this.state.fallo !== null) {
      return <Text style={styles.error}>El mapa no pudo dibujarse: {this.state.fallo}</Text>;
    }

    return this.props.children;
  }
}

function MapaDePrueba({ modulo, url }: { modulo: ModuloMapLibre; url: string }) {
  const [falloEstilo, setFalloEstilo] = useState<string | null>(null);
  const { Camera, Map } = modulo;

  return (
    <View>
      <FronteraDeError>
        <Map
          mapStyle={estiloRaster(url)}
          style={styles.mapa}
          androidView="texture"
          logo={false}
          attribution={false}
          onDidFailLoadingMap={() => setFalloEstilo('El estilo no se pudo cargar con esta URI.')}
        >
          <Camera initialViewState={{ center: CENTRO, zoom: ZOOM }} />
        </Map>
      </FronteraDeError>
      {falloEstilo !== null ? <Text style={styles.error}>{falloEstilo}</Text> : null}
    </View>
  );
}

export default function MapSpikeScreen() {
  const [modulo, setModulo] = useState<ModuloMapLibre | null>(null);
  const [errorModulo, setErrorModulo] = useState<string | null>(null);
  const [copia, setCopia] = useState<{ url: string; bytes: number } | null>(null);
  const [errorCopia, setErrorCopia] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;

    void import('@maplibre/maplibre-react-native')
      .then((cargado) => {
        if (vigente) {
          setModulo(cargado);
        }
      })
      .catch((error: unknown) => {
        if (vigente) {
          setErrorModulo(describirError(error));
        }
      });

    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;

    void copiarAlAlmacenamiento()
      .then((resultado) => {
        if (vigente) {
          setCopia(resultado);
        }
      })
      .catch((error: unknown) => {
        if (vigente) {
          setErrorCopia(describirError(error));
        }
      });

    return () => {
      vigente = false;
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pincho de mapa (temporal)</Text>
      <Text style={styles.subtitle}>
        Dos formas de abrir el mismo archivo `.pmtiles` que viene en la app. Si un mapa dibuja las
        imágenes de los Alpes centrales, el otro no.
      </Text>

      <View style={styles.bloque}>
        <Text style={styles.etiqueta}>A: desde los assets del APK</Text>
        {modulo === null ? (
          <Text style={styles.nota}>
            {errorModulo === null
              ? 'Cargando el módulo nativo de MapLibre…'
              : `El módulo nativo de MapLibre no cargó: ${errorModulo}`}
          </Text>
        ) : (
          <MapaDePrueba modulo={modulo} url={URL_DESDE_ASSETS} />
        )}
        <Text style={styles.nota}>URI que se usó:</Text>
        <Text style={styles.uri}>{URL_DESDE_ASSETS}</Text>
      </View>

      <View style={styles.bloque}>
        <Text style={styles.etiqueta}>B: desde el almacenamiento de la app</Text>
        {modulo === null ? (
          <Text style={styles.nota}>
            {errorModulo === null
              ? 'Cargando el módulo nativo de MapLibre…'
              : `El módulo nativo de MapLibre no cargó: ${errorModulo}`}
          </Text>
        ) : copia !== null ? (
          <MapaDePrueba modulo={modulo} url={copia.url} />
        ) : null}
        {errorCopia !== null ? (
          <Text style={styles.error}>No se pudo copiar: {errorCopia}</Text>
        ) : null}
        <Text style={styles.nota}>URI que se usó:</Text>
        <Text style={styles.uri}>{copia === null ? 'copiando el archivo…' : copia.url}</Text>
        {copia !== null ? (
          <Text style={styles.nota}>Copiado en el teléfono: {copia.bytes} bytes</Text>
        ) : null}
      </View>

      <Text style={styles.nota}>
        Esta pantalla es de prueba y se borra en la tarea 15 del corte 3. Si ves los Alpes centrales
        en alguno de los dos mapas, anota cuál de los dos los dibujó.
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
  bloque: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 12,
    gap: 8,
  },
  etiqueta: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4332',
  },
  uri: {
    fontSize: 13,
    color: '#2F2F2F',
    fontFamily: 'monospace',
  },
  mapa: {
    height: 240,
    width: '100%',
  },
  nota: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A4A4A',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8A3B12',
  },
});
