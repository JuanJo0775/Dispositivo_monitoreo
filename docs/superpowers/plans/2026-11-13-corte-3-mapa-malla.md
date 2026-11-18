# Corte 3 — Mapa, malla y dictamen por espacio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [x]`) syntax for tracking.

**Goal:** Que la app dibuje en un mapa offline las coordenadas que registró el bastón, derive una
malla automática de celdas de ~0,4 ha sobre el área medida y dictamine **cada celda** solo con lo
que se midió dentro, sin inventar nada y sin decirle a la persona cómo muestrear.

**Architecture:** El cálculo geográfico es dominio puro en `src/domain/geo/` (proyección local,
malla, calidad de posición, dictamen por celda). La capa de aplicación arma el modelo de pantalla
(`describePlotSpace`) y completa los diagnósticos que falten (`ensurePlotDiagnoses`). El mapa se
dibuja con MapLibre Native sobre un archivo `.pmtiles` local; si el archivo no abre, hay un
respaldo en lienzo con `View`. La base local (SQLite) es la única fuente de verdad: la malla **se
recalcula** desde los puntos, nunca se guarda.

**Tech Stack:** React Native + Expo SDK 58, TypeScript estricto, `@maplibre/maplibre-react-native@11.5.1`
(MapLibre Native Android 13.6.1), `@protomaps/basemaps@5.7.2` (estilo), PMTiles, `expo-file-system`,
`expo-document-picker`, Jest + jest-expo, EAS Build (nube, sin SDK ni JDK local).

**Spec:** `docs/superpowers/specs/2026-11-12-corte-3-mapa-malla-design.md`

**Evidencia científica:** `docs/requirements/muestreo-espacial-mallas-gradientes.md`

## Ajustes de ejecución (2026-11-13)

- **El pincho va primero (tarea 0).** Si PMTiles no renderiza en el APK, la contingencia es MBTiles
  (`mbtiles://`) y solo cambian `pmtiles-archive-store` y `map-style`. El resto del plan no cambia.
- **Sin rótulos de lugar en el corte 3.** El estilo usa `layers(fuente, namedFlavor('light'))` **sin**
  opciones de idioma: eso deja solo las capas sin `symbol`, que no necesitan glifos ni sprites y
  por lo tanto no piden nada por red. Agregar rótulos exige empaquetar glifos (fuera de alcance
  aquí); la app rotula lo que importa: lote, celdas, puntos y leyenda.
- **La posición del bastón manda.** `positionValid = false` significa “sin posición” aunque las
  coordenadas vengan: por eso la bandera se conserva en la medición (`position_valid`), porque la
  reconstrucción a partir de las coordenadas no alcanza.
- **No se agrega `config_id` a las mediciones.** La sesión ya se puede resolver por `config_id` en
  el momento de la ingesta y se guarda su `id` en `measurements.session_id` (columna que la
  migración 2 creó y nadie usaba). Una sola verdad, y menos columnas.
- **La geometría no se guarda.** Ni la malla, ni la celda de cada punto, ni la posición duplicada:
  todo se deriva de `payload_json` y de los puntos con posición.
- **`ensurePlotDiagnoses` no usa la transacción.** El `uow` solo expone capturas y mediciones, y el
  motor de diagnóstico escribe por su cuenta. Cada diagnóstico se escribe por separado, es
  idempotente y un fallo puntual no deja la pantalla cargando: se cuenta y se avisa.

## Global Constraints

- Offline first: sin cuentas, sin servidor, sin red. El mapa nunca hace peticiones.
- Capas: `app/` → `src/ui` → `src/application` → `src/domain`; `src/ports` define interfaces;
  `src/infrastructure` implementa. `src/domain` no importa React Native, Expo, SQLite ni BLE.
- SQLite es la única fuente de verdad; las capturas son inmutables en su contenido. Asignar lote o
  sesión es metadato: no cambia el contenido de la captura.
- El dictamen sale del motor existente (`diagnose.ts`), no de un segundo motor espacial.
- Todo texto en español de Colombia; los estados se distinguen con texto, no solo con color.
- Un dato ausente se muestra como “sin dato”, nunca como cero.
- La app es un sistema de documentación y alertas: **no** dice cuántos puntos faltan, ni si el
  muestreo está completo, ni cómo recorrer el lote.
- TypeScript estricto; sin `any` implícito; `noUncheckedIndexedAccess` activo.
- `npm run check` y `node .harness/bin/harness.mjs verify` deben pasar antes de cada commit.
- Commits pequeños, en español, con prefijo `feat:`/`test:`/`chore:`/`docs:`.

## Review Focus

- Una celda vacía **nunca** se colorea con el color de una clase.
- Clases que discrepan **nunca** se promedian ni se colapsan a una sola.
- Una medición sin posición **nunca** se dibuja ni se inventa su posición.
- El mapa **nunca** pide nada por red: ni la fuente, ni el estilo, ni los glifos, ni los sprites.
- Los diagnósticos que faltan se calculan con la **sesión de su `config_id`**, no con el contexto
  actual del lote.
- La malla se recalcula desde los puntos y **nunca** se guarda: no hay dos verdades.
- El APK se compila en la nube (EAS) y abre el mapa con `pmtiles://` en la arquitectura nueva.
- Lo que llegó por sincronización o CSV aparece en su lote, con su sesión y su diagnóstico.

---

## File Structure

