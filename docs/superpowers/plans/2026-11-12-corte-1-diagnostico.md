# Corte 1 — Motor de diagnóstico y recorrido de campo mínimo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app cree fincas y lotes, configure una sesión con el bastón, mida y emita un
diagnóstico de aptitud del suelo con clases, intervalos, factor limitante, alertas y evidencia, todo
con los umbrales reales de la ciencia y sin internet.

**Architecture:** Capas con dependencias hacia adentro (`domain` → `application` → `ports` →
`infrastructure`/`ui`). El motor de diagnóstico es TypeScript puro en `src/domain/diagnosis/`: recibe
un set de umbrales versionado y devuelve un resultado con evidencia; no sabe nada de SQLite, de
React Native ni del bastón. Los umbrales son datos en `assets/thresholds/`, validados con Zod e
importados a la tabla `threshold_sets`. SQLite sigue siendo la única fuente de verdad.

**Tech Stack:** React Native + Expo SDK 58, TypeScript estricto, expo-router, expo-sqlite, Zod,
Jest + jest-expo + React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-corte-1-diagnostico-design.md`

## Ajustes de ejecución (2026-11-12)

- **El corte 1 se ejecuta con subagentes en paralelo**, uno por tarea independiente, porque las
  tareas 1 a 5 (dominio), 6 y 7 (datos), 8 y 9 (casos de uso) y 11 y 12 (UI) no se pisan. Las tareas
  10 y 13 son secuenciales porque dependen de todas las anteriores.
- **Jest, no Vitest.** Todo `npm test` corre con Jest y `jest-expo`.
- **Los tests espejan `src/`.** Nada de tests sueltos en la raíz de `tests/`.
- **El motor se prueba sin emulador y sin bastón**, con `node:sqlite` para la parte de datos.
- **Los números del set de umbrales salen de las tablas citadas en el spec.** Si una tabla no
  publica un valor, el motor lo dice; no se completa por analogía.
- El área `src/domain/session/` es nueva: se documenta en `docs/architecture/estructura.md` en el
  mismo commit.

## Global Constraints

- Solo Android; APK de desarrollo con `expo-dev-client`.
- TypeScript estricto; sin `any` implícito.
- Sin red en el camino crítico: nada de `fetch` ni servicios en la nube.
- Español de Colombia en la UI; UTC en almacenamiento y UTC−5 al mostrar.
- Un valor ausente se guarda como `null` y se exporta como celda vacía; nunca como 0.
- Identidad de una captura: `deviceId + sequence`. Duplicado = se ignora.
- Orden obligatorio: guardar (commit) → confirmar al bastón → actualizar UI.
- Ninguna clase única cuando el intervalo de la lectura cruza clases.
- Ningún umbral se inventa: lo que la ciencia no publica, el motor lo declara en
  `evidence.missing`.
- `node .harness/bin/harness.mjs verify` debe pasar antes de cada commit.
- Commits pequeños, en español, con prefijo `feat:`/`test:`/`chore:`.

## Review Focus

- Intervalo que cruza clases: se devuelven todas y **no** se elige una.
- Ley del mínimo: la clase la fija la variable más limitante; empates ordenados por aptitud.
- Restricciones duras: altitud, drenaje y validez temporal detienen el veredicto; la profundidad
  efectiva solo avisa porque no hay mínimo publicado.
- P y K: la app calcula su banda y su intervalo, y dice que no puede elegir clase; jamás los
  presenta como veredicto firme.
- N: se muestra siempre como **estimado** (ecuación 4 sobre la MO de la unidad cartográfica) y la
  lectura de la sonda se marca como «fuera de rango y de fracción».
- Humedad: el umbral sale de la unidad cartográfica y el cultivo, calculado con la ecuación 11 y
  contrastado con la tabla 15.
- La CE avisa con el umbral agronómico del cultivo y no invalida nada.
- Cada diagnóstico guarda las cuatro versiones y su evidencia.

---

## File Structure

```
assets/thresholds/2026.11-v1.json      set de umbrales versionado (tablas 1, 3, 8, 9, 13, 14, 15, 17, 35, 40)
app/farms.tsx                          lista de fincas y lotes
app/farm-form.tsx                      alta y edición de finca
app/plot-form.tsx                      alta y edición de lote
app/session.tsx                        configuración de sesión
app/diagnosis.tsx                      resultado del diagnóstico
app/settings.tsx                       ajustes mínimos
app/privacy.tsx                        aviso de privacidad
src/domain/farm/types.ts               Finca, Lote
src/domain/farm/validation.ts          validación de finca y lote
src/domain/session/types.ts            SessionConfig
src/domain/diagnosis/types.ts          contrato del motor
src/domain/diagnosis/threshold-set.ts  tipos y esquema Zod del set de umbrales
src/domain/diagnosis/suitability.ts    funciones de aptitud (ec. 34 a 36, 39) y clases (tabla 40)
src/domain/diagnosis/estimates.ts      ecuaciones 4, 5, 8, 12, 15 y factores de la tabla 6
src/domain/diagnosis/diagnose.ts       motor, fases 1 a 7
src/ports/clock.ts                     puerto de reloj
src/ports/stores/farm-store.ts         FincaStore
src/ports/stores/session-store.ts      SessionStore
src/ports/stores/diagnosis-store.ts    DiagnosisStore
src/ports/stores/settings-store.ts     SettingsStore
src/application/farm/save-farm.ts      alta y edición de finca
src/application/farm/save-plot.ts      alta y edición de lote
src/application/farm/list-farms.ts     lectura de fincas y lotes
src/application/session/start-session.ts   configuración de sesión y escritura al bastón
src/application/diagnosis/diagnose-measurement.ts  diagnóstico de una medición
src/application/diagnosis/recompute-diagnosis.ts   recálculo con el contexto original
src/application/settings/get-settings.ts
src/application/settings/set-trial-mode.ts
src/infrastructure/db/migrations.ts    migración 2: sessions, diagnoses, threshold_sets, settings
src/infrastructure/db/sqlite-stores.ts almacenes de fincas, lotes, sesiones, diagnósticos y ajustes
src/infrastructure/thresholds/load-threshold-set.ts  carga desde assets, Zod y checksum
src/infrastructure/ble/simulated-stick-gateway.ts   writeConfig y configId
src/ui/components/diagnosis-card.tsx    resultado de una variable y del diagnóstico
src/ui/components/field.tsx            campo de formulario con etiqueta
src/ui/components/plot-picker.tsx      selector de lote
tests/                                 espejo exacto de src/ y app/
```

---

### Task 1: Set de umbrales versionado con esquema Zod

**Files:**
- Create: `assets/thresholds/2026.11-v1.json`, `src/domain/diagnosis/threshold-set.ts`,
  `src/infrastructure/thresholds/load-threshold-set.ts`
- Test: `tests/domain/diagnosis/threshold-set.test.ts`,
  `tests/infrastructure/thresholds/load-threshold-set.test.ts`

**Interfaces:**
- Consumes: Zod.
- Produces:
  - `interface ThresholdSet { schemaVersion; version; source; crops; cartographicUnits; sampling; alerts }`
  - `interface CropThreshold { label; altitude?; drainage?; variables }`
  - `interface CartographicUnit { label; moPct; da; ccGravPct; pmpGravPct; caaVolPct; nTotalPct; nMineralizedKgHaYear; stressThresholdPct }`
  - `type VariableThreshold = BandThreshold | IncreasingThreshold | DecreasingThreshold | NoneThreshold`
  - `parseThresholdSet(raw: unknown): ThresholdSet` (lanza `ZodError` si el set no valida)
  - `loadThresholdSet(version: string): Promise<ThresholdSet>` (lee `assets/thresholds/<version>.json`)

- [ ] **Step 1: Escribir las pruebas del esquema y del set real**
  `tests/domain/diagnosis/threshold-set.test.ts` valida con Zod el JSON real: que los 5 cultivos
  estén, que las 5 unidades del Quindío estén, que el umbral de humedad de Chinchiná para café sea
  40,2, que el N de Buenavista sea 0,248 %, y que un set con una variable `kind: "none"`Unknown
  parsea. `tests/infrastructure/thresholds/load-threshold-set.test.ts` prueba que
  `loadThresholdSet('2026.11-v1')` devuelve el set y que una versión inexistente lanza.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/domain/diagnosis tests/infrastructure/thresholds`
  Expected: FAIL porque los archivos no existen.
