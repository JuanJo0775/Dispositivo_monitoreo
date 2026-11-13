# Corte 2 — BLE real y sincronización por microSD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Que la app hable BLE con el bastón real y sincronice los registros de la microSD con
reanudación, sin duplicar y avisando de conflictos, aunque el prototipo físico todavía no exista.

**Architecture:** El protocolo es TypeScript puro en `src/domain/protocol/` (tramas, CRC-16, códec
del registro, cifrado). El acceso a BLE es un puerto (`src/ports/ble-transport.ts`) con dos
implementaciones: la real sobre `react-native-ble-plx` y una falsa que monta un bastón simulado
fiel al contrato (con microSD). `BleStickGateway` implementa el puerto `StickGateway` sobre el
transporte; la sincronización es un caso de uso que reusa el pipeline de ingesta.

**Tech Stack:** React Native + Expo SDK 58, TypeScript estricto, `react-native-ble-plx`,
`@noble/ciphers` y `@noble/hashes` (cifrado puro, sin nativo), SQLite con expo-sqlite, Jest.

**Spec:** `docs/superpowers/specs/2026-11-12-corte-2-ble-microsd-design.md`

## Ajustes de ejecución (2026-11-12)

- **Jest, no Vitest.** Todo `npm test` corre con Jest y `jest-expo`.
- **El simulador pasa a ser fiel al contrato.** `SimulatedStickGateway` deja de generar capturas
  inventadas y se construye sobre `SimulatedStickDevice`, que tiene microSD, MTU, CRC, cortes de
  conexión y configuración en memoria no volátil simulada.
- **El registro viaja como línea CSV**, igual que en el archivo de la microSD, para que la
  importación manual y la sincronización BLE compartan códec y pipeline (RF-APP-042).
- **El módulo nativo de BLE se carga con `require` diferido** dentro del adaptador real, para que
  las pruebas no dependan del nativo.
- **El cifrado es de carga útil** (XChaCha20-Poly1305) más el de enlace del PIN, según la decisión
  de la persona.

## Global Constraints

- Sin red en el camino crítico; el BLE es local.
- TypeScript estricto; sin `any` implícito.
- Español de Colombia en la UI; UTC en almacenamiento y UTC−5 al mostrar.
- Un dato ausente se guarda como `null`; nunca como 0 ni cadena vacía en la base.
- Identidad de una captura: `deviceId + sequence`. Duplicado = se ignora; mismo id con distinto
  contenido = se conserva el primero y se avisa (RF-APP-040).
- Orden obligatorio: guardar (commit) → confirmar al bastón → actualizar UI.
- El bastón no borra hasta recibir la confirmación (RF-APP-039).
- El progreso se cuenta por registros confirmados, no por paquetes (RF-APP-041).
- `node .harness/bin/harness.mjs verify` debe pasar antes de cada commit.
- Commits pequeños, en español, con prefijo `feat:`/`test:`/`chore:`.

## Review Focus

- Trama con CRC alterado: se descarta y la transferencia se reanuda desde el último id confirmado.
- Bloque que no cabe en el MTU: se fragmenta y se reassambla sin perder registros.
- Clave cifrada distinta o un byte alterado: el mensaje se rechaza, no se guarda a medias.
- Id repetido con contenido distinto: el primero gana y la app avisa.
- Desconexión a mitad de bloque: al reconectar, la sincronización sigue donde iba.
- Configuración con CRC inválido: el bastón la rechaza y la app lo dice; no se da por buena.
- Versión mayor de protocolo: se bloquea la conexión con mensaje claro.

---

## File Structure

```
app/sync.tsx                     pantalla de sincronización
app/connect.tsx                  conexión, emparejamiento y estado
src/domain/protocol/
  ble-profile.ts                 UUIDs congelados y características
  frame.ts                       tramas, CRC-16 y opcodes
  record-codec.ts                códec del registro (línea CSV del contrato)
  messages.ts                    cuerpos de mensaje por opcode
  encryption.ts                  sobre XChaCha20-Poly1305 y derivación de clave
src/ports/ble-transport.ts       puerto de transporte BLE
src/ports/random-bytes.ts        fuente de bytes aleatorios
src/infrastructure/ble/
  ble-plx-transport.ts           transporte real (react-native-ble-plx)
  fake-ble-transport.ts          transporte falso
  simulated-stick-device.ts      bastón simulado fiel al contrato
  ble-stick-gateway.ts           gateway sobre el transporte
src/application/sync/
  sync-from-stick.ts             sincronización reanudable
  import-csv.ts                  importación manual de la microSD
src/infrastructure/db/migrations.ts   migración 4: sync_state
assets/                          sin cambios
tests/                           espejo de src/ y app/
```

---