```
app/map.tsx                          pantalla de mapa por lote
app/map-packages.tsx                 paquetes de mapa offline (incluido, importados, borrar)
src/domain/geo/
  types.ts                           LatLon, LocalBox, Grid, GridCell, CellState
  projection.ts                      equirectangular local: lat/lon <-> metros
  grid.ts                            malla desde los puntos y asignación de celda
  position.ts                        calidad de la posición según la bandera del bastón
  cell-verdict.ts                    dictamen de celda y resumen numérico por variable
src/application/capture/
  resolve-capture-assignment.ts      lote y sesión de una captura (plotCode, configId)
  backfill-measurement-context.ts    relleno idempotente de lo ya guardado
src/application/map/
  describe-plot-space.ts             lote + mediciones + diagnósticos -> modelo de pantalla
  ensure-plot-diagnoses.ts           calcula los diagnósticos que falten, con su sesión
  manage-map-packages.ts             importar, listar, activar y borrar paquetes
src/ports/stores/map-package-store.ts
src/ports/map-package-files.ts       puerto de archivos (copiar, borrar, espacio)
src/infrastructure/maps/
  map-style.ts                       estilo Protomaps sobre una fuente pmtiles://
  pmtiles-archive-store.ts           URIs pmtiles://file:// y pmtiles://asset://
  expo-map-package-files.ts          implementación del puerto con expo-file-system
src/infrastructure/db/migrations.ts  migración 5: position_valid + map_packages
src/ui/components/map/
  map-colors.ts                      colores y rótulos por clase y por estado
  map-legend.tsx                     leyenda con texto y color
  plot-map.tsx                       mapa MapLibre: celdas y puntos
  fallback-map.tsx                   lienzo sin teselas
  cell-sheet.tsx                     hoja inferior con el detalle de una celda
  point-list.tsx                     lista de puntos documentados
scripts/map/extract-pmtiles.mjs      genera un .pmtiles por caja de coordenadas
assets/maps/                         paquete base incluido (Colombia, zoom bajo)
tests/                               espejo de src/ y app/
```

---

### Task 0: Pincho — EAS Build, MapLibre y PMTiles en el teléfono

**Files:**
- Create: `eas.json`, `assets/maps/README.md`
- Modify: `app.json` (plugin de MapLibre), `package.json` (dependencias), `docs/context/map.md`

**Interfaces:**
- Produces:
  - `eas.json` con perfiles `development` (APK de desarrollo con `expo-dev-client`),
    `preview` (APK de prueba) y `production`.
  - `app.json` con `"plugins": [..., "@maplibre/maplibre-react-native"]`.
  - `docs/context/map.md` con el veredicto del pincho: qué URI funcionó, tamaños y tiempos.

- [ ] **Step 1: Instalar la biblioteca y el plugin**

  ```powershell
  npx expo install @maplibre/maplibre-react-native@11.5.1
  npm i -D @protomaps/basemaps@5.7.2
  ```

  En `app.json`, sumar `"@maplibre/maplibre-react-native"` a `plugins`. Si `expo install` deja otra
  versión, dejar exactamente `11.5.1`.

- [ ] **Step 2: Escribir `eas.json`**

  ```json
  {
    "cli": { "version": ">= 5.0.0" },
    "build": {
      "development": { "developmentClient": true, "distribution": "internal" },
      "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
      "production": { "autoIncrement": true }
    }
  }
  ```

- [ ] **Step 3: Cuenta de Expo (lo hace la persona)**

  `npx eas-cli@latest login` con la cuenta de Expo de la persona y `eas build` pide ASSOCIAR el
  proyecto. Sin esto no hay APK: es el único punto del plan que depende de una cuenta externa.

- [ ] **Step 4: Primer APK de desarrollo**

  ```powershell
  npx eas-cli@latest build --profile development --platform android
  ```

  Expected: el build termina en verde y da un enlace de descarga; la app instala con
  `expo-dev-client` y el JS recarga como en Expo Go. **Esto es lo que faltaba**: Expo Go no carga
  MapLibre ni BLE.

- [ ] **Step 5: Probar las dos formas de abrir un `.pmtiles`**

  1. Descargar el archivo de prueba (imágenes de<MapLibre, pequeño):
     `https://demotiles.maplibre.org/pmtiles/raster/imagery.pmtiles` en `assets/maps/prueba.pmtiles`.
  2. En el teléfono, con la app abierta, probar una fuente `pmtiles://asset://prueba.pmtiles`.
  3. Copiar el mismo archivo al almacenamiento privado de la app y probar
     `pmtiles://file://<ruta absoluta>` (la ruta sale de `Paths.document`).
  4. Anotar en `docs/context/map.md` **cuál de las dos funcionó** y con qué forma exacta de la URI
     (`pmtiles://file://` + ruta absoluta, que en Android queda `pmtiles://file:///data/...`).

- [ ] **Step 6: Comprobar la arquitectura nueva y medir tamaños**

  `newArchEnabled: true` ya está en `app.json`. Confirmar en el APK que el mapa dibuja y anotar:
  tamaño del APK, tamaño del paquete base y tiempo hasta que aparece el mapa.

- [ ] **Step 7: Decidir la contingencia y seguir**

  Si PMTiles no renderiza, la contingencia es **MBTiles** (`mbtiles://`): se cambia solo
  `pmtiles-archive-store` y `map-style`, y se anota la decisión en `docs/context/map.md`.

- [ ] **Step 8: Commit**

  ```powershell
  git add eas.json app.json package.json package-lock.json assets/maps docs/context/map.md
  git commit -m "chore: pincho de EAS Build y MapLibre con PMTiles verificado"
  ```