- [ ] **Step 3: Implementar el JSON, los tipos y el cargador**
  El JSON lleva, textualmente, los valores de las tablas 1, 3, 8, 9, 13, 14, 15, 17, 35 y 40 tal
  como están en `docs/requirements/objetivo-1-umbrales-ecuaciones-motor.md`. Ningún valor se
  redondea ni se completa. El cargador usa `expo-asset`/require del asset y calcula el checksum
  SHA-256 del texto del archivo.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/domain/diagnosis tests/infrastructure/thresholds`
  Expected: PASS (8 pruebas).
- [ ] **Step 5: Commit**
  `git add assets src/domain/diagnosis src/infrastructure/thresholds tests/domain/diagnosis tests/infrastructure/thresholds`
  `git commit -m "feat: set de umbrales versionado con esquema Zod"`

---

### Task 2: Funciones de aptitud, clases e intervalos

**Files:**
- Create: `src/domain/diagnosis/suitability.ts`
- Test: `tests/domain/diagnosis/suitability.test.ts`

**Interfaces:**
- Consumes: `AptitudeClass` de `src/domain/diagnosis/types.ts`.
- Produces:
  - `bandSuitability(value, { optimal: [L, U], absoluteLower: m, absoluteUpper: M }): number`
  - `increasingSuitability(value, lowMedium: T1, mediumHigh: T2): number`
  - `decreasingSuitability(value, alertAbove): number`
  - `suitabilityInterval(value, uncertainty, suitabilityOf): { lower, upper }`
  - `classFromSuitability(s): AptitudeClass`
  - `classesFromInterval(interval): AptitudeClass[]`

- [ ] **Step 1: Escribir las pruebas**
  Casos límite exactos: banda con valor dentro de la banda devuelve 1; en el óptimo inferior
  devuelve 1 y un poco antes devuelve menos de 1; en el límite absoluto devuelve 0; creciente
  devuelve 0,5 en T1 y 1 en T2; `classFromSuitability` devuelve S1 en 0,75, S2 en 0,74, S3 en 0,25 y
  N en 0,24; `suitabilityInterval` toma el mínimo y el máximo de los dos extremos (ecuación 39) y
  `classesFromInterval` devuelve todas las clases posibles, ordenadas de S1 a N.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/domain/diagnosis/suitability.test.ts`
  Expected: FAIL porque el archivo no existe.
