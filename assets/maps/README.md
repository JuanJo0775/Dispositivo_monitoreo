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

- debe ser un `.pmtiles` y empezar con la firma `PMTiles` (un archivo renombrado se rechaza);
- debe caber en el espacio libre del teléfono;
- no puede superar 200 MB (`MAX_MAP_PACKAGE_BYTES`).

## Atribución

Las teselas son del basemap de Protomaps, hechas a partir de OpenStreetMap (© OpenStreetMap
contributors, ODbL). La pantalla del mapa muestra la atribución; no se debe quitar.
