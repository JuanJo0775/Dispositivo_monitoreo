import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { backfillMeasurementContext } from '@/application/capture/backfill-measurement-context';
import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import { BleStickGateway } from '@/infrastructure/ble/ble-stick-gateway';
import { BlePlxTransport } from '@/infrastructure/ble/ble-plx-transport';
import { makeFakeBleTransport } from '@/infrastructure/ble/fake-ble-transport';
import {
  DEFAULT_SIMULATED_PIN,
  DEFAULT_SIMULATED_SALT,
  SimulatedStickDevice,
} from '@/infrastructure/ble/simulated-stick-device';
import { expoRandomBytes } from '@/infrastructure/crypto/expo-random-bytes';
import { adaptSqlDatabase, createSqliteStores, openDatabase } from '@/infrastructure/db/database';
import type { SqlDatabase } from '@/infrastructure/db/sql-database';
import { expoBaseMap } from '@/infrastructure/maps/expo-base-map';
import { expoMapPackageFiles } from '@/infrastructure/maps/expo-map-package-files';
import { importThresholdSet } from '@/infrastructure/thresholds/import-threshold-set';
import { loadThresholdSet } from '@/infrastructure/thresholds/load-threshold-set';
import { ACTIVE_THRESHOLDS_VERSION } from '@/shared/versions';

import { AppContext, type AppServices } from './app-context';
import { StickSettingsContext, type StickMode } from './stick-settings';
import { colors, typography } from '@/ui/theme';

/** Identificador del bastón de prueba; solo existe en el modo simulado. */
const SIMULATED_DEVICE_ID = 'simulated-stick';

/**
 * Punto de composición de la app.
 *
 * Abre SQLite, aplica migraciones, importa el set de umbrales y cablea el
 * bastón. El camino normal es el **BLE real** (`BlePlxTransport`); el bastón
 * de prueba queda detrás de una elección explícita en la pantalla de conexión,
 * y sus capturas viajan marcadas como simuladas.
 *
 * Ninguna capa de dominio conoce estas implementaciones: acá se conectan los
 * puertos.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [base, setBase] = useState<{
    stores: ReturnType<typeof createSqliteStores>;
    thresholds: ThresholdSet;
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [mode, setMode] = useState<StickMode>('real');
  const [connectedByMode, setConnectedByMode] = useState<Record<StickMode, string | null>>({
    real: null,
    simulated: null,
  });

  const sticks = useMemo(() => {
    const real = new BleStickGateway(new BlePlxTransport(), { random: expoRandomBytes });

    const simulatedDevice = new SimulatedStickDevice({
      deviceId: SIMULATED_DEVICE_ID,
      pin: DEFAULT_SIMULATED_PIN,
    });
    const simulated = new BleStickGateway(makeFakeBleTransport(simulatedDevice), {
      pin: DEFAULT_SIMULATED_PIN,
      salt: DEFAULT_SIMULATED_SALT,
      random: expoRandomBytes,
    });

    return { real, simulated };
  }, []);

  const activeGateway = mode === 'real' ? sticks.real : sticks.simulated;

  useEffect(() => {
    // El identificador del bastón real solo se conoce al conectar: la pantalla
    // de sincronización guarda su avance por dispositivo.
    return activeGateway.onStatus((status) => {
      setConnectedByMode((previous) =>
        previous[mode] === status.deviceId ? previous : { ...previous, [mode]: status.deviceId },
      );
    });
  }, [activeGateway, mode]);

  const connectedDeviceId = connectedByMode[mode];

  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<void> {
      try {
        const db = await openDatabase();
        const sql: SqlDatabase = adaptSqlDatabase(db);
        const stores = createSqliteStores(sql);

        // Lo guardado antes de que la ingesta resolviera lote y sesión se
        // completa al arrancar; sin esto el mapa solo vería capturas nuevas.
        await backfillMeasurementContext({
          captures: stores.captures,
          measurements: stores.measurements,
          farms: stores.farms,
          sessions: stores.sessions,
        });

        const thresholds: ThresholdSet = await loadThresholdSet(ACTIVE_THRESHOLDS_VERSION);
        await importThresholdSet(sql, thresholds);

        if (!cancelled) {
          setBase({ stores, thresholds });
        }
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError : new Error(String(bootError)));
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const services = useMemo<AppServices | null>(() => {
    if (base === null) {
      return null;
    }

    return {
      stores: base.stores,
      uow: base.stores.uow,
      gateway: activeGateway,
      sync: activeGateway,
      mapFiles: expoMapPackageFiles,
      baseMap: expoBaseMap,
      deviceId: connectedDeviceId ?? (mode === 'simulated' ? SIMULATED_DEVICE_ID : ''),
      thresholds: base.thresholds,
    };
  }, [activeGateway, base, connectedDeviceId, mode]);

  const settings = useMemo(
    () => ({
      mode,
      setMode: (next: StickMode) => {
        setMode(next);
      },
    }),
    [mode],
  );

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>No se pudo preparar la base local</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  if (services === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loading}>Preparando la base local.</Text>
      </View>
    );
  }

  return (
    <StickSettingsContext.Provider value={settings}>
      <AppContext.Provider value={{ services, error: null }}>{children}</AppContext.Provider>
    </StickSettingsContext.Provider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.background,
  },
  loading: {
    ...typography.body,
    color: colors.textMuted,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.terracotta,
    textAlign: 'center',
  },
  errorDetail: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
