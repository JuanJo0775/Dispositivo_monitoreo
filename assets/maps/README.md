# Paquetes de mapa

Esta carpeta guarda los paquetes `.pmtiles` que la app abre sin internet. La app nunca descarga
nada: el paquete incluido se empaqueta en el build y los detallados se importan desde el teléfono en
**Paquetes de mapa**.

## `base.pmtiles` (incluido, versionado)

Cubre Colombia entera con poco detalle: zoom 0 a 6, 1,2 MB. Es el fondo que siempre está
disponible, incluso sin haber importado nada.

Se generó con el script del repositorio y un build diario de Protomaps:

```powershell
node scripts/map/extract-pmtiles.mjs `
  --source=https://build.protomaps.com/20261115.pmtiles `
  --bbox=-82,-5,-66,14 `
  --maxzoom=6 `
  --out=assets/maps/base.pmtiles
```

Para regenerarlo (por ejemplo, para actualizar los datos) se usa el mismo comando con la fecha del
build vigente. El script descarga el binario oficial de `pmtiles` a `scripts/map/.bin/` la primera
vez —no se instala nada en el sistema— y valida la caja y el zoom antes de pedir un solo byte al
servidor.

El archivo queda versionado porque el APK lo necesita para dibujar. Después de regenerarlo,
`pmtiles verify assets/maps/base.pmtiles` debe terminar sin errores.

## Paquetes detallados (no versionados)

Para una zona de trabajo se genera un paquete con más zoom y se importa al teléfono:

```powershell
node scripts/map/extract-pmtiles.mjs `
  --source=https://build.protomaps.com/20261115.pmtiles `
  --bbox=-75.75,4.45,-75.60,4.60 `
  --maxzoom=15 `
  --out=assets/maps/quindio.pmtiles
```

Ese archivo **no se commitea**: se copia al teléfono (cable, memoria o mensajería) y se importa
desde la pantalla de paquetes. La app lo copia a su almacenamiento privado y lo dibuja encima del
incluido.

Límites que la app comprueba al importar:

- debe ser un `.pmtiles`;
- debe caber en el espacio libre del teléfono;
- no puede superar 200 MB (`MAX_MAP_PACKAGE_BYTES`).

## `prueba.pmtiles` (temporal, pincho del corte 3)

- **Qué es:** imágenes de los Alpes centrales en formato PMTiles v3 (23,5 MB), bajadas de
  `https://demotiles.maplibre.org/pmtiles/raster/imagery.pmtiles`.
- **Para qué sirve:** es el archivo de prueba del pincho (tarea 0 del corte 3). La pantalla
  `app/map-spike.tsx` lo abre de dos maneras: como `pmtiles://asset://prueba.pmtiles` (empaquetado
  en el APK) y como `pmtiles://file://<ruta>` (copiado al almacenamiento privado de la app).
- **No se versiona:** pesa 23,5 MB y es un archivo de prueba. Está en `.gitignore`, y `.easignore`
  lo vuelve a incluir para que el build de EAS lo lleve al APK.
- **Cobertura:** longitud 9 a 15, latitud 46 a 49, zoom 0 a 11, teselas PNG.
- Se borra cuando la persona confirme cuál de las dos URI dibuja en el teléfono.

## Atribución

Las teselas son del basemap de Protomaps, hechas a partir de OpenStreetMap (© OpenStreetMap
contributors, ODbL). La pantalla del mapa muestra la atribución; no se debe quitar.