- [ ] **Step 3: Implementar las funciones puras**
  Sin dependencias. La banda se evalúa con la ecuación 34 por debajo de L y con la 35 por encima de
  U; fuera de los límites absolutos vale 0. La creciente usa la ecuación 36 y vale 0 en contenido
  cero. La decreciente vale 1 por debajo del umbral y decae linealmente.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/domain/diagnosis/suitability.test.ts`
  Expected: PASS (10 pruebas).
- [ ] **Step 5: Commit**
  `git add src/domain/diagnosis tests/domain/diagnosis`
  `git commit -m "feat: funciones de aptitud y clases de la tabla 40"`

---

### Task 3: Estimaciones y conversiones

**Files:**
- Create: `src/domain/diagnosis/estimates.ts`
- Test: `tests/domain/diagnosis/estimates.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `estimateNitrogenTotalPct(moPct: number): number` (ecuación 4)
  - `estimateCicCmolKg(moPct: number): number` (ecuación 5)
  - `volumetricCapacityField(ccGravPct: number, da: number): number` (ecuación 8)
  - `availableWaterPct(thetaV: number, ccV: number, pmpV: number): number` (ecuación 12)
  - `compensateEc(ecUsCm: number, temperatureC: number): number` (ecuación 15, devuelve dS/m)
  - `cmolKgToMgKg(value: number, factor: number): number` y `CONVERSION_FACTORS` (tabla 6)