### Task 1: Tramas, CRC-16 y perfil BLE

**Files:**
- Create: `src/domain/protocol/ble-profile.ts`, `src/domain/protocol/frame.ts`
- Test: `tests/domain/protocol/frame.test.ts`

**Interfaces:**
- Produces:
  - `BLE_SERVICE_UUID`, `BLE_CHARACTERISTICS` (captura, estado, syncSolicitud, syncDatos,
    syncConfirmacion, configEscritura, configEstado, resumenEscritura, controlEscritura).
  - `PROTOCOL_VERSION = 1`
  - `enum Opcode { Captura = 0x01, Estado = 0x02, SyncSolicitud = 0x03, SyncDatos = 0x04, SyncConfirmacion = 0x05, ConfigEscritura = 0x06, ConfigEstado = 0x07, ResumenEscritura = 0x08, ControlEscritura = 0x09 }`
  - `crc16(bytes: Uint8Array): number` (CCITT-FALSE)
  - `encodeFrame(opcode, body): Uint8Array`
  - `decodeFrame(bytes): { opcode, version, body }` (lanza si el CRC no cuadra)

- [x] **Step 1: Escribir las pruebas** — CRC con los vectores conocidos («123456789» → 0x29B1), ida y
  vuelta de una trama, rechazo de una trama con el CRC alterado, rechazo de una versión
  desconocida.
- [x] **Step 2: Ejecutar y verificar que falla** — Run: `npm test -- tests/domain/protocol`
  Expected: FAIL porque los archivos no existen.
- [x] **Step 3: Implementar** — TypeScript puro, sin dependencias.
- [x] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (8 pruebas).
- [x] **Step 5: Commit** — `git add src/domain/protocol tests/domain/protocol` ·
  `git commit -m "feat: tramas, CRC-16 y perfil BLE del contrato v0.1"`

---

### Task 2: Códec del registro (línea CSV del contrato)

**Files:**
- Create: `src/domain/protocol/record-codec.ts`
- Test: `tests/domain/protocol/record-codec.test.ts`

**Interfaces:**
- Produces:
  - `RECORD_HEADERS` (las 26 columnas del contrato, en orden)
  - `encodeRecord(record: StickRecord): string`
  - `decodeRecord(line: string): StickRecord`
  - `interface StickRecord { idRegistro; deviceId; fecha; horaUtc; lat; lon; altM; velKmh; sats;
    hdop; edadFixS; profCm; configId; cultivo; loteId; fertFecha; humedadPct; tempC; ph; ceUsCm;
    nMgKg; pMgKg; kMgKg; banderas; batPct; fwVer }` (todo `number | string | null`)
  - `flagsFromBits(bits: number): CaptureFlags` y `bitsFromFlags(flags): number`

- [x] **Step 1: Escribir las pruebas** — ida y vuelta de un registro completo; celdas vacías para
  los datos ausentes; los bits de bandera en las dos direcciones; un valor con coma decimal se
  conserva; una línea con columnas de menos se rechaza.
- [x] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.
- [x] **Step 3: Implementar** — los números con punto decimal (el archivo de la microSD usa punto);
  los vacíos nunca se rellenan.
- [x] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (8 pruebas).
- [x] **Step 5: Commit** — `git commit -m "feat: codec del registro en linea CSV del contrato"`

---

### Task 3: Cifrado de carga útil

**Files:**
- Create: `src/domain/protocol/encryption.ts`, `src/ports/random-bytes.ts`
- Test: `tests/domain/protocol/encryption.test.ts`

**Interfaces:**
- Produces:
  - `interface RandomBytes { bytes(length: number): Uint8Array }`
  - `deriveKey(pin: string, salt: Uint8Array): Uint8Array` (PBKDF2-HMAC-SHA256, 100.000 iteraciones)
  - `encryptPayload(key, body, nonce): Uint8Array` (sobre: versión 1, nonce 24, texto cifrado, etiqueta 16)
  - `decryptPayload(key, envelope): Uint8Array` (lanza si la etiqueta no cuadra)
  - `PAYLOAD_VERSION = 1`, `NONCE_BYTES = 24`, `TAG_BYTES = 16`, `KEY_BYTES = 32`

- [x] **Step 1: Escribir las pruebas** — ida y vuelta con una clave y un nonce fijos; un byte
  alterado se rechaza; una clave distinta se rechaza; el nonce nunca se repite dentro de una misma
  clave; la derivación da 32 bytes y cambia con la sal.
- [x] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.
- [x] **Step 3: Implementar** — `@noble/ciphers` (XChaCha20-Poly1305) y `@noble/hashes` (pbkdf2).
- [x] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (6 pruebas).
- [x] **Step 5: Commit** — `git commit -m "feat: cifrado de carga util con XChaCha20-Poly1305"`

