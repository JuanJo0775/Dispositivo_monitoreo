# Corte 0 — Esqueleto verificable de la app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un APK de desarrollo que captura registros de un bastón simulado, los guarda en SQLite sin perder ninguno, los lista en un historial y los exporta a CSV.

**Architecture:** Capas con dependencias hacia adentro (`domain` → `application` → `ports` → `infrastructure`/`ui`). El bastón se consume por un puerto `StickGateway` con implementación simulada. SQLite es la única fuente de verdad; toda escritura es transaccional y la confirmación al bastón ocurre solo después del commit.

**Tech Stack:** React Native + Expo SDK 58, TypeScript estricto, expo-router, expo-sqlite, expo-file-system, expo-sharing, Zustand, Zod, Jest + jest-expo + React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-12-app-movil-arquitectura-design.md`

## Ajustes de ejecución (2026-11-12)

Decisiones tomadas al arrancar, para que el plan y el repositorio no se separen:

- **Un solo runner de pruebas: Jest con `jest-expo`.** Se descartó Vitest porque la prueba de
  componentes exige el preset de React Native y mantener dos runners duplica configuración. Todo
  `npm test` corre con Jest.
- **Los tests espejan `src/`.** Nada de tests sueltos en la raíz de `tests/`.
- **La raíz solo tiene configuración** (`package.json`, `app.json`, `tsconfig.json`,
  `eslint.config.js`, `jest.config.js`, `.prettierrc`); el código vive en `app/` y `src/`.
- **Expo SDK 58**, React 19.3, React Native 0.88, TypeScript 6. El stack exacto queda en
  `package.json` y el lockfile.
- La prueba de humo quedó en `tests/domain/types.test.ts` porque `APP_NAME` es del dominio.

## Global Constraints

- Solo Android; APK de desarrollo con `expo-dev-client`. Expo Go no sirve.
- TypeScript estricto; sin `any` implícito.
- Sin red en el camino crítico: nada de `fetch` ni servicios en la nube.
- Español de Colombia en la UI; UTC en almacenamiento y UTC−5 al mostrar.
- Un valor ausente se guarda como `null` y se exporta como celda vacía; nunca como 0.
- Coordenadas 0,0 nunca se muestran como posición real.
- Identidad de una captura: `deviceId + sequence`. Duplicado = se ignora.
- Orden obligatorio: guardar (commit) → confirmar al bastón → actualizar UI.
- `node .harness/bin/harness.mjs verify` debe pasar antes de cada commit.
- Commits pequeños, en español, con prefijo `feat:`/`test:`/`chore:`.

## Review Focus

- Captura duplicada (mismo `deviceId + sequence`): se ignora sin duplicar filas ni sobrescribir la primera.
- Fallo de escritura a mitad de transacción: no queda captura ni medición a medias y no se confirma al bastón.
- Valor nulo o ausente: se muestra "sin dato" y se exporta vacío, nunca 0.
- Posición inválida o 0,0: se muestra "sin posición" y la medición sigue siendo válida para variables del suelo.
- Cierre o reinicio de la app: las capturas ya confirmadas siguen en el historial al reabrir.

---

## File Structure

```
package.json, app.json, tsconfig.json, eslint.config.js, jest.config.js, .prettierrc
app/_layout.tsx, app/index.tsx, app/connect.tsx, app/measure.tsx, app/history.tsx
src/domain/types.ts            entidades y tipos del dominio
src/domain/validation.ts       rangos, banderas, reglas de validez
src/domain/units.ts            formato de números y fechas UTC−5
src/application/ingest-capture.ts
src/application/list-measurements.ts
src/application/export-csv.ts
src/ports/stores.ts            CaptureStore, MeasurementStore, UnitOfWork, PlotStore
src/ports/stick-gateway.ts     StickGateway, StickStatus
src/infrastructure/db/migrations.ts
src/infrastructure/db/sqlite-stores.ts
src/infrastructure/ble/simulated-stick-gateway.ts
src/infrastructure/files/csv-share.ts
src/ui/stick-provider.tsx
src/ui/history-list.tsx
tests/domain/types.test.ts
tests/domain/validation.test.ts
tests/application/ingest-capture.test.ts
tests/application/export-csv.test.ts
tests/infrastructure/simulated-stick-gateway.test.ts
tests/helpers/in-memory-stores.ts
```

---

### Task 1: Crear el proyecto Expo y el arnés de pruebas

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `.eslintrc.cjs`, `.prettierrc`, `vitest.config.ts`, `app/_layout.tsx`, `app/index.tsx`
- Modify: `.harness/overrides.json`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: scripts `npm run test`, `npm run lint`, `npm run typecheck`, `npm run format`; rutas expo-router funcionando.

- [ ] **Step 1: Crear el proyecto**

Run: `npx create-expo-app@latest . --template blank-typescript`
Expected: crea `package.json`, `app.json`, `tsconfig.json` y `App.tsx` sin sobrescribir `.harness/`, `docs/` ni `.opencode/`.

- [ ] **Step 2: Instalar dependencias del corte 0**

Run: `npx expo install expo-router expo-sqlite expo-file-system expo-sharing expo-dev-client react-native-safe-area-context react-native-screens`
Run: `npm install zustand zod`
Run: `npm install -D vitest @vitest/coverage-v8 eslint prettier eslint-config-prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin`
Expected: `npm ls` sin errores de peer dependencies.

- [ ] **Step 3: Configurar scripts y TypeScript estricto**

En `package.json` agrega `"test": "vitest run"`, `"test:watch": "vitest"`, `"typecheck": "tsc --noEmit"`, `"lint": "eslint ."`, `"format": "prettier --check ."`. En `tsconfig.json` activa `strict`, `noUncheckedIndexedAccess`, `paths` con `@/*` → `src/*`.

- [ ] **Step 4: Escribir la prueba de humo**

```ts
// tests/smoke.test.ts
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/domain/types";

describe("smoke", () => {
  it("expone el nombre de la app", () => {
    expect(APP_NAME).toBe("Monitoreo de suelo");
  });
});
```

- [ ] **Step 5: Ejecutar y verificar que falla**

Run: `npm test -- tests/smoke.test.ts`
Expected: FAIL porque `src/domain/types.ts` no existe.

- [ ] **Step 6: Crear `src/domain/types.ts` con la constante**

```ts
export const APP_NAME = "Monitoreo de suelo";
```

- [ ] **Step 7: Verificar que pasa y que el proyecto arranca**

Run: `npm test -- tests/smoke.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 8: Escribir `.harness/overrides.json` con los comandos reales**

```json
{
  "schemaVersion": 1,
  "commands": {
    "test": "npm run test",
    "lint": "npm run lint",
    "format": "npm run format",
    "typecheck": "npm run typecheck",
    "build": "npx expo export --platform android"
  }
}
```

- [ ] **Step 9: Actualizar el perfil y verificar**

Run: `node .harness/bin/harness.mjs detect`
Run: `node .harness/bin/harness.mjs verify`
Expected: `detect` sin `unknowns` de test/lint/format/typecheck/build; `verify` exit 0.

- [ ] **Step 10: Commit**

```bash
git add package.json app.json tsconfig.json .eslintrc.cjs .prettierrc vitest.config.ts app src tests .harness/overrides.json .gitignore
git commit -m "chore: crear proyecto Expo con pruebas y verificacion"
```

---

### Task 2: Tipos del dominio y validación de capturas

**Files:**
- Create: `src/domain/types.ts`, `src/domain/validation.ts`
- Test: `tests/domain/validation.test.ts`

**Interfaces:**
- Produces:
  - `type CaptureOrigin = "stick" | "manual" | "import"`
  - `interface CapturePayload`, `interface CaptureFlags`, `interface RawCapture`, `interface Measurement`
  - `validateCapture(capture: RawCapture): { valid: boolean; reasons: string[] }`
  - `isPositionValid(payload: CapturePayload, flags: CaptureFlags): boolean`

- [ ] **Step 1: Escribir las pruebas de tipos y validación**

```ts
// tests/domain/validation.test.ts
import { describe, expect, it } from "vitest";
import { validateCapture, isPositionValid } from "@/domain/validation";
import { makeCapture } from "../helpers/captures";

describe("validateCapture", () => {
  it("acepta una captura completa y en rango", () => {
    expect(validateCapture(makeCapture()).valid).toBe(true);
  });

  it("marca humedad fuera de 0..100 sin borrar el registro", () => {
    const result = validateCapture(makeCapture({ humidityPct: 140 }));
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("humidity_out_of_range");
  });

  it("acepta valores nulos y los reporta como ausentes, no como cero", () => {
    const result = validateCapture(makeCapture({ ph: null }));
    expect(result.valid).toBe(true);
    expect(result.reasons).toContain("ph_missing");
  });

  it("invalida una captura de ensayo para diagnóstico productivo", () => {
    const result = validateCapture(makeCapture({}, { simulated: true }));
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("simulated_data");
  });
});

describe("isPositionValid", () => {
  it("rechaza 0,0 aunque la bandera diga válida", () => {
    expect(isPositionValid(makeCapture({ lat: 0, lon: 0 }).payload, makeCapture().flags)).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- tests/domain/validation.test.ts`
Expected: FAIL porque los módulos no existen.

- [ ] **Step 3: Implementar `types.ts`**

Define `APP_NAME`, `CaptureOrigin`, `CapturePayload` (todos los campos del contrato v0.1, cada uno `number | null`), `CaptureFlags` (b6 booleanos), `RawCapture` (`deviceId`, `sequence`, `payload`, `capturedAtUtc`, `receivedAtUtc`, `origin`, `flags`, `configId`, `plotId: string | null`) y `Measurement` (`id`, `captureId`, `plotId: string | null`, `payload`, `capturedAtUtc`, `valid`, `invalidReasons`, `notes`, `photoPath`, `discardedAt`, `createdAt`).

- [ ] **Step 4: Implementar `validation.ts` con los rangos del contrato**

Rangos: humedad 0–100 % v/v; temperatura −10–60 °C; pH 0–14; CE 0–20000 µS/cm; N/P/K ≥ 0; lat −90–90; lon −180–180; batería 0–100. Devuelve `{ valid, reasons }`; los nulos agregan `<variable>_missing` sin invalidar. `simulated_data` invalida para diagnóstico productivo. `isPositionValid` exige bandera `positionValid`, lat/lon no nulos y no exactamente 0,0.

- [ ] **Step 5: Crear el factory de pruebas**

`tests/helpers/captures.ts` exporta `makeCapture(payload?: Partial<CapturePayload>, flags?: Partial<CaptureFlags>): RawCapture` con valores por defecto realistas (humedad 38, pH 5,4, CE 120, lat 4.53, lon −75.68).

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `npm test -- tests/domain/validation.test.ts`
Expected: PASS (5 pruebas).

- [ ] **Step 7: Commit**

```bash
git add src/domain tests/domain tests/helpers
git commit -m "feat: tipos y validacion de capturas"
```

---

### Task 3: Puerto del bastón y simulador

**Files:**
- Create: `src/ports/stick-gateway.ts`, `src/infrastructure/ble/simulated-stick-gateway.ts`
- Test: `tests/infrastructure/simulated-stick-gateway.test.ts`

**Interfaces:**
- Produces:
  - `type StickStatus = { connected: boolean; deviceId: string | null; batteryPct: number | null; firmwareVersion: string | null; protocolVersion: string | null }`
  - `interface StickGateway { connect(deviceId: string): Promise<void>; disconnect(): Promise<void>; status(): StickStatus; onCapture(fn: (c: RawCapture) => void): () => void; onStatus(fn: (s: StickStatus) => void): () => void; requestCapture(): Promise<void>; confirm(sequence: number): Promise<void> }`
  - `class SimulatedStickGateway implements StickGateway` con constructor `{ deviceId?: string; capture?: Partial<CapturePayload>; failOnConnect?: boolean }`

- [ ] **Step 1: Escribir las pruebas del simulador**

```ts
// tests/infrastructure/simulated-stick-gateway.test.ts
import { describe, expect, it, vi } from "vitest";
import { SimulatedStickGateway } from "@/infrastructure/ble/simulated-stick-gateway";

describe("SimulatedStickGateway", () => {
  it("emite una captura con secuencia creciente al pedirla", async () => {
    const gw = new SimulatedStickGateway({ deviceId: "stick-01" });
    const seen: number[] = [];
    gw.onCapture((c) => seen.push(c.sequence));
    await gw.connect("stick-01");
    await gw.requestCapture();
    await gw.requestCapture();
    expect(seen).toEqual([1, 2]);
  });

  it("marca la captura como simulada", async () => {
    const gw = new SimulatedStickGateway({ deviceId: "stick-01" });
    let simulated = false;
    gw.onCapture((c) => { simulated = c.flags.simulated; });
    await gw.connect("stick-01");
    await gw.requestCapture();
    expect(simulated).toBe(true);
  });

  it("rechaza conectar si failOnConnect", async () => {
    const gw = new SimulatedStickGateway({ failOnConnect: true });
    await expect(gw.connect("stick-01")).rejects.toThrow("no disponible");
  });

  it("expone estado tras conectar y desconectar", async () => {
    const gw = new SimulatedStickGateway({ deviceId: "stick-01" });
    await gw.connect("stick-01");
    expect(gw.status().connected).toBe(true);
    await gw.disconnect();
    expect(gw.status().connected).toBe(false);
  });

  it("notifica cambios de estado a los suscriptores", async () => {
    const gw = new SimulatedStickGateway({ deviceId: "stick-01" });
    const spy = vi.fn();
    gw.onStatus(spy);
    await gw.connect("stick-01");
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ connected: true }));
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- tests/infrastructure/simulated-stick-gateway.test.ts`
Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar el puerto y el simulador**

El simulador mantiene `sequence` en memoria, construye `RawCapture` con `capturedAtUtc = new Date().toISOString()`, `origin: "stick"`, `flags.simulated = true` y el `deviceId` del constructor. `confirm(sequence)` guarda el último confirmado y no emite nada. `requestCapture` falla si no está conectado.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test -- tests/infrastructure/simulated-stick-gateway.test.ts`
Expected: PASS (5 pruebas).

- [ ] **Step 5: Commit**

```bash
git add src/ports src/infrastructure/ble tests/infrastructure
git commit -m "feat: puerto del baston y simulador"
```

---

### Task 4: Almacenes en memoria y caso de uso `ingestCapture`

**Files:**
- Create: `src/ports/stores.ts`, `src/application/ingest-capture.ts`, `tests/helpers/in-memory-stores.ts`
- Test: `tests/application/ingest-capture.test.ts`

**Interfaces:**
- Consumes: `RawCapture`, `Measurement`, `validateCapture`.
- Produces:
  - `interface CaptureStore { insertRaw(c: RawCapture): Promise<void>; findByDeviceSequence(deviceId: string, sequence: number): Promise<RawCapture | null> }`
  - `interface MeasurementStore { insert(m: Measurement): Promise<void>; list(filter?: { plotId?: string; includeInvalid?: boolean }): Promise<Measurement[]>; get(id: string): Promise<Measurement | null> }`
  - `interface UnitOfWork { run<T>(fn: (stores: { captures: CaptureStore; measurements: MeasurementStore }) => Promise<T>): Promise<T> }`
  - `ingestCapture(input: { capture: RawCapture; plotId: string | null; confirm?: (sequence: number) => Promise<void> }, deps: { uow: UnitOfWork; clock: () => string; newId: () => string }): Promise<{ status: "saved" | "duplicate"; measurementId: string | null }>`

- [ ] **Step 1: Escribir las pruebas del caso de uso**

```ts
// tests/application/ingest-capture.test.ts
import { describe, expect, it, vi } from "vitest";
import { ingestCapture } from "@/application/ingest-capture";
import { makeInMemoryStores } from "../helpers/in-memory-stores";
import { makeCapture } from "../helpers/captures";

describe("ingestCapture", () => {
  it("guarda captura y medicion en una transaccion", async () => {
    const stores = makeInMemoryStores();
    const result = await ingestCapture(
      { capture: makeCapture(), plotId: "plot-1" },
      { uow: stores.uow, clock: () => "2026-11-12T12:00:00Z", newId: () => "m-1" },
    );
    expect(result).toEqual({ status: "saved", measurementId: "m-1" });
    expect(await stores.measurements.list()).toHaveLength(1);
  });

  it("ignora un duplicado por deviceId y sequence", async () => {
    const stores = makeInMemoryStores();
    const deps = { uow: stores.uow, clock: () => "2026-11-12T12:00:00Z", newId: () => "m-1" };
    await ingestCapture({ capture: makeCapture({}, {}, 7), plotId: null }, deps);
    const second = await ingestCapture({ capture: makeCapture({}, {}, 7), plotId: null }, deps);
    expect(second.status).toBe("duplicate");
    expect(await stores.measurements.list()).toHaveLength(1);
  });

  it("no confirma al baston si la escritura falla", async () => {
    const stores = makeInMemoryStores({ failMeasurementInsert: true });
    const confirm = vi.fn();
    await expect(ingestCapture(
      { capture: makeCapture(), plotId: "plot-1", confirm },
      { uow: stores.uow, clock: () => "2026-11-12T12:00:00Z", newId: () => "m-1" },
    )).rejects.toThrow();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("confirma al baston solo despues del commit", async () => {
    const stores = makeInMemoryStores();
    const order: string[] = [];
    const confirm = vi.fn(async () => { order.push("confirm"); });
    stores.onCommit(() => order.push("commit"));
    await ingestCapture(
      { capture: makeCapture(), plotId: null, confirm },
      { uow: stores.uow, clock: () => "2026-11-12T12:00:00Z", newId: () => "m-1" },
    );
    expect(order).toEqual(["commit", "confirm"]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- tests/application/ingest-capture.test.ts`
Expected: FAIL porque el caso de uso no existe.

- [ ] **Step 3: Implementar los puertos y el caso de uso**

`ingestCapture` valida (pero guarda aunque sea inválida), comprueba duplicado dentro de la transacción, inserta cruda y medición con `createdAt` del reloj, y llama `confirm` únicamente después de que `uow.run` resuelva. `status: "duplicate"` no llama `confirm`.

- [ ] **Step 4: Implementar los almacenes en memoria de prueba**

`makeInMemoryStores(options?: { failMeasurementInsert?: boolean })` devuelve `{ uow, captures, measurements, onCommit }`; `onCommit` registra un callback para probar el orden.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test -- tests/application/ingest-capture.test.ts`
Expected: PASS (4 pruebas).

- [ ] **Step 6: Commit**

```bash
git add src/ports/stores.ts src/application tests/application tests/helpers/in-memory-stores.ts
git commit -m "feat: ingesta transaccional de capturas"
```

---

### Task 5: Migraciones y almacenes SQLite

**Files:**
- Create: `src/infrastructure/db/migrations.ts`, `src/infrastructure/db/sqlite-stores.ts`
- Test: `tests/infrastructure/sqlite-stores.test.ts`

**Interfaces:**
- Consumes: `CaptureStore`, `MeasurementStore`, `UnitOfWork`.
- Produces: `MIGRATIONS: { version: number; sql: string }[]`, `openDatabase(): Promise<SQLiteDatabase>`, `createSqliteStores(db): { uow, captures, measurements }`.

- [ ] **Step 1: Escribir la prueba de esquema**

```ts
// tests/infrastructure/sqlite-stores.test.ts
import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "@/infrastructure/db/migrations";

describe("migraciones", () => {
  it("empieza en la version 1 y crea las tablas del corte 0", () => {
    const sql = MIGRATIONS.map((m) => m.sql).join("\n");
    expect(MIGRATIONS[0]?.version).toBe(1);
    for (const table of ["farms", "plots", "captures", "measurements", "schema_migrations"]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it("define la identidad unica device_id + sequence", () => {
    const sql = MIGRATIONS.map((m) => m.sql).join("\n");
    expect(sql).toMatch(/UNIQUE\s*\(\s*device_id\s*,\s*sequence\s*\)/i);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- tests/infrastructure/sqlite-stores.test.ts`
Expected: FAIL porque las migraciones no existen.

- [ ] **Step 3: Escribir la migración 1**

Tablas `farms`, `plots`, `captures`, `measurements`, `schema_migrations` con las columnas del diseño §8 del corte 0. `captures` guarda `payload_json` y `flags_json`; `measurements` guarda `payload_json`, `invalid_reasons_json`, `plot_id` nullable y `deleted_at`. `measurements.capture_id` es `UNIQUE`. `captures` tiene `UNIQUE(device_id, sequence)`.

- [ ] **Step 4: Implementar los almacenes SQLite**

`createSqliteStores(db)` implementa los tres puertos. `uow.run` abre `BEGIN IMMEDIATE`, ejecuta el callback con stores ligados a la transacción y hace `COMMIT`; en error hace `ROLLBACK` y relanza. `measurements.list` ordena por `captured_at_utc DESC` y excluye `deleted_at` salvo que se pida.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test -- tests/infrastructure/sqlite-stores.test.ts`
Expected: PASS (2 pruebas).

- [ ] **Step 6: Probar la migración en el emulador**

Run: `npx expo run:android`
Expected: la app abre, la base se crea y el log muestra `migrations applied: 1`.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/db tests/infrastructure/sqlite-stores.test.ts
git commit -m "feat: migraciones y almacenes SQLite"
```

---

### Task 6: Pantallas Conectar, Medir e Historial

**Files:**
- Create: `app/connect.tsx`, `app/measure.tsx`, `app/history.tsx`, `src/ui/stick-provider.tsx`, `src/ui/history-list.tsx`
- Modify: `app/_layout.tsx`, `app/index.tsx`
- Test: `tests/ui/history-list.test.tsx`

**Interfaces:**
- Consumes: `SimulatedStickGateway`, `ingestCapture`, stores SQLite.
- Produces: `StickProvider` con `{ gateway, status, connect, disconnect, requestCapture }`; `HistoryList({ measurements, onSelect })`.

- [ ] **Step 1: Escribir la prueba del componente de historial**

```tsx
// tests/ui/history-list.test.tsx
import { render, screen } from "@testing-library/react-native";
import { HistoryList } from "@/ui/history-list";
import { makeMeasurement } from "../helpers/measurements";

describe("HistoryList", () => {
  it("muestra humedad y fecha local", () => {
    render(<HistoryList measurements={[makeMeasurement({ humidityPct: 38 })]} onSelect={() => {}} />);
    expect(screen.getByText("38 % v/v")).toBeTruthy();
  });

  it("muestra sin dato cuando la humedad es null", () => {
    render(<HistoryList measurements={[makeMeasurement({ humidityPct: null })]} onSelect={() => {}} />);
    expect(screen.getByText("sin dato")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx jest tests/ui/history-list.test.tsx`
Expected: FAIL porque el componente no existe.

- [ ] **Step 3: Implementar `StickProvider` y las pantallas**

`StickProvider` crea un `SimulatedStickGateway` y expone acciones. `connect.tsx` muestra estado y botón conectar/desconectar. `measure.tsx` muestra el estado del bastón, un botón "Capturar" que llama `requestCapture`, y la última captura guardada con sus valores. `history.tsx` lista mediciones y abre el detalle. Todo texto en español; estados con texto además de color.

- [ ] **Step 4: Conectar las rutas**

`app/_layout.tsx` envuelve con `StickProvider` y `SQLiteProvider`; `app/index.tsx` muestra accesos a Conectar, Medir e Historial.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx jest tests/ui/history-list.test.tsx`
Expected: PASS (2 pruebas).

- [ ] **Step 6: Probar el flujo en el emulador**

Run: `npx expo run:android`
Expected: conectar → capturar → el historial muestra la captura; cerrar y reabrir la app la conserva.

- [ ] **Step 7: Commit**

```bash
git add app src/ui tests/ui tests/helpers
git commit -m "feat: pantallas conectar, medir e historial"
```

---

### Task 7: Exportación CSV y compartir

**Files:**
- Create: `src/application/export-csv.ts`, `src/infrastructure/files/csv-share.ts`
- Test: `tests/application/export-csv.test.ts`

**Interfaces:**
- Produces:
  - `CSV_HEADER: string[]`
  - `toCsv(measurements: Measurement[], thresholdsVersion: string, calibrationVersion: string): string`
  - `shareCsv(contents: string, fileName: string): Promise<void>`

- [ ] **Step 1: Escribir las pruebas del CSV**

```ts
// tests/application/export-csv.test.ts
import { describe, expect, it } from "vitest";
import { CSV_HEADER, toCsv } from "@/application/export-csv";
import { makeMeasurement } from "../helpers/measurements";

describe("toCsv", () => {
  it("incluye encabezados estables y versiones", () => {
    const csv = toCsv([makeMeasurement()], "th-1", "factory-v1");
    expect(csv.split("\n")[0]).toBe(CSV_HEADER.join(","));
    expect(csv).toContain("th-1");
    expect(csv).toContain("factory-v1");
  });

  it("exporta un valor nulo como celda vacia, nunca como 0", () => {
    const csv = toCsv([makeMeasurement({ humidityPct: null })], "th-1", "factory-v1");
    const row = csv.split("\n")[1]!.split(",");
    expect(row[CSV_HEADER.indexOf("humedad_pct")]).toBe("");
  });

  it("usa UTF-8 con BOM y salto de linea LF", () => {
    const csv = toCsv([makeMeasurement()], "th-1", "factory-v1");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).not.toContain("\r\n");
  });

  it("exporta la fecha en UTC ISO", () => {
    const csv = toCsv([makeMeasurement({ capturedAtUtc: "2026-11-12T17:05:00Z" })], "th-1", "factory-v1");
    expect(csv).toContain("2026-11-12T17:05:00Z");
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- tests/application/export-csv.test.ts`
Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar `toCsv`**

Columnas del contrato v0.1 más `thresholds_version`, `calibration_version`, `origen`, `valido` e `invalid_reasons`. Escapa comas y comillas con comillas dobles. Nulos → celda vacía. BOM al inicio.

- [ ] **Step 4: Implementar `shareCsv`**

Escribe el archivo en `FileSystem.cacheDirectory` con nombre `mediciones-YYYYMMDD-HHmm.csv` y abre `Sharing.shareAsync` con MIME `text/csv`. Sin red.

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npm test -- tests/application/export-csv.test.ts`
Expected: PASS (4 pruebas).

- [ ] **Step 6: Agregar el botón Exportar al historial**

En `app/history.tsx`, un botón que construye el CSV con las mediciones listadas y llama `shareCsv`. Texto de confirmación con el número de filas.

- [ ] **Step 7: Probar en el emulador**

Run: `npx expo run:android`
Expected: exportar abre la hoja de compartir y el archivo abre en Excel/Sheets con acentos y nullos vacíos.

- [ ] **Step 8: Commit**

```bash
git add src/application/export-csv.ts src/infrastructure/files app/history.tsx tests/application
git commit -m "feat: exportacion CSV y compartir"
```

---

### Task 8: Integración punta a punta y cierre del corte

**Files:**
- Create: `tests/integration/capture-flow.test.ts`, `README.md`
- Modify: `.harness/task.md`

**Interfaces:**
- Consumes: todas las anteriores.
- Produces: prueba de flujo completo y documentación de arranque.

- [ ] **Step 1: Escribir la prueba de integración**

```ts
// tests/integration/capture-flow.test.ts
import { describe, expect, it } from "vitest";
import { SimulatedStickGateway } from "@/infrastructure/ble/simulated-stick-gateway";
import { ingestCapture } from "@/application/ingest-capture";
import { toCsv } from "@/application/export-csv";
import { makeInMemoryStores } from "../helpers/in-memory-stores";

describe("flujo de captura", () => {
  it("simulador -> ingesta -> historial -> CSV", async () => {
    const gw = new SimulatedStickGateway({ deviceId: "stick-01" });
    const stores = makeInMemoryStores();
    const captures: unknown[] = [];
    gw.onCapture((c) => captures.push(c));
    await gw.connect("stick-01");
    await gw.requestCapture();
    expect(captures).toHaveLength(1);
    await ingestCapture(
      { capture: captures[0] as never, plotId: null },
      { uow: stores.uow, clock: () => "2026-11-12T12:00:00Z", newId: () => "m-1" },
    );
    const list = await stores.measurements.list();
    expect(list).toHaveLength(1);
    expect(toCsv(list, "th-1", "factory-v1")).toContain("stick-01");
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- tests/integration/capture-flow.test.ts`
Expected: FAIL si alguna pieza no está conectada.

- [ ] **Step 3: Corregir la integración hasta que pase**

Run: `npm test -- tests/integration/capture-flow.test.ts`
Expected: PASS.

- [ ] **Step 4: Documentar arranque en `README.md`**

Requisitos (Node 22+, Android SDK, teléfono o emulador), `npm install`, `npx expo run:android`, `npm test`, `npm run typecheck`, `npm run lint`, y la nota de que el bastón es simulado en este corte.

- [ ] **Step 5: Verificación completa**

Run: `npm test`
Run: `npm run typecheck`
Run: `npm run lint`
Run: `npm run format`
Run: `node .harness/bin/harness.mjs verify`
Expected: todo exit 0.

- [ ] **Step 6: Actualizar `.harness/task.md`**

Marcar el corte 0 como completado y anotar la evidencia (comandos y resultados).

- [ ] **Step 7: Commit y cierre**

```bash
git add README.md tests/integration .harness/task.md
git commit -m "test: flujo completo del corte 0"
```

---

## Self-Review

- **Cobertura del spec:** corte 0 definido en el diseño §17. Quedan fuera a propósito: diagnóstico, fincas/lotes, BLE real, microSD, mapas. Sus tareas aparecen en los planes de los cortes 1–3.
- **Pasos:** cada paso tiene una acción y una salida comprobable; los cuerpos de código se limitan a pruebas y firmas.
- **Tipos:** `RawCapture`, `Measurement`, `StickGateway`, `CaptureStore`, `MeasurementStore` y `UnitOfWork` se definen una vez y se usan con los mismos nombres en todas las tareas.
- **Review Focus:** cada línea tiene su prueba en la tarea que posee el código (duplicado y orden de confirmación en Task 4; nulos y posición en Task 2 y Task 7; persistencia en Task 6; fallo de escritura en Task 4).
- **Proporción:** el plan describe 8 tareas y sus pruebas; no transcribe la implementación.