import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { StickGatewayState } from '@/ports/stick-gateway';
import { PrimaryButton } from '@/ui/components/primary-button';
import { useStickStatus } from '@/ui/hooks/use-stick-status';
import { useApp } from '@/ui/providers/app-context';

/** Texto legible de cada estado del gateway, sin depender del color. */
const ESTADO: Record<StickGatewayState, string> = {
  idle: 'Sin iniciar',
  scanning: 'Buscando el bastón por Bluetooth…',
  connecting: 'Conectando con el bastón…',
  discovering: 'Descubriendo los servicios del bastón…',
  ready: 'Listo para medir',
  configuring: 'Escribiendo la configuración en el bastón…',
  capturing: 'Capturando…',
  syncing: 'Sincronizando la microSD…',
  reconnecting: 'Se cayó el enlace: reconectando…',
  error: 'Error de conexión',
};

export default function ConnectScreen() {
  const router = useRouter();
  const { gateway, deviceId } = useApp();
  const status = useStickStatus(gateway);
  const [pin, setPin] = useState('000000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const estado = status.state ?? (status.connected ? 'ready' : 'idle');

  async function handleConnect(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      gateway.pair(pin);
      await gateway.connect(deviceId);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'No se pudo conectar');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await gateway.disconnect();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error ? disconnectError.message : 'No se pudo desconectar',
      );
    } finally {
      setBusy(false);
    }
  }

  function handlePair(): void {
    setError(null);
    setMessage(null);

    try {
      gateway.pair(pin);
      setMessage('PIN aceptado. La app ya puede escribir la configuración cifrada.');
    } catch (pairError) {
      setError(pairError instanceof Error ? pairError.message : 'No se pudo emparejar');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Estado</Text>
        <Text style={styles.status}>{ESTADO[estado]}</Text>
        <Text style={styles.detail}>Bastón: {status.deviceId ?? 'sin vincular'}</Text>
        <Text style={styles.detail}>Firmware: {status.firmwareVersion ?? 'sin dato'}</Text>
        <Text style={styles.detail}>Protocolo: {status.protocolVersion ?? 'sin dato'}</Text>
        <Text style={styles.detail}>
          Batería: {status.batteryPct === null ? 'sin dato' : `${status.batteryPct} %`}
        </Text>
        <Text style={styles.detail}>
          microSD:{' '}
          {status.microSdOk === undefined
            ? 'sin dato'
            : status.microSdOk
              ? 'responde y tiene espacio'
              : 'no responde o está llena'}
        </Text>
        <Text style={styles.detail}>
          Registros guardados en la microSD:{' '}
          {status.recordCount === null || status.recordCount === undefined
            ? 'sin dato'
            : String(status.recordCount)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Emparejamiento</Text>
        <Text style={styles.help}>
          El PIN de seis dígitos cifra la configuración y el resumen que se escriben al bastón.
        </Text>
        <TextInput
          accessibilityLabel="PIN de emparejamiento"
          style={styles.input}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          editable={!busy}
        />
        <PrimaryButton label="Emparejar" variant="secondary" disabled={busy} onPress={handlePair} />
      </View>

      <View style={styles.actions}>
        {status.connected ? (
          <PrimaryButton
            label="Desconectar"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              void handleDisconnect();
            }}
          />
        ) : (
          <PrimaryButton
            label="Conectar bastón"
            disabled={busy}
            onPress={() => {
              void handleConnect();
            }}
          />
        )}
        <PrimaryButton
          label="Configurar sesión"
          variant="secondary"
          onPress={() => router.push('/session')}
        />
        <PrimaryButton
          label="Sincronizar microSD"
          variant="secondary"
          onPress={() => router.push('/sync')}
        />
      </View>

      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.note}>
        El bastón todavía es simulado, pero la app le habla por el mismo transporte BLE y el mismo
        protocolo que usará con el prototipo: el día que exista, solo cambia el transporte.
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
  help: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4A4A4A',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    letterSpacing: 4,
    color: '#1F1F1F',
    backgroundColor: '#FFFFFF',
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
    color: '#4A4A4A',
    lineHeight: 20,
  },
});
