// Metro solo copia al APK los archivos cuya extensión está declarada como
// recurso. El paquete base del mapa usa `.pmtiles`, que no viene por defecto:
// sin esta línea `require('.../base.pmtiles')` no existe en el teléfono.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('pmtiles')) {
  config.resolver.assetExts.push('pmtiles');
}

module.exports = config;