- [ ] **Step 1: Escribir las pruebas**
  `estimateNitrogenTotalPct(14.33)` devuelve 0,535 y `estimateNitrogenTotalPct(5.54)` devuelve 0,248
  (valores de la tabla 8); `estimateCicCmolKg(14.33)` devuelve 28,17; `volumetricCapacityField(67.12,
  0.72)` devuelve 48,33 y `volumetricCapacityField(42.64, 0.82)` devuelve 35,0 (tabla 15);
  `availableWaterPct(28, 48,3, 28)` devuelve 0; `compensateEc(1100, 25)` devuelve 1,1 y
  `compensateEc(1100, 30)` devuelve 1,176 (ecuación 15); `cmolKgToMgKg(0,29, 390.98)` devuelve
  113,4 (tabla 13).
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/domain/diagnosis/estimates.test.ts`
  Expected: FAIL porque el archivo no existe.
- [ ] **Step 3: Implementar las ecuaciones puras**
  Solo aritmética; sin dependencias ni `Math` peculiaridades. Los factores de la tabla 6 van en
  `CONVERSION_FACTORS` con el valor publicado y una nota de la tabla donde salió.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/domain/diagnosis/estimates.test.ts`
  Expected: PASS (8 pruebas).
- [ ] **Step 5: Commit**
  `git add src/domain/diagnosis tests/domain/diagnosis`
  `git commit -m "feat: estimaciones de nitrogeno y conversiones de unidades"`

---

### Task 4: Motor, fases 1 y 2 (validez del dato y restricciones duras)

**Files:**
- Create: `src/domain/diagnosis/types.ts`, `src/domain/diagnosis/diagnose.ts`
- Test: `tests/domain/diagnosis/diagnose.test.ts`

**Interfaces:**
- Consumes: `CapturePayload`, `CaptureFlags`, `ThresholdSet`, `DiagnosisContext`.
- Produces:
  - `type AptitudeClass = 'S1' | 'S2' | 'S3' | 'N'`
  - `type VariableRole = 'verdict' | 'indicative' | 'reference'`
  - `interface DiagnosisInput { measuredAtUtc; payload; flags; context; calibrationVersion; firmwareVersion; thresholds }`
  - `interface DiagnosisResult { validity; classes; perVariable; limitingFactors; alerts; evidence; versions; explanation }`
  - `diagnose(input: DiagnosisInput): DiagnosisResult`

- [ ] **Step 1: Escribir las pruebas de las fases 1 y 2**
  Contexto de café en Chinchiná: altitud 2.500 m → `validity: 'blocked'` con alerta
  `altitud_fuera_de_franja`; altitud 1.800 m → no se bloquea; fecha de fertilización a 40 días →
  `blocked` con alerta `fuera_de_ventana_temporal`; a 200 días → no se bloquea; drenaje deficiente en
  aguacate Hass → `blocked` con alerta `drenaje_deficiente`; bandera `probeFault` → `blocked`;
  bandera `simulated` → no bloquea pero deja alerta `origen_ensayo`.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/domain/diagnosis/diagnose.test.ts`
  Expected: FAIL porque los archivos no existen.
- [ ] **Step 3: Implementar el contrato y las fases 1 y 2**
  `diagnose` arranca con las restricciones y, si alguna se activa, devuelve `validity: 'blocked'`
  con la alerta y sin clases. `evidence` arranca con `rules`, `assumptions` y `missing` vacíos para
  esta tarea.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/domain/diagnosis/diagnose.test.ts`
  Expected: PASS (7 pruebas).
- [ ] **Step 5: Commit**
  `git add src/domain/diagnosis tests/domain/diagnosis`
  `git commit -m "feat: motor de diagnostico con validez y restricciones duras"`

---

### Task 5: Motor completo, fases 3 a 7

**Files:**
- Modify: `src/domain/diagnosis/diagnose.ts`
- Test: `tests/domain/diagnosis/diagnose.test.ts`

**Interfaces:**
- Consumes: `bandSuitability`, `increasingSuitability`, `suitabilityInterval`,
  `classFromSuitability`, `classesFromInterval` y las estimaciones de la tarea 3.
- Produces: el mismo `diagnose(input)`, ahora con variables, factor limitante, clases y evidencia.