---

### Task 1: Proyección local (lat/lon ↔ metros)

**Files:**
- Create: `src/domain/geo/types.ts`, `src/domain/geo/projection.ts`
- Test: `tests/domain/geo/projection.test.ts`

**Interfaces:**
- Produces:
  - `interface LatLon { latitude: number; longitude: number }`
  - `interface LocalPoint { x: number; y: number }` (metros)
  - `interface LocalBox { minX: number; minY: number; maxX: number; maxY: number }`
  - `EARTH_RADIUS_M = 6371008.8`
  - `projectToLocal(origin: LatLon, point: LatLon): LocalPoint`
  - `unprojectFromLocal(origin: LatLon, local: LocalPoint): LatLon`
  - `boundingBox(points: readonly LocalPoint[]): LocalBox | null`
  - `boxWidth(box)`, `boxHeight(box)`, `boxArea(box)`

- [ ] **Step 1: Escribir las pruebas** — ida y vuelta con error < 1 cm en un cuadrado de 100 m; el
  norte es `y` positivo; 1 grado de latitud son ~111.19 km (error < 1 m); una caja envolvente
  vacía es `null`; el ancho y el alto de la caja son los esperados.

- [ ] **Step 2: Ejecutar y verificar que falla** — Run: `npm test -- tests/domain/geo`
  Expected: FAIL porque los archivos no existen.