---

### Task 4: Bastón simulado fiel al contrato

**Files:**
- Create: `src/infrastructure/ble/simulated-stick-device.ts`,
  `src/infrastructure/ble/fake-ble-transport.ts`, `src/ports/ble-transport.ts`
- Modify: `src/infrastructure/ble/simulated-stick-gateway.ts`
- Test: `tests/infrastructure/ble/simulated-stick-device.test.ts`

**Interfaces:**
- Consumes: el protocolo de las tareas 1 y 2.
- Produces:
  - `interface BleTransport { scan; connect; disconnect; discoverCharacteristics; subscribe;
    unsubscribe; write; requestMtu; on }`
  - `class SimulatedStickDevice` con microSD (`records`), configuración en memoria no volátil
    simulada, batería, firmware, versión de protocolo, MTU y una forma de inyectar fallos
    (CRC inválido, corte de conexión).
  - `makeFakeBleTransport(device): BleTransport`

- [x] **Step 1: Escribir las pruebas** — el dispositivo responde el estado; una captura trae el
  `config_id` y el contexto de la configuración activa; la configuración sobrevive a «reiniciar»
  el dispositivo; el bloque de sincronización cabe en el MTU y lleva CRC válido; con CRC inválido
  inyectado la trama se rechaza; un firmware con versión mayor bloquea.
- [x] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.
- [x] **Step 3: Implementar** — el simulador speaks el mismo protocolo que el firmware real.
- [x] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (10 pruebas).
- [x] **Step 5: Commit** — `git commit -m "feat: baston simulado fiel al contrato con microSD"`

---

### Task 5: Transporte BLE real

**Files:**
- Create: `src/infrastructure/ble/ble-plx-transport.ts`
- Modify: `package.json` (agrega `react-native-ble-plx`, `@noble/ciphers`, `@noble/hashes`)
- Test: `tests/infrastructure/ble/ble-plx-transport.test.ts`

**Interfaces:**
- Consumes: `BleTransport`.
- Produces: `class BlePlxTransport implements BleTransport` que traduce la API de
  `react-native-ble-plx` al puerto.

- [x] **Step 1: Escribir las pruebas** — con un doble de la biblioteca: el escaneo devuelve los
  dispositivos del servicio propio; conectar y descubrir expone las características; escribir
  entrega los bytes exactos; la MTU negociada se devuelve.
- [x] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.
- [x] **Step 3: Implementar** — el módulo nativo se carga con `require` diferido dentro del
  constructor, para que las pruebas no lo carguen.
- [x] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (6 pruebas).
- [x] **Step 5: Commit** — `git commit -m "feat: transporte BLE real sobre react-native-ble-plx"`

---

### Task 6: `BleStickGateway`

**Files:**
- Create: `src/infrastructure/ble/ble-stick-gateway.ts`
- Modify: `src/ports/stick-gateway.ts`
- Test: `tests/infrastructure/ble/ble-stick-gateway.test.ts`

**Interfaces:**
- Consumes: `BleTransport`, el protocolo, el cifrado y `SessionConfig`.
- Produces: `class BleStickGateway implements StickGateway` con la máquina de estados
  (idle, scanning, connecting, discovering, ready, configuring, capturing, syncing,
  reconnecting, error), `writeConfig` cifrado, captura en vivo y confirmación.

- [x] **Step 1: Escribir las pruebas** — conectar y descubrir deja el gateway en `ready`; una
  versión mayor de protocolo bloquea con mensaje; la configuración se escribe cifrada y el
  bastón la acepta; una configuración con CRC inválido se rechaza y se avisa; una captura en
  vivo llega al suscriptor; `confirm` llega al bastón.
- [x] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.
- [x] **Step 3: Implementar** — cola serial de escrituras; reconexión con espera creciente y
  límite; estado visible para la UI.
- [x] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (10 pruebas).
- [x] **Step 5: Commit** — `git commit -m "feat: gateway BLE con maquina de estados"`

---

### Task 7: Sincronización por microSD

**Files:**
- Create: `src/application/sync/sync-from-stick.ts`
- Modify: `src/infrastructure/db/migrations.ts` (migración 4: `sync_state`),
  `src/infrastructure/db/sqlite-stores.ts`, `src/ports/stores/`
- Test: `tests/application/sync/sync-from-stick.test.ts`

**Interfaces:**
- Consumes: `MeasurementStore`, `UnitOfWork`, `CaptureStore`, `ThresholdSet`.
- Produces:
  - `syncFromStick(input: { deviceId, fromSequence }, deps): Promise<SyncSummary>`
  - `interface SyncSummary { received; imported; duplicates; conflicts; lastConfirmedSequence }`
  - tabla `sync_state` con `device_id`, `last_confirmed_sequence`, `status`, `updated_at`

