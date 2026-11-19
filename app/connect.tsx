import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ensureBlePermissions } from '@/infrastructure/ble/ensure-ble-permissions';
import type { StickCandidate, StickGatewayState } from '@/ports/stick-gateway';
import { PrimaryButton } from '@/ui/components/primary-button';
import { Badge } from '@/ui/components/ui/badge';
import { Card } from '@/ui/components/ui/card';
import { SectionHeader } from '@/ui/components/ui/section-header';
import { useStickStatus } from '@/ui/hooks/use-stick-status';
import { useApp } from '@/ui/providers/app-context';
import { useStickSettings } from '@/ui/providers/stick-settings';
import { colors, radius, spacing, typography } from '@/ui/theme';

/** Texto legible de cada estado del gateway, sin depender del color. */
const ESTADO: Record<StickGatewayState, string> = {
  idle: 'Sin iniciar',
  scanning: 'Buscando el bastón por Bluetooth.',
  connecting: 'Conectando con el bastón.',
  discovering: 'Descubriendo los servicios del bastón.',
  ready: 'Listo para medir',
  configuring: 'Escribiendo la configuración en el bastón.',
  capturing: 'Capturando.',
  syncing: 'Sincronizando la microSD.',
  reconnecting: 'Se cayó el enlace: reconectando.',
  error: 'Error de conexión',
};

/** Nombre para mostrar de un bastón encontrado. */
function nombreDe(candidate: StickCandidate): string {
  return candidate.name === null || candidate.name.trim() === ''
    ? candidate.deviceId
    : candidate.name;
}

/**
 * Conectar el bastón.
 *
 * Primero se busca y se muestra qué hay cerca: si el bastón no aparece, la
 * pantalla lo dice en vez de quedarse girando. Al tocar un aparato se conecta
 * con ese identificador, que es el único que el teléfono reconoce.
 */
export default function ConnectScreen() {
  const router = useRouter();
  const { gateway } = useApp();
  const { mode, setMode } = useStickSettings();
  const status = useStickStatus(gateway);
  const [pin, setPin] = useState('000000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<readonly StickCandidate[] | null>(null);

  const estado = status.state ?? (status.connected ? 'ready' : 'idle');
  const esSimulado = mode === 'simulated';

  async function handleScan(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (!esSimulado) {
        await ensureBlePermissions();
      }

      const found = await gateway.scan();
      setCandidates(found);
      setMessage(
        found.length === 0
          ? 'No apareció ningún bastón. Revisa que esté encendido y cerca del teléfono.'
          : `${found.length} ${found.length === 1 ? 'aparato encontrado' : 'aparatos encontrados'}.`,
      );
    } catch (scanError) {
      setCandidates(null);
      setError(scanError instanceof Error ? scanError.message : 'No se pudo buscar el bastón');
    } finally {
      setBusy(false);
    }
  }

  async function handleConnect(candidate: StickCandidate): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await gateway.connect(candidate.deviceId);
      setMessage(`Conectado con ${nombreDe(candidate)}.`);
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

  async function handleModeChange(next: 'real' | 'simulated'): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    setCandidates(null);

    try {
      await gateway.disconnect();
    } catch {
      // Cambiar de bastón no depende de que la desconexión salga bien.
    }

    setMode(next);
    setBusy(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionHeader
        title="Bastón"
        detail={
          esSimulado
            ? 'Modo de prueba: datos inventados, no sirven para un lote.'
            : 'Bluetooth del bastón, sin internet.'
        }
        trailing={
          <Badge
            label={status.connected ? 'Conectado' : 'Sin conectar'}
            tone={status.connected ? 'success' : 'neutral'}
          />
        }
      />

      <Card accent={status.connected ? 'accent' : 'terracotta'}>
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
      </Card>

      <View style={styles.block}>
        <PrimaryButton
          label={candidates === null ? 'Buscar bastones' : 'Buscar de nuevo'}
          disabled={busy}
          onPress={() => {
            void handleScan();
          }}
        />

        {candidates === null || candidates.length === 0 ? null : (
          <View style={styles.list}>
            {candidates.map((candidate) => (
              <Pressable
                key={candidate.deviceId}
                accessibilityRole="button"
                accessibilityLabel={`Conectar ${nombreDe(candidate)}`}
                disabled={busy}
                onPress={() => {
                  void handleConnect(candidate);
                }}
                style={({ pressed }) => [
                  styles.candidate,
                  pressed && !busy && styles.candidatePressed,
                  busy && styles.candidateDisabled,
                ]}
              >
                <View style={styles.candidateTexts}>
                  <Text style={styles.candidateName}>{nombreDe(candidate)}</Text>
                  <Text style={styles.candidateId}>
                    {candidate.deviceId} · señal {candidate.rssi} dBm
                  </Text>
                </View>
                <Badge
                  label={candidate.compatible ? 'Del contrato' : 'Otro aparato'}
                  tone={candidate.compatible ? 'success' : 'neutral'}
                />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {status.connected ? (
        <PrimaryButton
          label="Desconectar"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            void handleDisconnect();
          }}
        />
      ) : null}

      <Card muted>
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
      </Card>

      <View style={styles.block}>
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

      <View style={styles.modeBox}>
        <PrimaryButton
          label={esSimulado ? 'Volver al bastón real' : 'Usar bastón de prueba'}
          variant="ghost"
          disabled={busy}
          onPress={() => {
            void handleModeChange(esSimulado ? 'real' : 'simulated');
          }}
        />
        <Text style={styles.note}>
          {esSimulado
            ? 'El bastón de prueba responde siempre y no necesita Bluetooth. Todo lo que captures queda marcado como simulado.'
            : 'Si todavía no tienes el bastón a mano, puedes recorrer la app con el bastón de prueba; sus capturas no son de campo.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  block: {
    gap: spacing.md,
  },
  label: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  status: {
    ...typography.title,
    color: colors.primary,
  },
  detail: {
    ...typography.body,
  },
  help: {
    ...typography.caption,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 18,
    letterSpacing: 4,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  list: {
    gap: spacing.sm,
  },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  candidatePressed: {
    backgroundColor: colors.primarySoft,
  },
  candidateDisabled: {
    opacity: 0.5,
  },
  candidateTexts: {
    flexShrink: 1,
    gap: 2,
  },
  candidateName: {
    ...typography.label,
  },
  candidateId: {
    ...typography.caption,
  },
  message: {
    ...typography.body,
    color: colors.primary,
  },
  error: {
    ...typography.body,
    color: colors.terracotta,
  },
  modeBox: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  note: {
    ...typography.caption,
  },
});
