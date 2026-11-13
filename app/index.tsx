import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { APP_NAME } from '@/shared/app-info';
import { PrimaryButton } from '@/ui/components/primary-button';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.subtitle}>
        Registra el suelo, guarda cada captura y consúltala sin internet.
      </Text>

      <View style={styles.actions}>
        <PrimaryButton label="Conectar bastón" onPress={() => router.push('/connect')} />
        <PrimaryButton label="Medir" variant="secondary" onPress={() => router.push('/measure')} />
        <PrimaryButton
          label="Historial"
          variant="secondary"
          onPress={() => router.push('/history')}
        />
        <PrimaryButton
          label="Sincronizar microSD"
          variant="secondary"
          onPress={() => router.push('/sync')}
        />
      </View>

      <Text style={styles.note}>
        Corte 2: la app habla BLE por el protocolo del bastón y sincroniza su microSD.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1B4332',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#3F3F3F',
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  note: {
    marginTop: 'auto',
    marginBottom: 24,
    fontSize: 13,
    color: '#5A5A5A',
  },
});