- [x] **Step 1: Escribir las pruebas** — sincroniza los registros pendientes; reanuda desde el
  último id confirmado; no duplica un id repetido; un id repetido con contenido distinto conserva
  el primero y devuelve el conflicto; confirma al bastón el último id; un bloque con CRC inválido
  se descarta y se reintenta desde el último confirmado.
- [x] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.
- [x] **Step 3: Implementar** — la ingesta va por el mismo camino que la captura en vivo.
- [x] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (8 pruebas).
- [x] **Step 5: Commit** — `git commit -m "feat: sincronizacion por microSD reanudable"`

---

### Task 8: Importación manual de CSV

**Files:**
- Create: `src/application/sync/import-csv.ts`
- Test: `tests/application/sync/import-csv.test.ts`

**Interfaces:**
- Produces: `importCsvFromStick(contents: string, deps): Promise<SyncSummary>` con el mismo
  pipeline y la misma deduplicación que la sincronización BLE (RF-APP-042).

- [x] **Step 1: Escribir las pruebas** — importa un CSV de la microSD; ignora las líneas repetidas;
  avisa el conflicto con mismo id y distinto contenido; una línea inválida se cuenta como error
  y no detiene la importación.
- [x] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.
- [x] **Step 3: Implementar** — sin dependencia del BLE.
- [x] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (6 pruebas).
- [x] **Step 5: Commit** — `git commit -m "feat: importacion manual de CSV de la microSD"`

---

### Task 9: Pantallas de conexión y sincronización

**Files:**
- Create: `app/sync.tsx`
- Modify: `app/connect.tsx`, `app/_layout.tsx`, `src/ui/providers/app-provider.tsx`
- Test: `tests/ui/components/sync-status.test.tsx`

**Interfaces:**
- Produces: la pantalla de sincronización con progreso por registros confirmados, botón
  «Sincronizar» y «Importar CSV»; y la de conexión con escaneo, emparejamiento con PIN y estado.

- [x] **Step 1: Escribir las pruebas** — el componente de estado muestra los registros confirmados
  y los duplicados en texto, no solo en color.
- [x] **Step 2: Ejecutar y verificar que falla** — Expected: FAIL.
- [x] **Step 3: Implementar** — con los casos de uso de las tareas 7 y 8.
- [x] **Step 4: Ejecutar y verificar que pasa** — Expected: PASS (5 pruebas).
- [x] **Step 5: Commit** — `git commit -m "feat: pantallas de conexion y sincronizacion"`

---

### Task 10: Integración, protocolo publicado y cierre

**Files:**
- Create: `tests/integration/sync-flow.test.ts`, `docs/architecture/protocolo-ble.md`
- Modify: `README.md`, `docs/context/map.md`, `docs/architecture/estructura.md`, `.harness/task.md`

- [x] **Step 1: Escribir la prueba de integración** — sobre SQLite real: se crea el bastón
  simulado con microSD, se sincroniza, se comprueba que los registros quedaron guardados y que el
  estado de sincronización quedó persistido; al reabrir la app, una sincronización nueva no
  duplica nada.
- [x] **Step 2: Ejecutar y verificar que pasa** — Expected: PASS (2 pruebas).
- [x] **Step 3: Verificación completa** — Run: `npm test` · `npm run typecheck` · `npm run lint` ·
  `npm run format` · `npm run build` · `node .harness/bin/harness.mjs verify`
  Expected: todo exit 0.
- [x] **Step 4: Documentar** — `docs/architecture/protocolo-ble.md` con los UUID, el formato de
  trama, el sobre cifrado y los vectores de prueba para el firmware; actualizar el mapa, la
  estructura, el README y `.harness/task.md`.
- [x] **Step 5: Commit** — `git commit -m "feat: cierre del corte 2 con BLE y sincronizacion"`

---

## Self-Review

- **Cobertura del spec:** las 10 tareas cubren el diseño §2 a §9; el firmware del ESP32 queda
  fuera del alcance de la app, con el protocolo publicado para el equipo que lo escribirá.
- **Pasos:** cada tarea tiene prueba → falla → implementa → pasa → commit, con comando y resultado.
- **Tipos:** el protocolo y el cifrado son puros; el BLE real y el simulado detrás del mismo puerto;
  la sincronización es un caso de uso que no sabe cómo se habla con el bastón.
- **Review Focus:** los siete puntos del spec que más riesgo tienen tienen prueba obligatoria en
  las tareas 4, 6, 7 y 10.
- **Proporción:** el esfuerzo está en el protocolo y el simulador fiel (tareas 1 a 4), que es donde
  está el riesgo; la UI es mecánica.
