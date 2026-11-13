import { StyleSheet, Text, View } from 'react-native';

import type { SyncSummary } from '@/application/sync/sync-from-stick';

export interface SyncStatusProps {
  /** Resultado de la última sincronización; `null` si todavía no hubo ninguna. */
  readonly summary: SyncSummary | null;
  /** Último id que la app confirmó al bastón; `null` si nunca se sincronizó. */
  readonly lastConfirmedSequence: number | null;
  /** Estado guardado: `idle`, `syncing` o `error`. */
  readonly status?: 'idle' | 'syncing' | 'error' | null;
  /** Mensaje del último error, si lo hubo. */
  readonly errorMessage?: string | null;
}

/**
 * Estado de la sincronización con el bastón.
 *
 * Todo se cuenta con texto, no solo con color: cuántos registros llegaron,
 * cuántos se guardaron, cuántos ya estaban y cuántos chocaron. El progreso se
 * cuenta por registros confirmados, nunca por paquetes (RF-APP-041).
 */
export function SyncStatus({
  summary,
  lastConfirmedSequence,
  status = null,
  errorMessage = null,
}: SyncStatusProps) {
  const sinDatos = summary === null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Sincronización</Text>

      {status === 'syncing' ? <Text style={styles.hint}>Sincronizando con el bastón…</Text> : null}

      {status === 'error' ? (
        <Text style={styles.error}>
          La última sincronización falló{errorMessage === null ? '' : `: ${errorMessage}`}. Los
          registros ya guardados no se pierden y la próxima vez se reanuda donde quedó.
        </Text>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.key}>Último registro confirmado</Text>
        <Text style={styles.value}>
          {lastConfirmedSequence === null ? 'ninguno todavía' : String(lastConfirmedSequence)}
        </Text>
      </View>

      {sinDatos ? (
        <Text style={styles.empty}>
          Todavía no se ha sincronizado ningún registro de la microSD.
        </Text>
      ) : (
        <View style={styles.rows}>
          <View style={styles.row}>
            <Text style={styles.key}>Recibidos del bastón</Text>
            <Text style={styles.value}>{String(summary.received)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Guardados</Text>
            <Text style={styles.value}>{String(summary.imported)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Ya estaban guardados</Text>
            <Text style={styles.value}>{String(summary.duplicates)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Con conflicto</Text>
            <Text style={styles.value}>{String(summary.conflicts)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.key}>Con error</Text>
            <Text style={styles.value}>{String(summary.errors)}</Text>
          </View>
        </View>
      )}

      {summary !== null && summary.conflicts > 0 ? (
        <Text style={styles.warning}>
          Hay {summary.conflicts} {summary.conflicts === 1 ? 'registro' : 'registros'} con el mismo
          identificador y contenido distinto: se conservó el primero y no se sobrescribió.
        </Text>
      ) : null}

      {summary !== null && summary.errors > 0 ? (
        <Text style={styles.warning}>
          {summary.errors === 1 ? 'Un registro' : `${summary.errors} registros`} no se pudo guardar.
          Queda pendiente en el bastón para el próximo intento.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#5A5A5A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rows: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  key: {
    flexShrink: 1,
    fontSize: 15,
    color: '#2F2F2F',
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1B4332',
  },
  hint: {
    fontSize: 15,
    color: '#1B4332',
  },
  empty: {
    fontSize: 15,
    color: '#4A4A4A',
  },
  warning: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8A3B12',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8A3B12',
  },
});
