import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProvider } from '@/ui/providers/app-provider';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1B4332' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#F7F7F2' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Monitoreo de suelo' }} />
        <Stack.Screen name="connect" options={{ title: 'Conectar' }} />
        <Stack.Screen name="measure" options={{ title: 'Medir' }} />
        <Stack.Screen name="history" options={{ title: 'Historial' }} />
        <Stack.Screen name="farms" options={{ title: 'Fincas y lotes' }} />
        <Stack.Screen name="farm-form" options={{ title: 'Finca' }} />
        <Stack.Screen name="plot-form" options={{ title: 'Lote' }} />
        <Stack.Screen name="session" options={{ title: 'Sesión de medición' }} />
        <Stack.Screen name="diagnosis" options={{ title: 'Diagnóstico' }} />
        <Stack.Screen name="settings" options={{ title: 'Ajustes' }} />
        <Stack.Screen name="privacy" options={{ title: 'Aviso de privacidad' }} />
      </Stack>
    </AppProvider>
  );
}
