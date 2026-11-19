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
| mapas | src/domain/geo/, src/application/map/, src/infrastructure/maps/, src/ports/base-map.ts, src/ports/map-package-files.ts, src/ports/stores/map-package-store.ts, src/ui/components/map/, app/map.tsx, app/map-packages.tsx, metro.config.js | ADR-APP-009 | RF-APP-044 a RF-APP-047 |
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

## Apertura del paquete incluido (resultado del pincho)

El pincho de la tarea 0 ya se ejecutó en un teléfono y **se retiró**: `app/map-spike.tsx`,
`assets/maps/prueba.pmtiles`, su botón en el inicio y el plugin `plugins/with-map-assets.js` ya no
existen.

Qué mostró:

- **A** (`pmtiles://asset://prueba.pmtiles`) dibujó un rectángulo negro, sin teselas.
- **B** (`pmtiles://file://…`) falló con `Source must be a file`: el archivo de origen no existía.

La causa de fondo es la misma en los dos casos: un `.pmtiles` empaquetado en el APK queda como
entrada comprimida del zip y MapLibre no lo puede leer por posiciones. Además, el archivo del pincho
nunca viajó al build, porque no estaba versionado y EAS compila desde el repositorio.

Decisión: el paquete incluido se declara como recurso de Metro (`metro.config.js` agrega `pmtiles` a
`assetExts`), se extrae a un archivo real con `expo-asset` y se abre con `pmtiles://file://…`. La
copia vive en `Paths.document/maps/base.pmtiles`, no en caché, para que el limpiador del sistema no
la borre en una salida a campo.

Si el archivo no se puede preparar, el lote abre con el croquis (`FallbackMap`) y un aviso: el área
nunca queda en blanco (diseño §11.4).

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

`src/shared/pmtiles-uri.ts` arma la URI local y guarda el nombre del paquete incluido:

| Función | Resultado | Cuándo |
| --- | --- | --- |
| `pmtilesFileUri('/data/user/0/<paquete>/files/maps/x.pmtiles')` | `pmtiles://file:///data/user/0/<paquete>/files/maps/x.pmtiles` | El archivo está en el almacenamiento privado |
| `BASE_ARCHIVE_NAME` | `'base.pmtiles'` | Nombre con el que se extrae el paquete incluido |

`pmtilesFileUri` acepta la ruta absoluta o la URI `file://` que entrega `expo-file-system`, y no
duplica el esquema.

### Apertura del paquete base

1. `metro.config.js` declara `pmtiles` en `resolver.assetExts`, así Metro copia el archivo al APK.
2. `src/infrastructure/maps/expo-base-map.ts` resuelve el recurso con `Asset.fromModule` y
   `downloadAsync`, y copia el archivo a `Paths.document/maps/base.pmtiles` (una sola vez; si ya
   está, no lo vuelve a copiar).
3. `src/application/map/prepare-base-map.ts` convierte esa ruta en `pmtiles://file://…`.
4. `app/map.tsx` pide esa URI al abrir el lote. Si falla, el mapa cae al croquis y avisa.

El puerto `src/ports/base-map.ts` (`BaseMapSource`) es lo que permite probar el caso de uso sin
teléfono; el contexto de la app lo cablea con `expoBaseMap`.

## Pantalla del lote (tarea 13)

`app/map.tsx` muestra, de arriba hacia abajo: selector de lote, encabezado (nombre, cultivo, unidad
cartográfica y **área medida**), aviso del paquete detallado, mapa, resumen, leyenda, detalle de la
celda tocada, alertas del motor, avisos de registro y puntos documentados.

- Al abrir el lote corre `ensurePlotDiagnoses` y después `describePlotSpace`. Si la reparación de
  diagnósticos falla, el mapa abre igual y muestra un aviso; no se oculta el lote.
- El encabezado dice «Área medida» y la calcula con la malla (`cellAreaHa × celdas`). El lote no
  tiene área declarada: la malla cubre lo medido, no el contorno.
- Colores de las celdas en `map-colors.ts`; geometría en `map-geometry.ts`; la hoja de la celda en
  `cell-sheet.tsx` y la lista en `point-list.tsx`. La pantalla no dictamina ni promedia.
- Fuentes del mapa: el paquete incluido (`prepareBaseMap(baseMap)`) y, si hay uno activo, el
  detallado (`pmtilesFileUri(<ruta>)`). Sin detallado activo aparece un aviso con enlace a
  `/map-packages`.
- «Encuadrar» remonta el mapa (`key`) para volver a la caja de los puntos. La atribución
  «Teselas © OpenStreetMap · Protomaps» va debajo del mapa y no se superpone con el botón.
- Un punto sin posición queda en la lista con el texto «sin posición»; no se dibuja en el mapa.
- La pantalla se abre desde «Mapa del lote» en el inicio y desde el botón «Mapa» de cada lote en
  Fincas y lotes, con `plotId` como parámetro.


## Paquetes de mapa (tarea 14)

`app/map-packages.tsx` lista el paquete incluido y los importados, importa un .pmtiles desde el
selector del sistema y permite activar, borrar o volver al incluido.

- Importar deja el paquete recién copiado **activo**, aunque hubiera otro: la persona acaba de
  elegirlo. Volver al anterior o al incluido es una acción aparte ("Usar solo el incluido").
- El archivo se copia al almacenamiento privado como `<id>.pmtiles`; el tamaño se compara contra
  el espacio libre antes de copiar y el límite es `MAX_MAP_PACKAGE_BYTES` (200 MB).
- Borrar pide confirmación con `Alert`, borra el archivo y luego marca la fila. Si el paquete
  borrado era el activo, el ajuste queda en `''` y el mapa vuelve al incluido.
- Todo el estado sale de `ManageMapPackagesDeps` (`packages`, `settings`, `files`, `clock`,
  `newId`), armado en la pantalla con `mapFiles` del contexto. La prueba usa
  `tests/helpers/in-memory-map-package-files.ts`.

## Cierre del corte 3 (tarea 15)

- `assets/maps/base.pmtiles` ya existe: Colombia, zoom 0 a 6, 1,2 MB, generado con
  `scripts/map/extract-pmtiles.mjs` desde el build `20261115` de Protomaps y verificado con
  `pmtiles verify`. Va versionado y Metro lo empaqueta como recurso.
- El script valida `--source`, `--bbox` y `--maxzoom` antes de tocar la red, descarga el
  binario oficial de `pmtiles` a `scripts/map/.bin/` (ignorado por git) y borra la salida si el
  extractor falla. Cómo se usa: `assets/maps/README.md`.
- El historial muestra el lote de cada medición y, si no tiene, abre el selector de lotes. Asignar
  cambia solo `plot_id`: valores, hora y diagnóstico quedan igual.
- ADR nuevo: `docs/adr/0003-mapa-offline-pmtiles.md`. Explicación de la malla y del dictamen:
  `docs/architecture/mapa-y-malla.md`.
- El pincho de mapa se ejecutó en un teléfono y se retiró; el resultado y la decisión están en la
  sección «Apertura del paquete incluido».
