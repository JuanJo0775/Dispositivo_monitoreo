const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('expo/config-plugins');

const CARPETA_MAPA = path.join('assets', 'maps');
const CARPETA_ASSETS_ANDROID = path.join('android', 'app', 'src', 'main', 'assets');

/**
 * Copia los archivos `.pmtiles` de `assets/maps/` a la carpeta `assets/` del
 * proyecto Android.
 *
 * Metro no deja los archivos ahí: los deja en `res/raw/`, y MapLibre solo
 * abre un `.pmtiles` empaquetado con la URI `pmtiles://asset://<nombre>`, que
 * se resuelve contra la carpeta `assets/` del APK.
 */
function copiarArchivosPmtiles(projectRoot) {
  const origen = path.join(projectRoot, CARPETA_MAPA);

  if (!fs.existsSync(origen)) {
    return [];
  }

  const archivos = fs
    .readdirSync(origen)
    .filter((nombre) => nombre.endsWith('.pmtiles'))
    .map((nombre) => path.join(origen, nombre));

  if (archivos.length === 0) {
    return [];
  }

  const destino = path.join(projectRoot, CARPETA_ASSETS_ANDROID);
  fs.mkdirSync(destino, { recursive: true });

  for (const archivo of archivos) {
    fs.copyFileSync(archivo, path.join(destino, path.basename(archivo)));
  }

  return archivos.map((archivo) => path.basename(archivo));
}

/**
 * Plugin local de Expo: deja los paquetes de mapa dentro del APK de Android.
 */
module.exports = function withMapAssets(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      copiarArchivosPmtiles(config.modRequest.projectRoot);
      return config;
    },
  ]);
};