- [ ] **Step 1: Escribir las pruebas de las fases 3 a 7**
  Café en Chinchiná con humedad 38 % v/v, pH 5,4 y CE 120 µS/cm: la humedad entra al mínimo con
  clase S1; el pH devuelve intervalo porque ±0,3 cruza la banda; N estimado sale con la etiqueta
  «estimado» y la banda 0,34–0,58; P devuelve intervalo con la frase «no se puede elegir clase» y
  rol `indicative`; K devuelve banda en mg/kg con rol `indicative`; CE con 1.500 µS/cm devuelve
  alerta `ce_sobre_umbral` sin bloquear; el factor limitante es el de menor aptitud; la evidencia
  lista los supuestos usados (`humedad_limites_fisicos`, `ph_cafe_limite_inferior`,
  `ph_cafe_limite_superior`, `creciente_desde_cero`, `indice_parametrico_advertencia`) y los vacíos
  declarados; `versions` trae motor, umbrales, calibración y firmware.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/domain/diagnosis/diagnose.test.ts`
  Expected: FAIL con aserciones sobre variables y clases.
- [ ] **Step 3: Implementar las fases 3 a 7**
  La humedad usa el umbral de la unidad y el cultivo; el N estimado usa la ecuación 4 con la MO de
  la unidad; el P y el K usan su banda publicada y su incertidumbre; la CE solo avisa. El resultado
  ordena las variables, calcula el mínimo entre las de rol `verdict` y arma la explicación en
  lenguaje sencillo en español de Colombia.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/domain/diagnosis`
  Expected: PASS (todas las pruebas del motor).
- [ ] **Step 5: Commit**
  `git add src/domain/diagnosis tests/domain/diagnosis`
  `git commit -m "feat: motor de diagnostico completo con evidencia y factor limitante"`

---

### Task 6: Puertos y migración 2

**Files:**
- Create: `src/ports/clock.ts`, `src/ports/stores/farm-store.ts`,
  `src/ports/stores/session-store.ts`, `src/ports/stores/diagnosis-store.ts`,
  `src/ports/stores/settings-store.ts`
- Modify: `src/infrastructure/db/migrations.ts`
- Test: `tests/infrastructure/db/migrations.test.ts`

**Interfaces:**
- Consumes: `Measurement` del dominio.
- Produces:
  - `interface Clock { now(): string }`
  - `interface FarmStore { insertFarm; listFarms; getFarm; updateFarm; insertPlot; listPlots; getPlot; updatePlot }`
  - `interface SessionStore { insert; listByPlot; get; findByConfigId }`
  - `interface DiagnosisStore { insert; listByMeasurement; get }`
  - `interface SettingsStore { get; set; list }`
  - `interface StoredDiagnosis { id; measurementId; result: DiagnosisResult; createdAt }`

- [ ] **Step 1: Escribir las pruebas de la migración 2**
  Que la versión 2 exista y sea consecutiva; que cree `sessions`, `threshold_sets`, `diagnoses` y
  `settings`; que agregue `plots.cartographic_unit`; que `diagnoses.measurement_id` tenga índice; y
  que la migración 1 siga intacta.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/infrastructure/db/migrations.test.ts`
  Expected: FAIL porque la versión 2 no existe.
- [ ] **Step 3: Implementar la migración y los puertos**
  La migración 2 es aditiva; la 1 no se toca. Los puertos son solo tipos, sin código.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/infrastructure/db/migrations.test.ts`
  Expected: PASS (8 pruebas).
- [ ] **Step 5: Commit**
  `git add src/ports src/infrastructure/db tests/infrastructure/db`
  `git commit -m "feat: puertos de fincas, sesiones, diagnosticos y ajustes con migracion 2"`

---

### Task 7: Almacenes SQLite de fincas, lotes, sesiones, diagnósticos y ajustes

**Files:**
- Modify: `src/infrastructure/db/sqlite-stores.ts`
- Test: `tests/infrastructure/db/sqlite-stores.test.ts`

**Interfaces:**
- Consumes: `SqlDatabase`, los puertos de la tarea 6.
- Produces: `createSqliteStores(db)` devuelve además `farms`, `sessions`, `diagnoses` y `settings`.

- [ ] **Step 1: Escribir las pruebas sobre SQLite real**
  Guardar y leer una finca; guardar un lote con su unidad cartográfica; filtrar lotes por finca;
  marcar un lote como borrado y que no aparezca en la lista; guardar una sesión y recuperarla por
  `config_id`; guardar un diagnóstico con su resultado completo y recuperarlo por medición; leer y
  escribir ajustes; que un lote con `farm_id` inexistente falle por clave foránea.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/infrastructure/db/sqlite-stores.test.ts`
  Expected: FAIL porque los almacenes nuevos no existen.
- [ ] **Step 3: Implementar los almacenes**
  Mapeo de filas a tipos del dominio, con `JSON.parse` en los campos de JSON y `deleted_at` para el
  borrado lógico de lotes.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/infrastructure/db/sqlite-stores.test.ts`
  Expected: PASS (14 pruebas).
