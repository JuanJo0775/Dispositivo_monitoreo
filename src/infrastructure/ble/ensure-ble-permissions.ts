/**
 * Permisos de Bluetooth en Android.
 *
 * Desde Android 12 el escaneo y la conexión usan permisos propios; antes se
 * pedía la ubicación, porque el sistema trataba el Bluetooth como una forma de
 * deducir dónde está la persona. La app **no** usa la ubicación del teléfono:
 * solo pide el permiso que Android exige para hablar con el bastón.
 *
 * El plugin `react-native-ble-plx` de `app.json` declara los permisos en el
 * manifiesto; acá se piden en tiempo de ejecución, que es lo que falta para
 * que el escaneo devuelva algo.
 */

import { PermissionsAndroid, Platform } from 'react-native';

/** Permiso tal como lo nombra React Native. */
type Permission = Parameters<typeof PermissionsAndroid.requestMultiple>[0][number];

/** Permisos que necesita el escaneo según la versión de Android. */
export function blePermissions(): Permission[] {
  if (Platform.OS !== 'android') {
    return [];
  }

  const version = typeof Platform.Version === 'number' ? Platform.Version : 0;

  if (version >= 31) {
    return [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ];
  }

  return [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
}

/**
 * Pide los permisos de Bluetooth y falla con un mensaje que se pueda leer.
 *
 * Se llama antes de escanear. Si la persona dice que no, la app no puede
 * buscar el bastón y lo dice: no se queda girando sin explicación.
 */
export async function ensureBlePermissions(): Promise<void> {
  const permissions = blePermissions();

  if (permissions.length === 0) {
    return;
  }

  const result = await PermissionsAndroid.requestMultiple(permissions);
  const denied = permissions.filter(
    (permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED,
  );

  if (denied.length > 0) {
    throw new Error(
      'La app necesita permiso de Bluetooth para buscar el bastón. ' +
        'Actívalo en los ajustes del teléfono y vuelve a intentar.',
    );
  }
}
