# Map of the project

Un área por fila. El agente lee esta tabla, elige el área que toca su tarea y abre solo esa fila.
Sub-áreas se escriben `padre/hijo`.

La columna Code apunta a las carpetas que ya existen. Se actualiza en el mismo cambio que crea cada
carpeta; una fila sin código todavía queda en `-` a propósito.

| Area | Code | ADR | Requirements |
| --- | --- | --- | --- |
| conexion-ble | src/infrastructure/ble/, src/infrastructure/crypto/, src/ports/stick-gateway.ts, src/ports/ble-transport.ts, src/ports/random-bytes.ts, src/domain/protocol/, docs/architecture/protocolo-ble.md | ADR-APP-012, ADR-APP-017 | RF-APP-001 a RF-APP-006, RF-APP-064; Notion `collection://77d39c4a-833b-82e4-8810-870de4b8d062` |
| medicion | src/domain/capture/, src/application/capture/ | ADR-APP-005, ADR-APP-012 | RF-APP-007 a RF-APP-012; contrato ESP32-App |
| contexto-lote | src/domain/farm/, src/application/farm/, src/domain/session/, src/application/session/ | ADR-APP-015 | RF-APP-013 a RF-APP-020, RF-APP-048 a RF-APP-051, RF-APP-064 |
| diagnostico | src/domain/diagnosis/, src/application/diagnosis/ | ADR-APP-002, ADR-APP-006, ADR-APP-007, ADR-APP-008 | RF-APP-021 a RF-APP-033, RF-APP-065 |
| historial | app/history.tsx, src/application/capture/list-measurements.ts | ADR-APP-004 | RF-APP-034 a RF-APP-038 |
| sincronizacion-sd | src/application/sync/, src/ports/stick-sync.ts, src/ports/stores/sync-state-store.ts, app/sync.tsx, tests/integration/ble-sync-flow.test.ts | ADR-APP-013 | RF-APP-039 a RF-APP-043 |
| mapas | src/domain/geo/, src/application/map/, src/infrastructure/maps/, src/ports/map-package-files.ts, src/ports/stores/map-package-store.ts, src/ui/components/map/, app/map-spike.tsx, plugins/with-map-assets.js | ADR-APP-009 | RF-APP-044 a RF-APP-047 |
| calibracion | - | ADR-APP-005 | RF-APP-052 a RF-APP-054 |
| exportacion | src/application/export/, src/infrastructure/files/ | ADR-APP-014 | RF-APP-055 a RF-APP-057 |
| estado-baston | app/connect.tsx, app/measure.tsx, src/ui/components/sync-status.tsx | ADR-APP-012 | RF-APP-058, RF-APP-059 |
| ajustes | - | ADR-APP-010, ADR-APP-011, ADR-APP-016 | RF-APP-060 a RF-APP-063 |
| accesibilidad-localizacion | app/, src/ui/ | ADR-APP-011 | RNF-APP-007, RNF-APP-016, RNF-APP-020 |
| datos-privacidad | src/infrastructure/db/ | ADR-APP-004, ADR-APP-010 | RNF-APP-004, RNF-APP-006, RNF-APP-011, RNF-APP-012, RNF-APP-014 |
| contexto-proyecto | docs/context/ | ADR-APP-001 | Notion página raíz `40439c4a833b80ab9be5e708777b1497` |
| decisiones | docs/adr/ | - | ADR-APP-001 a ADR-APP-017 en Notion `collection://dfe39c4a-833b-8315-88ec-07f76cfec317` |
| diseno | docs/superpowers/specs/ | - | Mapa de pantallas `40439c4a833b819291dfefd7dc545b88` |
| estructura | docs/architecture/ | - | Este repositorio: dónde vive cada capa y cada área |
| ciencia-origen | docs/requirements/ | - | Objetivo 1 v2: umbrales, ecuaciones y motor de decisión; `muestreo-espacial-mallas-gradientes.md` |

## Reglas

- Varias rutas en una celda se separan con comas.
- Los globs (`**`, `*`) están permitidos; no se comprueban.
- Las rutas planas empiezan en la raíz del repositorio. Un enlace Markdown empieza en la carpeta de
  este archivo. Un número de ADR suelto no se comprueba.
- `harness doctor` reporta cada ruta literal de la columna Code o ADR que no exista.
- El índice de ADR tiene una columna Area con estos mismos nombres.

## Pincho de mapa (tarea 0 del corte 3)

Pantalla temporal `app/map-spike.tsx`: abre el mismo archivo `.pmtiles` de dos maneras para saber
cuál de las dos URI funciona en un teléfono real. La borra la tarea 15.

### Las dos URI que se van a probar

| Mapa | De dónde sale el archivo | URI |
| --- | --- | --- |
| A | Empaquetado en el APK (`android/app/src/main/assets/prueba.pmtiles`) | `pmtiles://asset://prueba.pmtiles` |
| B | Copiado al almacenamiento privado de la app | `pmtiles://file:///data/user/0/com.semillero.monitoreosuelo/files/prueba.pmtiles` |

La ruta del mapa B sale de `Paths.document` (`expo-file-system`) y en Android empieza por
`/data/user/0/<paquete>/files/`. Por eso la URI lleva tres barras: `pmtiles://` + `file://` + la ruta
absoluta.

### Qué se encontró

- `@maplibre/maplibre-react-native@11.5.1` trae MapLibre Native Android **13.6.1**
  (`node_modules/@maplibre/maplibre-react-native/android/gradle.properties`,
  `org.maplibre.reactnative.nativeVersion=13.6.1`). El plan lo acertó.