- [ ] **Step 5: Commit**
  `git add src/infrastructure/db tests/infrastructure/db`
  `git commit -m "feat: almacenes SQLite de fincas, sesiones, diagnosticos y ajustes"`

---

### Task 8: Casos de uso de finca y lote

**Files:**
- Create: `src/domain/farm/types.ts`, `src/domain/farm/validation.ts`,
  `src/application/farm/save-farm.ts`, `src/application/farm/save-plot.ts`,
  `src/application/farm/list-farms.ts`
- Test: `tests/application/farm/save-farm.test.ts`,
  `tests/application/farm/save-plot.test.ts`, `tests/application/farm/list-farms.test.ts`

**Interfaces:**
- Consumes: `FarmStore`, `Clock`.
- Produces:
  - `saveFarm(input: { id?: string; name: string }, deps): Promise<Farm>`
  - `savePlot(input: { id?: string; farmId: string; name: string; ... }, deps): Promise<Plot>`
  - `listFarms(deps): Promise<Farm[]>`, `listPlots(farmId: string | null, deps): Promise<Plot[]>`

- [ ] **Step 1: Escribir las pruebas**
  Una finca con nombre vacío se rechaza con un mensaje en español; guardar una finca devuelve la
  finca con identificador y marcas de tiempo; guardar un lote sin nombre se rechaza; un lote sin
  unidad cartográfica se acepta pero queda sin unidad; `listPlots(null)` devuelve todos los lotes
  vivos y `listPlots(farmId)` solo los de esa finca; un lote borrado lógicamente no aparece.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/application/farm`
  Expected: FAIL porque los archivos no existen.
- [ ] **Step 3: Implementar los casos de uso**
  Validación en el dominio; los casos de uso no conocen SQLite. `Clock` entra por puertos.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/application/farm`
  Expected: PASS (11 pruebas).
- [ ] **Step 5: Commit**
  `git add src/domain/farm src/application/farm tests/application/farm`
  `git commit -m "feat: casos de uso de finca y lote"`

---

### Task 9: Configuración de sesión y escritura al bastón

**Files:**
- Create: `src/domain/session/types.ts`, `src/application/session/start-session.ts`
- Modify: `src/ports/stick-gateway.ts`, `src/infrastructure/ble/simulated-stick-gateway.ts`
- Test: `tests/application/session/start-session.test.ts`,
  `tests/infrastructure/ble/simulated-stick-gateway.test.ts`

**Interfaces:**
- Consumes: `StickGateway`, `SessionStore`, `FarmStore`, `ThresholdSet`.
- Produces:
  - `interface SessionConfig { configId; plotId; cropPrimary; cropSecondary; depthCm; cartographicUnit; lastFertilizationDate; thresholdsVersion; createdAtUtc }`
  - `startSession(input, deps): Promise<Session>`
  - `StickGateway.writeConfig(config: SessionConfig): Promise<void>` (método nuevo del puerto)

- [ ] **Step 1: Escribir las pruebas**
  `startSession` con un lote y un cultivo del set crea la sesión con `config_id` creciente, la
  guarda y llama a `writeConfig` una sola vez; un lote sin unidad cartográfica se rechaza; un
  cultivo que no existe en el set de umbrales se rechaza; el simulador acepta `writeConfig` y a
  partir de ahí devuelve `configId` en las capturas y `plotId` en el payload.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/application/session tests/infrastructure/ble`
  Expected: FAIL porque el puerto y los archivos no existen.
- [ ] **Step 3: Implementar el caso de uso y el simulador**
  El `configId` es un contador que vive en el simulador; el puerto expone `writeConfig`. El
  simulador guarda la configuración activa y la adjunta a cada captura.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/application/session tests/infrastructure/ble`
  Expected: PASS (10 pruebas).
- [ ] **Step 5: Commit**
  `git add src/domain/session src/application/session src/ports src/infrastructure/ble tests`
  `git commit -m "feat: configuracion de sesion y escritura al baston"`

---

### Task 10: Diagnóstico de una medición, recálculo e importación del set

