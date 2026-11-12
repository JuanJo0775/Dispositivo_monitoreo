# Corte 2 — BLE real y sincronización por microSD

> Diseño aprobado para construir. Contrato de datos: página de Notion
> «🔌 Contrato de datos ESP32 ↔ App (propuesta v0.1)». Diseño general:
> `docs/superpowers/specs/2026-11-12-app-movil-arquitectura-design.md` (§11 BLE, §12 microSD).

**Objetivo:** que la app hable BLE con el bastón real y sincronice los registros de la microSD,
resumiendo, sin duplicar y avisando de conflictos, aunque el prototipo físico todavía no exista.

**Decisiones con la persona (2026-11-12):** cifrado de carga útil **más** cifrado de enlace;
biblioteca `react-native-ble-plx`; alcance completo con simulador fiel al contrato, sincronización
por bloques e importación manual de CSV.

---

## 1. Alcance

### 1.1 Entra en el corte 2

1. Capa de protocolo pura: tramas, CRC-16, códec del registro, mensajes por opcode.
2. Cifrado de carga útil (XChaCha20-Poly1305) con clave derivada de un PIN, más CRC.
3. Puerto de transporte BLE y su implementación real con `react-native-ble-plx`.
4. Simulador fiel al contrato: microSD con registros, MTU pequeño, CRC inválido, cortes de
   conexión, firmware incompatible y batería baja.
5. `BleStickGateway`: máquina de estados, configuración de sesión cifrada, captura en vivo,
   sincronización por bloques y confirmación del último id.
6. Sincronización reanudable con `sync_state`, deduplicación y aviso de conflicto.
7. Importación manual de CSV de la microSD con el mismo pipeline (RF-APP-042).
8. Pantalla de sincronización con progreso por registros confirmados.

### 1.2 No entra en el corte 2

Firmware del ESP32 (vive en otro repositorio). Dosis (corte 5). Mapas (corte 3). Calibración
individual (corte 4). Envío del resumen a la OLED: el mensaje queda implementado y probado, pero
depende del firmware.

---

## 2. Perfil BLE

Los UUID se **generaron** (UUID v4) y quedan congelados en
`src/domain/protocol/ble-profile.ts`, con la misma tabla en
`docs/architecture/protocolo-ble.md` para el equipo de firmware.

| Característica | UUID | Propiedades |
| --- | --- | --- |
| Servicio | `e962ff5a-2123-4b60-b472-27f62c97902e` | — |
| Captura | `e605f44c-0ec9-4bf1-9500-c4ed37e3fac2` | Notify |
| Estado | `5b8479b5-a08b-448c-b5a2-fcb0eaae1ee3` | Read, Notify |
| Sync · solicitud | `f1d9eaec-c057-4424-8430-8bbf8c0caa44` | Write |
| Sync · datos | `5f0bb6a2-26e0-4f05-a551-e37a02db2be2` | Notify |
| Sync · confirmación | `57f2fa6a-d641-4915-af5b-e4da1d334861` | Write |
| Configuración · escritura | `642892a2-1d00-469f-a6ef-0dcd5a6d4f29` | Write (cifrada) |
| Configuración · estado | `92294ea6-4878-4a50-bbdd-40ca5e0de562` | Read, Notify |
| Resumen · escritura | `43d59275-f1d6-4060-a89f-a8b65d97c7db` | Write (cifrada) |
| Control · escritura | `edd4b57c-3a7e-4f71-8b0b-c51c0ccd55c2` | Write (cifrada) |

Un solo cliente conectado a la vez. Versión de protocolo: `1`.

---

## 3. Trama y códec

### 3.1 Trama

```
byte 0     opcode
byte 1     versión del protocolo (1)
bytes 2-3  longitud del cuerpo (uint16 LE)
bytes 4-5  CRC-16/CCITT-FALSE del cuerpo
bytes 6..  cuerpo
```

El CRC va sobre los bytes tal como viajan (cifrados incluidos), para detectar Corruption de
transporte. La etiqueta AEAD protege el contenido en claro.

### 3.2 Opcodes