- El archivo de prueba es PMTiles v3, 23,5 MB, teselas PNG, zoom 0 a 11, longitud 9 a 15 y
  latitud 46 a 49 (Alpes centrales). El mapa se abre centrado en 12.0 / 47.5, zoom 8.
- `npx expo export --platform android` (el build del repositorio) compila bien con la dependencia
  nativa nueva: 1427 módulos y un bundle de 3,8 MB.
- `npx eas-cli@latest build --profile development --platform android --non-interactive` falla porque
  la cuenta de Expo no está conectada. Lo hace la persona, no el agente. El mensaje exacto:
  ```
  An Expo user account is required to proceed.
  Either log in with eas login or set the EXPO_TOKEN environment variable if you're using EAS CLI on CI (Learn more: https://docs.expo.dev/accounts/programmatic-access/)
      Error: build command failed.
  ```
- Metro **no** deja el `.pmtiles` en la carpeta `assets/` del APK: lo deja en `res/raw/`, y MapLibre
  solo abre un archivo empaquetado con `pmtiles://asset://`. Por eso el plugin local
  `plugins/with-map-assets.js` copia `assets/maps/*.pmtiles` a `android/app/src/main/assets/`
  durante `expo prebuild` (comprobado: el archivo queda en el proyecto Android generado).
- El `.pmtiles` de prueba no está en el repositorio (23,5 MB): está en `.gitignore`, y `.easignore`
  lo vuelve a incluir, porque EAS sube el proyecto con las reglas de `.easignore` en lugar de las de
  `.gitignore`. Sin esa línea, el APK no llevaría el archivo y el pincho no probaría nada.
- Pendiente de medir en el teléfono: tamaño del APK (sube unos 23 MB por el archivo de prueba),
  tiempo hasta que aparece el mapa y confirmación de cuál de las dos URI dibuja.

### Cómo verificar (la persona)

1. `eas login` con la cuenta de Expo y luego
   `eas build --profile development --platform android` (o `--profile preview` para un APK con el
   JavaScript embebido, que no necesita Metro).
2. Instalar el APK en el teléfono.
3. Abrir la app y tocar «Pincho de mapa (temporal)».
4. Reportar cuál de los dos mapas dibujó los Alpes centrales: **A**, **B** o **ninguno**. Si ninguno,
   copiar las dos URI que aparecen en pantalla y el mensaje de error de abajo.

Sin esa respuesta no se puede decidir entre PMTiles y la contingencia MBTiles (`mbtiles://`), que solo
cambia `pmtiles-archive-store` y `map-style`.

## Estilo del mapa y apertura del paquete base (tarea 11)

`src/infrastructure/maps/map-style.ts` arma el estilo con dos fuentes vectoriales:

| Fuente | Identificador | Qué es |
| --- | --- | --- |
| Base | `base` | Paquete incluido en el APK (`BASE_ARCHIVE_NAME = 'base.pmtiles'`), país a zoom bajo |
| Detallada | `detalle` | Paquete importado por la persona; se dibuja **encima** de la base |

- Las capas salen de `layers(<fuente>, namedFlavor('light'))` **sin** opciones de idioma: eso deja
  solo capas `fill`, `line` y `background`, sin `symbol`. No hay `glyphs` ni `sprite`, y una prueba
  serializa el estilo y verifica que no aparezca `http://` ni `https://`.
- `layers()` devuelve su propia capa `background` en cada llamada. El estilo pone **una sola** capa
  de fondo, con identificador `fondo` y el color `flavor.background`; las de cada fuente la filtran.
- Las capas de la fuente detallada llevan el prefijo `detalle:` en su identificador. Sin el prefijo,
  las dos fuentes producirían los mismos identificadores y el estilo sería inválido.
- Sin fuentes (`{ base: null, detalle: null }`) el estilo trae solo `fondo`, para poder abrir el mapa
  mientras se resuelve el archivo base sin que MapLibre falle.

`src/infrastructure/maps/pmtiles-archive-store.ts` arma las dos URI locales:

| Función | Resultado | Cuándo |
| --- | --- | --- |
| `assetArchiveUri('base.pmtiles')` | `pmtiles://asset://base.pmtiles` | El archivo viaja dentro del APK |
| `fileArchiveUri('/data/user/0/<paquete>/files/maps/x.pmtiles')` | `pmtiles://file:///data/user/0/<paquete>/files/maps/x.pmtiles` | El archivo está en el almacenamiento privado |

`fileArchiveUri` acepta la ruta absoluta o la URI `file://` que entrega `expo-file-system`, y no
duplica el esquema.

### Estrategia de apertura del paquete base: pendiente de confirmar en el teléfono

El pincho (arriba) decide si `pmtiles://asset://` funciona en MapLibre Native Android 13.6.1. Hasta
que la persona reporte cuál de los dos mapas dibujó:

- **Estrategia por defecto: asset primero, copia como respaldo.** El mapa intenta abrir el base con
  `assetArchiveUri(BASE_ARCHIVE_NAME)`; si el estilo no carga, copia el archivo una vez a
  `Paths.document/maps/base.pmtiles` con el puerto `MapPackageFiles` y usa
  `fileArchiveUri(<ruta copiada>)`. El respaldo cuesta una copia de ~20 MB en el primer arranque y
  después el archivo ya está.
- Si el pincho confirma que **A** dibuja: se conserva el orden y la copia queda como red de
  seguridad para equipos donde el asset no se resuelva.
- Si el pincho confirma que **B** dibuja: la copia deja de ser respaldo y pasa a ser el camino
  normal; el asset se elimina del plugin.
- Si **ninguno** dibuja: se aplica la contingencia MBTiles y solo cambian
  `pmtiles-archive-store.ts` y `map-style.ts`.

