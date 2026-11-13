import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { ThresholdSet } from '@/domain/diagnosis/threshold-set';
import { BleStickGateway } from '@/infrastructure/ble/ble-stick-gateway';
import { makeFakeBleTransport } from '@/infrastructure/ble/fake-ble-transport';
import {
  DEFAULT_SIMULATED_PIN,
  DEFAULT_SIMULATED_SALT,
  SimulatedStickDevice,
} from '@/infrastructure/ble/simulated-stick-device';
import { expoRandomBytes } from '@/infrastructure/crypto/expo-random-bytes';
import { adaptSqlDatabase, createSqliteStores, openDatabase } from '@/infrastructure/db/database';
import type { SqlDatabase } from '@/infrastructure/db/sql-database';
import { importThresholdSet } from '@/infrastructure/thresholds/import-threshold-set';
import { loadThresholdSet } from '@/infrastructure/thresholds/load-threshold-set';
import { ACTIVE_THRESHOLDS_VERSION } from '@/shared/versions';

import { AppContext, type AppServices } from './app-context';

/**
 * Punto de composición de la app.
 *
 * Abre SQLite, aplica migraciones, importa el set de umbrales y cablea el
 * bastón. El bastón todavía es simulado, pero la app no lo sabe: habla con él
 * por el mismo transporte BLE y el mismo protocolo que usará con el prototipo,
 * así que el día que exista solo cambia el transporte.
 *
 * Ninguna capa de dominio conoce estas implementaciones: acá se conectan los
 * puertos.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<AppServices | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const stick = useMemo(() => {
    const device = new SimulatedStickDevice({
      deviceId: 'simulated-stick',
      pin: DEFAULT_SIMULATED_PIN,
    });
    const gateway = new BleStickGateway(makeFakeBleTransport(device), {
      pin: DEFAULT_SIMULATED_PIN,
      salt: DEFAULT_SIMULATED_SALT,
      random: expoRandomBytes,
    });

    return { deviceId: device.deviceId, gateway };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<void> {
      try {
        const db = await openDatabase();
        const sql: SqlDatabase = adaptSqlDatabase(db);
        const stores = createSqliteStores(sql);
        const thresholds: ThresholdSet = await loadThresholdSet(ACTIVE_THRESHOLDS_VERSION);
        await importThresholdSet(sql, thresholds);

        if (!cancelled) {
          setServices({
            stores,
            uow: stores.uow,
            gateway: stick.gateway,
            sync: stick.gateway,
            deviceId: stick.deviceId,
            thresholds,
          });
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
  }, [stick]);

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>No se pudo abrir la base local</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
      </View>
    );
  }

  if (services === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1B4332" />
        <Text style={styles.loading}>Preparando la base local…</Text>
      </View>
    );
  }

  return <AppContext.Provider value={{ services, error: null }}>{children}</AppContext.Provider>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#F7F7F2',
  },
  loading: {
    fontSize: 16,
    color: '#3F3F3F',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8A3B12',
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 15,
    color: '#3F3F3F',
    textAlign: 'center',
  },
});