| Código | Mensaje | Característica | Cifrado |
| --- | --- | --- | --- |
| `0x01` | Captura (un registro) | Captura | no |
| `0x02` | Estado del bastón | Estado | no |
| `0x03` | Sync: solicitud «enviar desde N» | Sync · solicitud | no |
| `0x04` | Sync: bloque de registros | Sync · datos | no |
| `0x05` | Sync: confirmación del último id | Sync · confirmación | no |
| `0x06` | Configuración de sesión | Configuración · escritura | **sí** |
| `0x07` | Estado de la configuración | Configuración · estado | no |
| `0x08` | Resumen para la OLED | Resumen · escritura | **sí** |
| `0x09` | Control (capturar ahora, fijar hora) | Control · escritura | **sí** |

### 3.3 Sobre cifrado (XChaCha20-Poly1305)

```
sobre = [version:1][nonce:24][cifrado:n][etiqueta:16]
```

- Clave: 32 bytes, derivada con PBKDF2-HMAC-SHA256 de un PIN de 6 dígitos y una sal aleatoria de
  16 bytes que se intercambia al emparejar (dentro del enlace ya cifrado).
- Iteraciones: 100.000.
- El cuerpo de la trama cifrada es el sobre; el CRC se calcula sobre el sobre.
- Vectores de prueba: los produce la suite del dominio y quedan en
  `docs/architecture/protocolo-ble.md` para que el firmware use los mismos.

### 3.4 Códec del registro: línea CSV

El registro viaja como **una línea CSV con los encabezados del contrato**, igual que en el archivo
de la microSD. Así la importación manual de CSV y la sincronización BLE comparten un solo códec y
un solo pipeline (RF-APP-042).

Encabezados, en orden: `id_registro, device_id, fecha, hora_utc, lat, lon, alt_m, vel_kmh, sats,
hdop, edad_fix_s, prof_cm, config_id, cultivo, lote_id, fert_fecha, humedad_pct, temp_c, ph,
ce_uscm, n_mgkg, p_mgkg, k_mgkg, banderas, bat_pct, fw_ver`.

- Un dato sin valor es una celda vacía; su bandera lo indica. Nunca `0` por defecto.
- `banderas` es un entero con los bits b0–b5 del contrato.
- `id_registro` es el `sequence` del bastón y `device_id` su identificador: la identidad de la
  captura es `deviceId + sequence`, igual que en el corte 0.

---

## 4. Simulador fiel al contrato

`SimulatedStickDevice` implementa el lado del bastón sobre un transporte falso:

- microSD con registros pendientes, numeración consecutive desde 1;
- bloquea la sincronización por tamaño de bloque según el MTU negociado;
- sabe calcular el CRC y puede enviar uno inválido a propósito;
- corta la conexión en mitad de una transferencia;
- declara firmware y versión de protocolo (para probar el bloqueo por versión incompatible);
- reporta batería, estado de la microSD, señal del GPS y hora UTC;
- guarda la configuración de sesión en memoria no volátil simulada y la aplica a las capturas
  siguientes, incluso tras reconectar.

`SimulatedStickGateway` (el del corte 0) pasa a construirse sobre este dispositivo, de modo que
**la app usa hoy el mismo camino de código que usará con el bastón real**.

Escenarios que las pruebas deben cubrir: MTU pequeño, CRC inválido, corte de conexión a mitad de
bloque, firmware incompatible, batería baja, configuración no aceptada (CRC inválido) y
microSD llena.

---

## 5. Transporte BLE

Puerto `src/ports/ble-transport.ts`:

```ts
interface BleTransport {
  scan(options): Promise<BleScanResult[]>;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  discoverServices(): Promise<BleCharacteristic[]>;
  subscribe(characteristic, listener): Promise<void>;
  unsubscribe(characteristic): Promise<void>;
  write(characteristic, bytes, withResponse): Promise<void>;
  requestMtu(deviceId, mtu): Promise<number>;
  on(event, listener): Unsubscribe;
}
```

Dos implementaciones:

- `BlePlxTransport` (real) sobre `react-native-ble-plx`. El módulo nativo se carga con `require`
  diferido para que las pruebas y el bundle web no dependan de él.
- `FakeBleTransport` (simulador), que enruta las tramas al `SimulatedStickDevice`.

## 5.1 Máquina de estados del gateway

```
idle → scanning → connecting → discovering → ready
ready → configuring → ready
ready → capturing ↔ ready
ready → syncing → ready
ready → reconnecting → ready | error
error → idle (acción manual)
```

