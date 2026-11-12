import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SimulatedStickGateway } from '@/infrastructure/ble/simulated-stick-gateway';
import { adaptSqlDatabase, createSqliteStores, openDatabase } from '@/infrastructure/db/database';
import type { SqlDatabase } from '@/infrastructure/db/sql-database';

import { AppContext, type AppServices } from './app-context';

/**
 * Punto de composición de la app.
 *
 * Abre SQLite, aplica migraciones y crea el gateway del bastón. Ninguna capa
 * de dominio conoce estas implementaciones: acá se conectan los puertos.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<AppServices | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const gateway = useMemo(() => new SimulatedStickGateway({ deviceId: 'simulated-stick' }), []);

  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<void> {
      try {
        const db = await openDatabase();
        const sql: SqlDatabase = adaptSqlDatabase(db);
        const stores = createSqliteStores(sql);

        if (!cancelled) {
          setServices({ stores, uow: stores.uow, gateway });
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
  }, [gateway]);

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
