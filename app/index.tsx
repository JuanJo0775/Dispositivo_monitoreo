import { StyleSheet, Text, View } from 'react-native';

import { APP_NAME } from '@/shared/app-info';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.subtitle}>
        Esqueleto de la aplicación. El bastón simulado y el historial llegan en las siguientes
        tareas del corte 0.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B4332',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#3F3F3F',
    textAlign: 'center',
  },
});