**Files:**
- Create: `src/application/diagnosis/diagnose-measurement.ts`,
  `src/application/diagnosis/recompute-diagnosis.ts`,
  `src/application/settings/get-settings.ts`, `src/application/settings/set-trial-mode.ts`
- Modify: `src/infrastructure/thresholds/load-threshold-set.ts`, `src/shared/versions.ts`,
  `src/infrastructure/ble/simulated-stick-gateway.ts`
- Test: `tests/application/diagnosis/diagnose-measurement.test.ts`,
  `tests/application/diagnosis/recompute-diagnosis.test.ts`,
  `tests/application/settings/set-trial-mode.test.ts`

**Interfaces:**
- Consumes: `Measurement`, `Session`, `DiagnosisStore`, `MeasurementStore`, `ThresholdSet`.
- Produces:
  - `diagnoseMeasurement(input, deps): Promise<DiagnosisResult | null>`
  - `recomputeDiagnosis(input, deps): Promise<DiagnosisResult>`
  - `getSettings(deps): Promise<Settings>`, `setTrialMode(enabled, deps): Promise<void>`
  - `ACTIVE_THRESHOLDS_VERSION` pasa de `'sin-umbrales'` a `'2026.11-v1'`

- [ ] **Step 1: Escribir las pruebas**
  Una medición con sesión y con umbrales activos produce diagnóstico guardado; sin sesión no se
  diagnostica y se devuelve `null`; el recálculo reutiliza el contexto original y crea una fila
  nueva sin tocar la anterior; el modo ensayo se guarda y se lee; al arrancar, el set se importa a
  `threshold_sets` con su checksum y no se reimporta si ya está.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/application/diagnosis tests/application/settings`
  Expected: FAIL porque los archivos no existen.
- [ ] **Step 3: Implementar los casos de uso**
  El diagnóstico se guarda en `diagnoses` con su evidencia y sus cuatro versiones. El recálculo
  lee el `context_snapshot_json` guardado y crea una fila nueva.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/application/diagnosis tests/application/settings`
  Expected: PASS (10 pruebas).
- [ ] **Step 5: Commit**
  `git add src/application src/infrastructure/thresholds src/shared/versions.ts tests`
  `git commit -m "feat: diagnostico de mediciones, recalculo e importacion del set de umbrales"`

---

### Task 11: Pantallas de fincas, lotes y sesión

**Files:**
- Create: `app/farms.tsx`, `app/farm-form.tsx`, `app/plot-form.tsx`, `app/session.tsx`,
  `src/ui/components/field.tsx`, `src/ui/components/plot-picker.tsx`
- Modify: `app/_layout.tsx`, `src/ui/providers/app-provider.tsx`
- Test: `tests/ui/components/field.test.tsx`, `tests/ui/components/plot-picker.test.tsx`

**Interfaces:**
- Consumes: los casos de uso de las tareas 8 y 9 y el contexto de la app.
- Produces: las cuatro rutas de expo-router y los componentes `Field` y `PlotPicker`.

- [ ] **Step 1: Escribir las pruebas de los componentes**
  `Field` muestra su etiqueta y su valor; `PlotPicker` lista los lotes y avisa cuando no hay
  ninguno; la etiqueta de la unidad cartográfica muestra el nombre de la unidad, no su identificador.
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/ui/components`
  Expected: FAIL porque los componentes no existen.
- [ ] **Step 3: Implementar las pantallas**
  Formularios con validación en línea en español, listas con `FlatList`, y la pantalla de sesión
  que muestra cultivo, unidad, profundidad y fecha de fertilización antes de escribir al bastón.
  Se registran las rutas nuevas en `app/_layout.tsx`.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/ui/components`
  Expected: PASS (6 pruebas).
- [ ] **Step 5: Commit**
  `git add app src/ui tests/ui`
  `git commit -m "feat: pantallas de fincas, lotes y configuracion de sesion"`

---

### Task 12: Pantalla de diagnóstico, ajustes y aviso de privacidad

**Files:**
- Create: `app/diagnosis.tsx`, `app/settings.tsx`, `app/privacy.tsx`,
  `src/ui/components/diagnosis-card.tsx`
- Modify: `app/_layout.tsx`, `app/measure.tsx`, `app/history.tsx`,
  `src/ui/providers/app-provider.tsx`
