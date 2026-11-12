import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useStickStatus } from '@/ui/hooks/use-stick-status';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useApp } from '@/ui/providers/app-context';

export default function ConnectScreen() {
  const { gateway } = useApp();
  const status = useStickStatus(gateway);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await gateway.connect('simulated-stick');
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'No se pudo conectar');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await gateway.disconnect();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Estado</Text>
        <Text style={styles.status}>{status.connected ? 'Conectado' : 'Desconectado'}</Text>
        <Text style={styles.detail}>Bastón: {status.deviceId ?? 'sin vincular'}</Text>
        <Text style={styles.detail}>Firmware: {status.firmwareVersion ?? 'sin dato'}</Text>
        <Text style={styles.detail}>Protocolo: {status.protocolVersion ?? 'sin dato'}</Text>
        <Text style={styles.detail}>
          Batería: {status.batteryPct === null ? 'sin dato' : `${status.batteryPct} %`}
        </Text>
      </View>

      <View style={styles.actions}>
        {status.connected ? (
          <PrimaryButton
            label="Desconectar"
            variant="secondary"
            disabled={busy}
            onPress={handleDisconnect}
          />
        ) : (
          <PrimaryButton label="Conectar bastón" disabled={busy} onPress={handleConnect} />
        )}
      </View>

      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.note}>
        En este corte el bastón es simulado. El BLE real llega en el corte 2.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#5A5A5A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  status: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B4332',
  },
  detail: {
    fontSize: 15,
    color: '#2F2F2F',
  },
  actions: {
    gap: 12,
  },
  error: {
    fontSize: 15,
    color: '#8A3B12',
  },
  note: {
    fontSize: 14,
    color: '#4A4A4A',
    lineHeight: 20,
  },
});