- Se escanea solo el servicio propio.
- Un solo cliente: si hay otro conectado, se rechaza con mensaje claro.
- Al conectar se verifica la versión mayor del protocolo: un cambio mayor bloquea (RF-APP-006).
- Cola serial de escrituras: una a la vez, para no perder el orden.

---

## 6. Sincronización por microSD

1. La app lee `sync_state` del dispositivo: `last_confirmed_sequence`.
2. Escribe **Sync · solicitud** con `desde = last_confirmed_sequence + 1`.
3. El bastón responde con bloques **Sync · datos** (cada bloque lleva su CRC).
4. La app valida el CRC del bloque. Si falla, lo descarta y vuelve a pedir desde el último id
   confirmado (la transferencia se reanuda sola).
5. Cada registro del bloque pasa por el mismo pipeline de ingesta que la captura en vivo:
   deduplicación por `device_id + id_registro`.
6. Si un id repetido llega con contenido distinto, **se conserva el primero y se avisa**
   (RF-APP-040).
7. La app escribe **Sync · confirmación** con el último id recibido y guardado.
8. La app persiste `sync_state` con ese id. El bastón no borra nada hasta recibir la confirmación.
9. El progreso se cuenta por **registros confirmados**, no por paquetes (RF-APP-041).

### 6.1 Modelo de datos (migración 4)

```sql
CREATE TABLE sync_state (
  device_id TEXT PRIMARY KEY,
  last_confirmed_sequence INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 6.2 Importación manual de CSV

`importCsvFromStick(contents, deps)`: mismo códec, misma deduplicación y mismo aviso de conflicto
que la sincronización BLE. Es la vía de verificación mientras no exista el prototipo.

---

## 7. Cifrado: enlace y carga útil

- **Enlace**: `react-native-ble-plx` con emparejamiento y PIN (LE Secure Connections).
- **Carga útil**: XChaCha20-Poly1305 sobre las tres características marcadas «cifrada» en el
  contrato.
- El PIN se pide en la app la primera vez que se empareja; la sal se genera al azar, viaja en el
  enlace ya cifrado y ambas partes la guardan.
- En el simulador, el PIN por defecto es `000000` y la sal fija, para que las pruebas sean
  deterministas.

---

## 8. Pantallas

| Ruta | Qué hace |
| --- | --- |
| `app/sync.tsx` | Estado de la conexión, progreso por registros confirmados, botón «Sincronizar» e «Importar CSV». |
| `app/connect.tsx` (modificada) | Escaneo, emparejamiento, estado del bastón y versión de firmware. |

---

## 9. Criterios de aceptación

1. Pruebas del dominio del protocolo:
   - ida y vuelta de cada mensaje;
   - CRC-16 con vectores conocidos;
   - códec del registro con las 27 columnas, celdas vacías y bits de bandera;
   - sobre cifrado: cifrar, descifrar, detectar un byte alterado y rechazar una clave distinta;
   - bloque de sincronización que respeta el MTU.
2. Pruebas del simulador fiel: microSD con registros, CRC inválido, corte de conexión, firmware
   incompatible, configuración no aceptada.
3. Pruebas de la sincronización de punta a punta: reanuda desde el último id confirmado, no
   duplica, avisa el conflicto con mismo id y distinto contenido y confirma al bastón.
4. Importación manual de CSV con el mismo pipeline y la misma deduplicación.
5. `npm test`, `npm run typecheck`, `npm run lint`, `npm run format` y `npm run build` en verde.
6. `docs/architecture/protocolo-ble.md` con los UUID, el formato de trama, el sobre cifrado y los
   vectores de prueba, para el equipo de firmware.

---

## 10. Vacíos y supuestos

- **Supuesto**: el firmware usará los UUID congelados y la versión de protocolo 1. Si cambian, es
  un cambio de versión del protocolo y una migración del lado del bastón.
- **Supuesto**: la clave del cifrado de carga útil se deriva del PIN con PBKDF2 y sal por
  emparejamiento. Queda como propuesta hasta que el equipo de firmware confirme; los vectores de
  prueba permiten verificar la interoperabilidad.
- **Vacío**: el firmware todavía no define cómo se comporta con la microSD llena ni cuánto borra
  tras la confirmación. La app asume que el bastón borra lo confirmado y que la microSD llena se
  reporta como error del dispositivo.
- **Vacío**: el detalle de la señal GPS y del estado de la microSD en la característica Estado es
  provisional; solo se usa para mostrar y para detectar batería baja.