- Test: `tests/ui/components/diagnosis-card.test.tsx`

**Interfaces:**
- Consumes: `DiagnosisResult`, los casos de uso de las tareas 8 a 10.
- Produces: `DiagnosisCard`, las tres rutas nuevas y el resumen en la pantalla de medir.

- [ ] **Step 1: Escribir las pruebas del componente**
  `DiagnosisCard` muestra la clase o el intervalo de clases; muestra el factor limitante; muestra
  el rol de cada variable (`verdict`, `indicative`, `reference`) en texto; cuando la variable es
  indicativa por intervalo, muestra que no se puede elegir clase; un dato nulo se muestra como
  «sin dato».
- [ ] **Step 2: Ejecutar y verificar que falla**
  Run: `npm test -- tests/ui/components/diagnosis-card.test.tsx`
  Expected: FAIL porque el componente no existe.
- [ ] **Step 3: Implementar las pantallas**
  El aviso de privacidad se muestra al primer arranque desde `app/_layout.tsx` cuando
  `settings.privacy_notice_ack` no está, y siempre desde Ajustes. La pantalla de diagnóstico
  muestra clases, factor limitante, variables con su rol, alertas y evidencia.
- [ ] **Step 4: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/ui`
  Expected: PASS (todas las pruebas de UI).
- [ ] **Step 5: Commit**
  `git add app src/ui tests/ui`
  `git commit -m "feat: pantalla de diagnostico, ajustes y aviso de privacidad"`

---

### Task 13: Integración, verificación y cierre del corte

**Files:**
- Create: `tests/integration/diagnosis-flow.test.ts`
- Modify: `README.md`, `docs/context/map.md`, `docs/architecture/estructura.md`,
  `.harness/task.md`
- Test: `tests/integration/diagnosis-flow.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la prueba de punta a punta y la documentación al día.

- [ ] **Step 1: Escribir la prueba de integración**
  Sobre SQLite real: crear finca, crear lote en Chinchiná con café, iniciar sesión, capturar con el
  simulador, diagnosticar, comprobar que el diagnóstico tiene clase y evidencia, reabrir la base y
  ver el mismo diagnóstico. Y un segundo caso: una medición sin sesión no se diagnostica.
- [ ] **Step 2: Ejecutar y verificar que pasa**
  Run: `npm test -- tests/integration`
  Expected: PASS (2 pruebas).
- [ ] **Step 3: Verificación completa**
  Run: `npm test` · `npm run typecheck` · `npm run lint` · `npm run format` ·
  `node .harness/bin/harness.mjs verify` · `npm run build`
  Expected: todo exit 0 y el bundle de Android exportado.
- [ ] **Step 4: Documentación al día**
  `README.md` con el corte 1 en estado «listo»; `docs/context/map.md` con las filas `diagnostico`,
  `contexto-lote` y `exportacion` apuntando a las carpetas que ya existen;
  `docs/architecture/estructura.md` con el árbol real y el área nueva `src/domain/session/`;
  `.harness/task.md` con la evidencia.
- [ ] **Step 5: Commit**
  `git add README.md docs .harness/task.md tests/integration`
  `git commit -m "feat: cierre del corte 1 con integracion y documentacion"`

---

## Self-Review

- **Cobertura del spec:** las 13 tareas cubren el diseño §1.1 completo; el motor (tareas 2 a 5) cubre
  las fases 1 a 7 de la fuente y deja la fase 8 de dosis para el corte 5, como manda el spec.
- **Pasos:** cada tarea tiene prueba → falla → implementa → pasa → commit, con el comando literal y
  el resultado esperado.
- **Tipos:** los contratos del motor viven en `src/domain/diagnosis/types.ts`; los puertos son solo
  tipos; los casos de uso reciben `Clock` y los almacenes por puerto.
- **Review Focus:** los cinco puntos del spec que más riesgo tienen (intervalo que cruza clases, P y
  K sin veredicto firme, N como estimado, umbral de humedad por unidad cartográfica, CE como
  alerta y no veto) tienen prueba obligatoria en las tareas 5, 10 y 13.
- **Proporción:** el grueso del esfuerzo está en el dominio y los datos (tareas 1 a 7), que es donde
  está el riesgo científico; la UI (tareas 11 y 12) es la parte más mechanically verificable.
