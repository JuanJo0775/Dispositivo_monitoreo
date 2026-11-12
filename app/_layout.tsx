import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1B4332' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#F7F7F2' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Monitoreo de suelo' }} />
      </Stack>
    </>
  );
}