- [ ] **Step 3: Implementar** — equirectangular: `x = R·cos(lat0)·Δλ`, `y = R·Δφ`, con `lat0` la
  latitud del origen. TypeScript puro, sin dependencias ni proyección geodésica completa: a escala
  de lote el error es despreciable.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (6 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: proyeccion local para la malla"`

---

### Task 2: Malla desde los puntos

**Files:**
- Create: `src/domain/geo/grid.ts`
- Test: `tests/domain/geo/grid.test.ts`

**Interfaces:**
- Consumes: `LatLon`, `LocalPoint`, `LocalBox` de la tarea 1.
- Produces:
  - `interface GridCell { id: string; row: number; column: number; bounds: LocalBox; areaHa: number }`
  - `interface Grid { origin: LatLon; box: LocalBox; rows: number; columns: number;
    cellAreaHa: number; targetAreaHa: number; adjusted: boolean; cells: readonly GridCell[] }`
  - `DEFAULT_CELL_AREA_HA = 0.4`, `MAX_CELLS = 400`, `MIN_ASPECT = 0.4`, `MAX_ASPECT = 2.5`
  - `buildGrid(points: readonly LatLon[], targetAreaHa?: number): Grid | null`
  - `cellForPoint(grid: Grid, point: LatLon): GridCell | null`

- [ ] **Step 1: Escribir las pruebas** — los cinco casos de la tabla del diseño §7.2:

  | Dispersión | Área | Celdas | Celda (ha) |
  | --- | --- | --- | --- |
  | 55 × 55 m | 0,30 ha | 1 | 0,3025 |
  | 100 × 100 m | 1,00 ha | 2 | 0,50 |
  | 155 × 155 m | 2,40 ha | 6 | 0,4004 |
  | 316 × 316 m | 10,0 ha | 25 | 0,3994 |
  | 2 puntos a 200 m | 1,26 ha | 3 | 0,4216 |

  Además: un solo punto → 1 celda de 63,2 × 63,2 m (0,4 ha); el identificador es `r{fila}c{columna}`;
  toda la relación de aspecto de las celdas queda entre 0,4 y 2,5; todo punto cae dentro de su
  celda; un área de 400 ha produce 400 celdas con `adjusted = true` y `targetAreaHa = 1`;
  `buildGrid([])` es `null`.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — exactamente el algoritmo del diseño §7.2:

  1. proyectar los puntos con `lat0` = latitud media;
  2. caja envolvente; **solo los ejes con dispersión cero** se expanden hasta
     `s = √(targetAreaHa·10 000)` m centrados en los puntos (un solo punto → caja `s × s`); un eje
     con dispersión mayor que cero se deja igual, porque estirarlo inventaría área medida;
  3. `A = ancho × alto`; candidatos `floor(A/objetivo)` y `ceil(A/objetivo)`, sin repetir, mínimo 1;
  4. por candidato, factorizar `n` en `filas × columnas`; el par califica si la relación de
     aspecto de la celda (`max(lado)/min(lado)`) queda entre 0,4 y 2,5;
  5. gana el par con el área de celda más cerca del objetivo; el parecido con el cuadrado solo
     desempata; si ningún par califica, una sola fila o una sola columna, la que más se parezca a la
     caja;
  6. celdas rectangulares alineadas al norte, sin recorte;
  7. `id = r{fila}c{columna}`;
  8. si `n > 400`: `targetAreaHa = A / 400`, se recalcula una sola vez y `adjusted = true`.

  Desempate determinista: primero el área, luego el parecido con el cuadrado, luego `columns ≥ rows`.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (12 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: malla automatica de celdas desde los puntos"`

---

### Task 3: Calidad de la posición del bastón

**Files:**
- Create: `src/domain/geo/position.ts`
- Test: `tests/domain/geo/position.test.ts`

**Interfaces:**
- Produces:
  - `type PositionQuality = 'buena' | 'aceptable' | 'imprecisa' | 'ninguna'`
  - `interface MeasurementPosition { latLon: LatLon | null; quality: PositionQuality;
    hdop: number | null; satellites: number | null; fixAgeS: number | null }`
  - `GOOD_HDOP_MAX = 2`, `ACCEPTABLE_HDOP_MAX = 5`
  - `readPosition(payload: CapturePayload, positionValid: boolean): MeasurementPosition`

- [ ] **Step 1: Escribir las pruebas** — `positionValid = true` con HDOP 1,5 → `buena`; HDOP 3 →
  `aceptable`; HDOP 7 → `imprecisa`; HDOP ausente → `aceptable` (no se afirma calidad que no se
  sabe); `positionValid = false` con coordenadas → `ninguna` y `latLon = null`; coordenadas nulas →
  `ninguna`; coordenadas `0,0` → `ninguna`; el HDOP nunca se convierte a metros (el valor sale
  tal cual).

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — TypeScript puro. El HDOP es una convención de GPS: se muestra, no
  se interpreta como distancia.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (8 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: calidad de la posicion segun el GPS del baston"`

---

### Task 4: Dictamen por celda

**Files:**
- Create: `src/domain/geo/cell-verdict.ts`
- Test: `tests/domain/geo/cell-verdict.test.ts`

**Interfaces:**
- Consumes: `DiagnosisResult`, `AptitudeClass`, `DiagnosisVariable` del dominio de diagnóstico.
- Produces:
  - `type CellState = 'sin_dato' | 'un_punto' | 'resumen' | 'no_concluyente'`
  - `interface CellDiagnosisInput { measurementId: string; valid: boolean; diagnosis: DiagnosisResult | null }`
  - `interface ClassGroup { classes: readonly AptitudeClass[]; count: number }`
  - `interface CellVerdict { state: CellState; classes: readonly AptitudeClass[];
    groups: readonly ClassGroup[]; validPoints: number; invalidPoints: number; reason: string | null }`
  - `verdictForCell(inputs: readonly CellDiagnosisInput[]): CellVerdict`
  - `interface VariableSummary { variable: DiagnosisVariable; unit: string; median: number;
    min: number; max: number; points: number }`
  - `summarizeVariables(diagnoses: readonly DiagnosisResult[]): readonly VariableSummary[]`

- [ ] **Step 1: Escribir las pruebas** — celda vacía → `sin_dato`; una medición válida → `un_punto`
  con sus clases; dos mediciones con la misma clase → `resumen`; dos con clases distintas →
  `no_concluyente` con los grupos y sus conteos (3 S1 y 1 S3 → dos grupos, no un promedio); un
  punto con dos clases posibles → `un_punto` con dos clases (no se colapsa); una medición sin
  diagnóstico → `no_concluyente` con motivo `sin_diagnostico`; un diagnóstico bloqueado →
  `no_concluyente` con motivo `diagnostico_bloqueado`; uno con datos insuficientes →
  `no_concluyente`; las mediciones inválidas no entran al dictamen pero se cuentan;
  `summarizeVariables` da mediana y mínimo–máximo de la humidity de tres puntos.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — el estado sale de los diagnósticos guardados, nunca de un cálculo
  propio: la celda **no** promedia clases ni elige la peor. Dos puntos con el mismo conjunto de
  clases (incluido el mismo par “entre S1 y S2”) sí producen `resumen`.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (10 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: dictamen por celda con clases coincidentes"`

---

### Task 5: Migración 5, medición con sesión y almacén de paquetes

**Files:**
- Modify: `src/infrastructure/db/migrations.ts`, `src/infrastructure/db/sqlite-stores.ts`,
  `src/domain/measurement/types.ts`, `src/ports/stores/measurement-store.ts`,
  `src/ports/stores/capture-store.ts`, `src/application/capture/ingest-capture.ts`,
  `src/ui/providers/app-context.ts`
- Create: `src/ports/stores/map-package-store.ts`
- Test: `tests/infrastructure/db/migrations.test.ts` (modificar),
  `tests/infrastructure/db/map-package-store.test.ts` (nuevo),
  `tests/application/capture/ingest-capture.test.ts` (modificar)

**Interfaces:**
- Produces:
  - migración 5:
    ```sql
    ALTER TABLE measurements ADD COLUMN position_valid INTEGER;
    CREATE TABLE map_packages (
      id TEXT PRIMARY KEY, file_name TEXT NOT NULL, path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL, imported_at TEXT NOT NULL, deleted_at TEXT
    );
    ```
  - `Measurement` gana `sessionId: string | null` y `positionValid: boolean`.
  - `MeasurementStore` gana `setPlotId(id, plotId)`, `setSessionId(id, sessionId)` y
    `setPositionValid(id, positionValid)`.
  - `CaptureStore` gana `listAll(): Promise<RawCapture[]>`.
  - `interface MapPackage { id; fileName; path; sizeBytes; importedAt; deletedAt }` y
    `MapPackageStore { insert; get; list; listAll; markDeleted; remove }`.
  - `AppStores` gana `mapPackages: MapPackageStore`.

- [ ] **Step 1: Escribir las pruebas** — la lista de migraciones es `[1,2,3,4,5]`; la 5 crea
  `map_packages` y agrega `position_valid`; la 5 no modifica las anteriores; sobre SQLite real:
  guardar un paquete y leerlo; `list()` no trae los borrados y `listAll()` sí; `markDeleted` deja
  la fila con `deleted_at`; `remove` la borra; la medición guarda `session_id` y `position_valid`.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — `position_valid` se escribe desde `capture.flags.positionValid` en
  la inserción de la medición (así la bandera sobrevive a la captura: la reconstrucción a partir
  de las coordenadas no alcanza); `session_id` queda `null` hasta que la tarea 6 lo resuelva. La
  posición **no** se duplica: se lee de `payload_json`.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (10 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: migracion 5 con la bandera de posicion y los paquetes de mapa"`

---

### Task 6: Lote y sesión de cada captura

**Files:**
- Create: `src/application/capture/resolve-capture-assignment.ts`
- Modify: `src/application/capture/ingest-capture.ts`,
  `src/application/sync/ingest-synced-records.ts`, `src/application/sync/sync-from-stick.ts`,
  `src/application/sync/import-csv.ts`, `app/measure.tsx`
- Test: `tests/application/capture/resolve-capture-assignment.test.ts` (nuevo),
  `tests/application/capture/ingest-capture.test.ts` (modificar),
  `tests/application/sync/ingest-synced-records.test.ts` (modificar)

**Interfaces:**
- Produces:
  - `interface CaptureAssignment { plotId: string | null; sessionId: string | null }`
  - `resolveCaptureAssignment(input: { plotCode: string | null; configId: number;
    fallbackPlotId?: string | null }, deps: { farms: FarmStore; sessions: SessionStore }):
    Promise<CaptureAssignment>`
  - `ingestCapture` acepta `sessionId?: string | null` y guarda `positionValid`.

- [ ] **Step 1: Escribir las pruebas** — la asignación resuelve por `plotCode` cuando ese lote
  existe; por `configId` → `session.plotId` cuando no hay `plotCode`; sin coincidencia queda
  `null`; un `plotCode` que no existe cae a la sesión; el lote de la sesión debe existir también;
  `ingestCapture` guarda el `session_id` recibido; un registro sincronizado con `loteId` conocido
  queda en su lote y con el `session_id` de su `configId`; la captura en vivo guarda la sesión que
  resolvió la pantalla de medición. La bandera `position_valid` ya se guarda desde la tarea 5 y no
  se toca aquí.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — la regla del diseño §8.4, en este orden: `plotCode` → sesión por
  `configId` → sin lote. En `app/measure.tsx` la sesión se resuelve **antes** de la ingesta y se
  reutiliza para el diagnóstico, para que el punto y su diagnóstico usen el mismo contexto.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (10 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: las capturas guardan su lote y su sesion"`

---

### Task 7: Relleno de lo ya guardado

**Files:**
- Create: `src/application/capture/backfill-measurement-context.ts`
- Modify: `src/ui/providers/app-provider.tsx` (correr el relleno al arrancar)
- Test: `tests/application/capture/backfill-measurement-context.test.ts`

**Interfaces:**
- Produces:
  - `interface BackfillResult { checked: number; plotAssigned: number; sessionAssigned: number }`
  - `backfillMeasurementContext(deps: { captures; measurements; farms; sessions }): Promise<BackfillResult>`

- [ ] **Step 1: Escribir las pruebas** — una captura vieja sin lote y con `configId` de una sesión
  guardada recibe el lote de la sesión; una captura con `plotCode` válido recibe ese lote; una
  captura sin coincidencias queda como estaba; el relleno es idempotente (la segunda vuelta no
  cambia nada y no cuenta asignaciones); el contenido de la captura no se toca; una medición vieja
  recibe la bandera `position_valid` que tenía su captura.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — corre al arrancar la app, después de las migraciones. Cambia
  `captures.plot_id`, `measurements.plot_id`, `measurements.session_id` y
  `measurements.position_valid`: metadato, no contenido.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (6 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: relleno del lote y la sesion de lo ya guardado"`

---

### Task 8: Diagnósticos que faltan

**Files:**
- Create: `src/application/map/ensure-plot-diagnoses.ts`
- Test: `tests/application/map/ensure-plot-diagnoses.test.ts`

**Interfaces:**
- Consumes: `diagnoseMeasurement` de `src/application/diagnosis/diagnose-measurement.ts`.
- Produces:
  - `interface EnsurePlotDiagnosesResult { diagnosed: number; withoutSession: number;
    invalid: number; failed: number }`
  - `ensurePlotDiagnoses(plotId: string, deps: { measurements; diagnoses; sessions; farms;
    thresholds; clock; newId }): Promise<EnsurePlotDiagnosesResult>`

- [ ] **Step 1: Escribir las pruebas** — una medición del lote sin diagnóstico se diagnostica con
  la **sesión de su `config_id`** (la sesión guardada, no la del lote actual: el contexto de la
  prueba lo demuestra); no recalcula lo que ya tiene diagnóstico; sin sesión no escribe nada y
  cuenta `withoutSession`; una medición inválida no se diagnostica; es idempotente; un fallo
  puntual se cuenta y no lanza.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — reusa `diagnoseMeasurement`; el diagnóstico guardado es inmutable
  con sus cuatro versiones; cada escritura es independiente (idempotente por
  `listByMeasurement`).

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (7 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: completa los diagnosticos que faltan con su sesion"`

---

### Task 9: Modelo de pantalla del lote

**Files:**
- Create: `src/application/map/describe-plot-space.ts`
- Test: `tests/application/map/describe-plot-space.test.ts`

**Interfaces:**
- Produces:
  - `interface PlotSpacePoint { measurement: Measurement; position: MeasurementPosition;
    diagnosis: DiagnosisResult | null; cellId: string | null }`
  - `interface PlotSpaceCell { cell: GridCell; verdict: CellVerdict;
    summary: readonly VariableSummary[]; measurementIds: readonly string[] }`
  - `interface SpaceAlertGroup { code: string; severity: 'blocking' | 'warning' | 'info';
    message: string; count: number; firstMeasurementId: string | null }`
  - `interface PlotSpace { plot: Plot; grid: Grid | null; cells: readonly PlotSpaceCell[];
    points: readonly PlotSpacePoint[]; counts: {...}; alerts: readonly SpaceAlertGroup[];
    recordAlerts: readonly SpaceAlertGroup[] }`
  - `describePlotSpace(plotId: string, deps: { farms; measurements; diagnoses }): Promise<PlotSpace>`

- [ ] **Step 1: Escribir las pruebas** — el conteo: celdas con dato, sin dato y no concluyentes;
  puntos, sin posición, fuera del área e inválidos; las celdas vacías aparecen con
  `state = sin_dato`; una celda con dos clases distintas queda `no_concluyente`; los puntos se
  listan del más reciente al más antiguo; las alertas del motor se agrupan por código y gravedad,
  con `blocking` primero; los avisos de registro van en bloque aparte (“sin posición”, “posición
  imprecisa”, “fuera del área”, “mediciones inválidas”, “sin diagnóstico”); un lote sin mediciones
  devuelve `grid = null` y no rompe.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — la malla se arma con las mediciones **con posición** del lote
  (las inválidas también, porque el área medida es la que se midió; no entran al dictamen de las
  celdas). El resumen es un conteo, no un veredicto del lote.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (9 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: modelo de pantalla del lote con malla y dictamen"`

---

### Task 10: Paquetes de mapa offline (importar, activar, borrar)

**Files:**
- Create: `src/ports/map-package-files.ts`, `src/application/map/manage-map-packages.ts`,
  `src/infrastructure/maps/expo-map-package-files.ts`
- Modify: `src/ui/providers/app-provider.tsx` (cablear el servicio)
- Test: `tests/application/map/manage-map-packages.test.ts`

**Interfaces:**
- Produces:
  - `interface MapPackageFiles { sizeOf(uri): Promise<number>; availableSpaceBytes(): Promise<number>;
    copyIntoAppStorage(uri, fileName): Promise<{ path: string; sizeBytes: number }>;
    deleteAt(path): Promise<void>; existsAt(path): Promise<boolean> }`
  - `MAX_MAP_PACKAGE_BYTES = 200 * 1024 * 1024`
  - `ACTIVE_MAP_PACKAGE_KEY = 'active_map_package_id'`
  - `importMapPackage(input: { uri; fileName }, deps): Promise<MapPackage>`
  - `listMapPackages(deps)`, `deleteMapPackage(id, deps)`, `setActiveMapPackage(id | null, deps)`
  - `AppServices` gana `mapFiles: MapPackageFiles`

- [ ] **Step 1: Escribir las pruebas** — un archivo que no es `.pmtiles` se rechaza; uno mayor que
  el límite se rechaza con un mensaje claro; sin espacio suficiente se rechaza; el import copia
  el archivo, lo registra y lo deja activo si era el primero; borrar marca el paquete y elimina
  el archivo; borrar el paquete activo lo desactiva; listar no trae los borrados.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — la implementación real usa `expo-file-system` (`File`, `Paths`,
  `Paths.availableDiskSpace`); el puerto permite probar sin nativo.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (9 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: importar, activar y borrar paquetes de mapa"`

---

### Task 11: Estilo del mapa y apertura del archivo PMTiles

**Files:**
- Create: `src/infrastructure/maps/map-style.ts`, `src/infrastructure/maps/pmtiles-archive-store.ts`
- Test: `tests/infrastructure/maps/map-style.test.ts`

**Interfaces:**
- Produces:
  - `BASE_SOURCE_ID = 'base'`, `DETAIL_SOURCE_ID = 'detalle'`
  - `buildMapStyle(sources: { base: string | null; detalle: string | null }): StyleSpecification`
  - `assetArchiveUri(fileName: string): string` → `pmtiles://asset://<nombre>`
  - `fileArchiveUri(absolutePath: string): string` → `pmtiles://file://<ruta absoluta>`
  - `BASE_ARCHIVE_NAME = 'base.pmtiles'` (el paquete incluido con la app)

- [ ] **Step 1: Escribir las pruebas** — el estilo serializado **no** contiene `http://` ni
  `https://` (prueba de offline); con las dos fuentes, el estilo trae las dos y las capas del
  detalle van encima de las del base; con una sola, trae esa; sin fuentes, el estilo trae solo el
  fondo; no tiene `glyphs` ni `sprite` (no hay rótulos en el corte 3, y nada que se pida por red);
  `assetArchiveUri('base.pmtiles')` y `fileArchiveUri('/data/user/0/x/base.pmtiles')` dan las URIs
  exactas.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — dos fuentes vectoriales: la **base** (paquete incluido, cubre el
  país a zoom bajo) y la **detallada** (paquete importado, encima de la base). Donde el paquete
  detallado no alcanza, se ve la base: así el mapa nunca queda en blanco sin que haga falta saber
  los límites de cada archivo. Cada fuente lleva sus capas de `layers(fuente, namedFlavor('light'))`
  **sin** opciones de idioma (eso deja solo capas sin `symbol`, que no piden glifos).

  La forma de abrir el paquete base la decide el pincho (tarea 0): si `pmtiles://asset://` funcionó,
  se usa esa; si no, el archivo se copia una vez al almacenamiento privado y se usa
  `pmtiles://file://`. La decisión queda escrita en `docs/context/map.md` y en una constante del
  código, con el motivo al lado.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (8 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: estilo del mapa sobre fuentes pmtiles locales"`

---

### Task 12: Leyenda y mapa (con y sin teselas)

**Files:**
- Create: `src/ui/components/map/map-colors.ts`, `src/ui/components/map/map-legend.tsx`,
  `src/ui/components/map/plot-map.tsx`, `src/ui/components/map/fallback-map.tsx`
- Test: `tests/ui/components/map-legend.test.tsx`,
  `tests/ui/components/plot-map.test.tsx`, `tests/ui/components/fallback-map.test.tsx`

**Interfaces:**
- Produces:
  - `CLASS_COLORS: Record<AptitudeClass, string>` (`S1 #2E7D32`, `S2 #7CB342`, `S3 #F9A825`,
    `N #C62828`), `NO_DATA_COLOR = '#EDEAE0'`, `INCONCLUSIVE_COLOR = '#CFCBC0'`
  - `CLASS_LABELS: Record<AptitudeClass, string>` (Apto, Moderadamente apto, Marginalmente apto,
    No apto)
  - `<MapLegend classes={[...]} showTwoTone />`
  - `<PlotMap space={PlotSpace} baseUri={string | null} detailUri={string | null} onSelectCell
    onSelectPoint />`
  - `<FallbackMap space={PlotSpace} />`

- [ ] **Step 1: Escribir las pruebas** — la leyenda muestra el texto de cada clase (el color no es
  el único canal); una celda vacía no recibe color de clase; la muestra de dos tonos aparece; sin
  paquete el respaldo dibuja el lienzo y se lee “Mapa sin teselas”; con paquete, el mapa MapLibre
  recibe las fuentes `pmtiles://` y un GeoJSON con una geometría por celda y una por punto (prueba
  con el módulo de MapLibre simulado).

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — MapLibre: `<Map mapStyle={...}>` con `<Camera initialViewState>`,
  `<GeoJSONSource>` + `<Layer>` de relleno y de borde para las celdas, y `<GeoJSONSource>` +
  `<Layer>` de círculo para los puntos. La geometría que se le pasa a MapLibre está en
  lon/lat: las celdas se convierten de metros locales a grados con `unprojectFromLocal` (la malla
  vive en metros; el mapa, en grados). Dos clases posibles: relleno con el color de la clase mejor
  y borde con el de la peor; el rótulo dice el rango completo. Posición imprecisa: anillo hueco.
  El respaldo usa la misma proyección local sobre `View` absolutos.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (8 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: mapa con celdas y puntos, y respaldo sin teselas"`

---

### Task 13: Detalle de celda, lista de puntos y pantalla de mapa

**Files:**
- Create: `src/ui/components/map/cell-sheet.tsx`, `src/ui/components/map/point-list.tsx`,
  `app/map.tsx`
- Test: `tests/ui/components/cell-sheet.test.tsx`, `tests/ui/components/point-list.test.tsx`

**Interfaces:**
- Produces: la hoja inferior de la celda (estado, área, clases y conteo, resumen numérico,
  lista de mediciones) y la lista de puntos (hora, posición o “sin posición”, calidad, clase,
  alertas); `app/map.tsx` con selector de lote, mapa, leyenda, resumen, alertas y lista.

- [ ] **Step 1: Escribir las pruebas** — la hoja de una celda `no_concluyente` muestra el conteo
  por clase y el motivo, y **no** muestra una clase única; la hoja de una celda `resumen` muestra
  mediana y mínimo–máximo; la lista muestra “sin posición” y “posición imprecisa” con texto; la
  pantalla pide los diagnósticos que faltan antes de dibujar (con un almacén de mentira que
  verifica la llamada).

- [ ] **Step 2: Ejecutar y verificar que fails** — Expected: FAIL.

- [ ] **Step 3: Implementar** — al abrir la pantalla: `ensurePlotDiagnoses` y después
  `describePlotSpace`; si el diagnóstico falla, el mapa abre igual y avisa; el resumen dice “N
  celdas: X con dato, Y sin dato, Z no concluyente · P puntos · Q sin posición”. La pantalla
  lleva el encabezado del lote (nombre, cultivo, unidad cartográfica y área declarada; si falta
  algo, un enlace para completarlo), el botón “encuadrar” (vuelve a los puntos) y la atribución
  del mapa, que nunca queda tapada. Las fuentes del mapa son la base incluida y el paquete
  detallado activo; si no hay paquete activo, solo la base, y un aviso que enlace a la pantalla
  de paquetes.

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (7 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: pantalla de mapa con detalle de celda y puntos"`

---

### Task 14: Pantalla de paquetes de mapa

**Files:**
- Create: `app/map-packages.tsx`
- Modify: `app/_layout.tsx`
- Test: `tests/ui/components/map-packages-screen.test.tsx`

**Interfaces:**
- Produces: pantalla con el paquete incluido, los importados, el activo, el botón de importar
  (`expo-document-picker`), el de borrar y el de activar.

- [ ] **Step 1: Escribir las pruebas** — la pantalla lista los paquetes con nombre y tamaño; al
  importar un archivo que no es `.pmtiles` avisa y no lo registra; al importar uno válido lo
  registra y lo activa; borrar pide confirmación y luego borra.

- [ ] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.

- [ ] **Step 3: Implementar** — `expo-document-picker` con `copyToCacheDirectory: true`; el
  archivo se copia al almacenamiento privado (nunca se apunta al caché temporal).

- [ ] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (6 pruebas).

- [ ] **Step 5: Commit** — `git commit -m "feat: pantalla de paquetes de mapa offline"`

---

### Task 15: Entrada al mapa, lote desde el historial, cierre y documentación

**Files:**
- Modify: `app/index.tsx`, `app/_layout.tsx`, `app/history.tsx`, `README.md`,
  `docs/architecture/estructura.md`, `docs/context/map.md`, `.harness/task.md`
- Create: `docs/adr/0003-mapa-offline-pmtiles.md`,
  `docs/architecture/mapa-y-malla.md`, `tests/integration/map-flow.test.ts`,
  `scripts/map/extract-pmtiles.mjs`, `assets/maps/README.md`

**Interfaces:**
- Produce: el botón “Mapa” en el inicio; la asignación de lote desde el historial (último
  recurso de la regla §8.4); el ADR del stack de mapa; el script de generación de paquetes.

- [ ] **Step 1: Escribir la prueba de integración** — sobre SQLite real: se crea finca, lote y
  sesión; se ingieren tres capturas con posición (dos en la misma celda y una en otra); se
  diagnostican; `describePlotSpace` devuelve la malla con las celdas esperadas y el estado de cada
  una; `ensurePlotDiagnoses` es idempotente; una captura sin posición no aparece en el mapa pero
  sí en la lista.

- [ ] **Step 2: Ejecutar y verificar que pasa** — Expected: PASS (3 pruebas).

- [ ] **Step 3: Navegación e historial** — botón “Mapa” en el inicio; en el historial, cada
  medición muestra su lote y las que no lo tienen pueden recibir uno con el selector de lotes
  existente; la asignación cambia `plot_id`, no el contenido.

- [ ] **Step 4: Script de generación de paquetes** — `scripts/map/extract-pmtiles.mjs` con
  `--source`, `--bbox` (oeste,sur,este,norte) y `--maxzoom`, que produce un `.pmtiles` a partir
  de un corte de Protomaps. Es una herramienta de **construcción**: usa internet una vez y el
  resultado se importa al celular. La caja y el zoom se validan antes de descargar. El paquete
  base incluido (Colombia, zoom bajo) se genera con el mismo script; nada queda cableado a un
  municipio.

- [ ] **Step 5: Documentar** — `docs/adr/0003-mapa-offline-pmtiles.md` (MapLibre + PMTiles + EAS
  Build, y por qué no una segunda librería de mapas), `docs/architecture/mapa-y-malla.md` (la malla,
  los estados de celda y el estilo), `docs/context/map.md` (mapa del repo actualizado),
  `docs/architecture/estructura.md` (módulos nuevos), `README.md` y `.harness/task.md` (cierre del
  corte 3).

- [ ] **Step 6: Verificación completa**

  ```powershell
  npm run check
  node .harness/bin/harness.mjs verify
  node .harness/bin/harness.mjs doctor
  npx eas-cli@latest build --profile preview --platform android
  ```

  Expected: todo exit 0, y el APK instalado abre el mapa con el paquete incluido.

- [ ] **Step 7: Commit** — `git commit -m "feat: cierre del corte 3 con mapa, malla y dictamen"`

---

## Self-Review

- **Cobertura del spec:** las tareas cubren el diseño §6 (pantallas), §7 (malla), §8 (posición y
  asignación de lote), §9 (dictamen por celda y diagnósticos faltantes), §10 (alertas), §11 (mapa
  offline), §12 (modelo de datos), §13 (módulos) y §14 (pruebas). El diseño §15 se resuelve en la
  tarea 0 (el pincho) y §16–§17 son decisiones ya tomadas. Quedan fuera de alcance, como el
  diseño dice: interpolación y mapa de calor (RF-APP-047, v2.0), gradientes calculados, perímetro
  del lote y resolución de la unidad cartográfica.
- **Pasos:** cada tarea tiene prueba → falla → implementa → pasa → commit, con comando y resultado
  esperado. La tarea 0 es un pincho de verificación (no hay prueba unitaria posible: la prueba es
  el APK en el teléfono) y su resultado queda escrito en `docs/context/map.md`.
- **Tipos:** `src/domain/geo` es puro y no importa nada de la app; `src/application/map` usa los
  puertos; MapLibre y PMTiles viven solo en `src/infrastructure` y `src/ui`; la base es SQLite y
  la malla no se guarda.
- **Review Focus:** los ocho riesgos del bloque de revisión tienen prueba obligatoria o
  verificación explícita: celda vacía sin color (tarea 12), clases sin promediar (tareas 4 y 9),
  sin posición (tareas 3 y 9), mapa sin red (tarea 11), diagnósticos con su sesión (tarea 8),
  malla recalculada (tareas 2 y 9), APK con `pmtiles://` (tarea 0) y lo sincronizado en su lote
  (tarea 6).
- **Proporción:** el esfuerzo está en el dominio geográfico (tareas 1 a 4), que es donde está el
  riesgo de inventar números, y en el pincho (tarea 0), que es donde está el riesgo de que el
  mapa no exista en el teléfono. La UI (tareas 12 a 14) es mecánica.
- **Riesgos asumidos y registrados:** el rótulo de lugares no entra en el corte 3 (haría falta
  empaquetar glifos); la migración 5 es aditiva y su reverso es `DROP TABLE map_packages;` y
  `ALTER TABLE measurements DROP COLUMN position_valid;`.
