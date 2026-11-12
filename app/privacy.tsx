import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PRIVACY_NOTICE_KEY } from '@/application/settings/get-settings';
import { useApp } from '@/ui/providers/app-context';

/**
 * Aviso de privacidad (Ley 1581 de 2012, Colombia).
 *
 * Al abrirla, la app deja constancia de que la persona lo vio, en el almacén de ajustes.
 */
export default function PrivacyScreen() {
  const { stores } = useApp();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function acknowledge(): Promise<void> {
      try {
        await stores.settings.set(PRIVACY_NOTICE_KEY, '1');
      } catch (saveError) {
        if (!cancelled) {
          setError(
            saveError instanceof Error
              ? saveError.message
              : 'No se pudo guardar la lectura del aviso',
          );
        }
      }
    }

    void acknowledge();

    return () => {
      cancelled = true;
    };
  }, [stores]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Aviso de privacidad</Text>
      <Text style={styles.intro}>
        Esta app guarda información en su teléfono. Este aviso explica qué guarda, dónde queda y qué
        puede hacer con ella, según la Ley 1581 de 2012 de Colombia.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Qué guarda la app</Text>
        <Text style={styles.paragraph}>
          La app guarda las capturas que llegan del bastón, las mediciones derivadas de cada
          captura, los diagnósticos de aptitud del suelo, y las fincas y los lotes que usted
          registra con su nombre, su cultivo, su unidad cartográfica y sus notas.
        </Text>
        <Text style={styles.paragraph}>
          No guarda datos de su cuenta bancaria, ni su cédula, ni su dirección, ni contactos: no hay
          cuentas de usuario en esta app.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Dónde queda la información</Text>
        <Text style={styles.paragraph}>
          Toda la información queda solo en este teléfono, en la base de datos local de la app. No
          hay servidor, no hay nube y la app no necesita internet para funcionar.
        </Text>
        <Text style={styles.paragraph}>
          Si borra los datos de la app, si la desinstala o si pierde o cambia el teléfono, sus datos
          se pierden con ella: no hay copia guardada en ningún otro lugar.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Nada sale sin su acción</Text>
        <Text style={styles.paragraph}>
          La app nunca envía su información a nadie por su cuenta. Lo único que sale del teléfono es
          el archivo CSV que usted genera y comparte, cuando usted decide exportarlo y compartirlo
          desde el historial.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Puede borrar sus datos</Text>
        <Text style={styles.paragraph}>
          Usted puede borrar sus datos cuando quiera: le basta con borrar los datos de la app desde
          los ajustes de su teléfono o con desinstalarla. En una versión posterior habrá también un
          botón dentro de la app para borrar todo lo guardado.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contacto para consultas</Text>
        <Text style={styles.paragraph}>
          El responsable del tratamiento de los datos es el equipo del proyecto «Dispositivo de
          monitoreo del suelo». Para cualquier consulta sobre este aviso o sobre los datos que la
          app guarda, escríbanos al correo de contacto del proyecto: se agrega antes de publicar la
          aplicación.
        </Text>
      </View>

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
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
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B4332',
  },
  intro: {
    fontSize: 16,
    lineHeight: 22,
    color: '#3F3F3F',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5A5A5A',
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F1F1F',
  },
  error: {
    fontSize: 15,
    color: '#8A3B12',
  },
});
