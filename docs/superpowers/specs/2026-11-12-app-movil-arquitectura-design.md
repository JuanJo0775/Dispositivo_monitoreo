# Diseño de arquitectura — App móvil de monitoreo de suelo

Fecha: 2026-11-12 · Estado: borrador para aprobar · Nivel: grande (producto nuevo)

Fuente de requisitos: Notion "Dispositivo de monitoreo del suelo" (RF-APP-001..065,
RNF-APP-001..020, ADR-APP-001..017, contrato ESP32 ↔ App v0.1). Este documento no repite los
requisitos: decide cómo se construyen.

## 1. Intención y por qué

El bastón captura, la app interpreta. La app debe funcionar en campo, sin internet, con el teléfono
como única fuente de verdad: recibir capturas por BLE, guardarlas, diagnosticarlas contra umbrales
versionados, mostrar un resultado comprensible y exportarlo. La ciencia vive en tablas versionadas;
el firmware solo guarda datos crudos.

## 2. Objetivos

- Un APK Android que completa el recorrido de campo: vincular bastón → configurar sesión → medir →
  diagnosticar → historial → exportar.
- Cero dependencia de red en funciones centrales. Sin cuentas, sin servidor, sin nube en el MVP.
- Diagnóstico auditable y recalculable: datos crudos inmutables, versiones guardadas, incertidumbre
  explícita.
- Base para v1.0 sin reescribir: mapas offline, calibración, sincronización por microSD y reportes
  entran como módulos, no como parches.

## 3. No objetivos (MVP)

- iOS, web, tablet.
- Sincronización entre teléfonos o respaldo en nube.
- Cuentas, login, telemetría, analítica remota.
- Diagnóstico en el bastón (el bastón solo muestra el resumen que le manda la app).
- Recomendación de dosis (v2.0, requiere validación agronómica).
- Edición de valores crudos del sensor.

## 4. Anti-objetivos (fallaría aunque compile)

- Que una función central exija conexión.
- Que un diagnóstico pierda su versión de umbrales, calibración, motor o firmware.
- Que la app elija una clase única cuando la incertidumbre cruza clases.
- Que N estimado se muestre o exporte como medido.
- Que una captura se pierda por cerrar la app o cortar el BLE.
- Que un registro inválido se borre en vez de excluirse de los cálculos.

## 5. Restricciones

- Android, APK, React Native + Expo (ADR-APP-003). BLE con `react-native-ble-plx` y APK de
  desarrollo (`expo-dev-client`); Expo Go no sirve para BLE.
- SQLite local con migraciones versionadas (ADR-APP-004).
- Motor de diagnóstico puro, portable y aislado (ADR-APP-002), ≥ 90 % de cobertura (RNF-APP-013).
- Contrato BLE v0.1: captura notify, estado, sync por secuencia con CRC y confirmación, configuración
  de sesión cifrada y resumen para OLED (ADR-APP-012, ADR-APP-013, ADR-APP-017).
- Español de Colombia; UTC interno, UTC−5 en pantalla (ADR-APP-011).
- Ley 1581 de 2012: aviso de privacidad y consentimiento antes del primer uso (RNF-APP-012).

## 6. Arquitectura en capas

Hexagonal, con el dominio en el centro y adaptadores en los bordes. La regla es dura: `domain` no
importa React Native, SQLite, BLE ni red.

```
UI (expo-router)  →  application (casos de uso)  →  domain (motor, entidades)
                              ↓
                      ports (interfaces)
                              ↓
      infrastructure: BLE | SQLite | archivos | mapas | exportación | reloj
```

### 6.1 `src/domain/`

TypeScript puro, sin IO. Se prueba con Vitest sin emulador.

- Entidades y value objects: `Farm`, `Plot`, `CartographicUnit`, `Capture`, `Measurement`,
  `Diagnosis`, `Calibration`, `ThresholdSet`, `SessionConfig`, `Alert`.
- `diagnosis/`: motor puro `diagnose(input, thresholds) → DiagnosisResult`; propagación de
  incertidumbre; regla del mensurando; ley del mínimo; enclavamiento por CE; validez temporal;
  restricciones duras; texto en lenguaje sencillo.
- `validation/`: rangos por variable, banderas, coherencia de fechas y coordenadas.
- `units/`: unidades y conversiones; formateo UTC−5.

### 6.2 `src/application/`

Casos de uso que orquestan puertos. Un caso de uso por intención del usuario.

- `connectStick`, `disconnectStick`, `syncDeviceClock`
- `sendSessionConfig` (ADR-APP-017)
- `ingestCapture` (BLE en vivo), `importCaptureBatch` (microSD/CSV)
- `saveMeasurement`, `discardMeasurement` (borrado lógico)
- `diagnoseMeasurement`, `recomputeDiagnosis`
- `createFarm`, `createPlot`, `setActivePlot`, `updatePlotContext`
- `assignCaptureToPlot` (capturas con `config_id = 0`, asociación posterior)
- `listMeasurements`, `getMeasurementDetail`
- `syncFromSd` (rangos, confirmación, reanudación)
- `exportCsv`, `exportGeoJson`, `exportPdf` (v1.0)
- `importThresholds`, `activateThresholdSet`
- `requestPrivacyConsent`

### 6.3 Puertos (interfaces)

| Puerto | Implementación real | Implementación de desarrollo |
| --- | --- | --- |
| `StickGateway` | BLE GATT (`react-native-ble-plx`) | `SimulatedStickGateway` |
| `CaptureStore` | SQLite | SQLite en memoria / archivo temporal |
| `FarmStore` | SQLite | igual |
| `ThresholdStore` | asset JSON + SQLite | igual |
| `FileStore` | `expo-file-system` | memoria |
| `ShareGateway` | `expo-sharing` | stub |
| `MapTileStore` | PMTiles/MBTiles (fase mapas) | stub |
| `Clock` | reloj del sistema | reloj fijo en pruebas |
| `Logger` | consola + archivo local | consola |

El mismo `StickGateway` se usa en la app real y en pruebas: un simulador que reproduce capturas,
cortes de conexión y sincronización lenta. Eso permite construir todo el MVP antes de que el
hardware esté listo.

### 6.4 `src/ui/`

- `expo-router` con una ruta por pantalla del mapa de Notion: Inicio, Conectar, Medir, Contexto,
  Diagnóstico, Historial, Mapa, Lotes y fincas, Sincronizar, Calibración, Exportar, Estado del
  bastón, Ajustes.
- Estado de UI con Zustand (tiendas pequeñas por módulo); datos persistentes siempre en SQLite, no
  en el estado global.
- Componentes con zonas táctiles ≥ 48 dp, contraste ≥ 4.5:1 y estados que no dependen solo del color
  (RNF-APP-007, RNF-APP-020).

## 7. Offline first, en concreto

- SQLite es la fuente de verdad. La UI lee de SQLite; nunca de una respuesta de red.
- No hay llamadas de red en el camino crítico. Mapas y umbrales se cargan desde archivos locales.
- Las escrituras son transaccionales: una captura se guarda completa o no se guarda.
- Los datos crudos (`captures.raw_payload`) son inmutables. La calibración y el diagnóstico se
  derivan y se pueden recalcular (ADR-APP-005).
- La única "sincronización" es con el bastón por BLE y, opcionalmente, con un CSV importado. No hay
  servidor que reconciliar.
- Si el teléfono se queda sin espacio o la migración falla, se restaura la copia de seguridad
  automática y se informa (RNF-APP-014).

## 8. Modelo de datos local

Tablas principales (SQLite, `schema_migrations` versionada):

| Tabla | Campos clave | Reglas |
| --- | --- | --- |
| `farms` | `id`, `name`, `created_at`, `updated_at` | — |
| `plots` | `id`, `farm_id`, `name`, `area_ha`, `crop_primary`, `crop_secondary`, `depth_cm`, `last_fertilization_date`, `drainage`, `shading`, `density`, `altitude_m`, `slope`, `notes`, `deleted_at` | Un lote pertenece a una finca y tiene un cultivo o asocio vigente |
| `cartographic_units` | `id`, `plot_id`, `name`, `geometry_geojson`, `source` (`manual`/`gps`) | MVP: manual |
| `devices` | `device_id`, `name`, `last_used_at`, `protocol_major`, `protocol_minor`, `firmware_version` | Se recuerda el último usado |
| `sessions` | `id`, `plot_id`, `config_id`, `crop_primary`, `crop_secondary`, `depth_cm`, `last_fertilization_date`, `thresholds_version`, `sent_at`, `accepted_at`, `status` | Copia inmutable del contexto enviado al bastón |
| `captures` | `id`, `device_id`, `sequence`, `raw_payload`, `captured_at_utc`, `received_at_utc`, `origin` (`stick`/`manual`/`import`), `flags`, `config_id`, `plot_id`, `created_at` | Inmutable; único (`device_id`, `sequence`) |
| `measurements` | `id`, `capture_id`, `plot_id` nullable, `session_id`, `calibration_version`, `thresholds_version`, `lat`, `lon`, `position_valid`, `values_raw_json`, `values_calibrated_json`, `valid`, `excluded_reason`, `notes`, `photo_path`, `deleted_at` | Borrado lógico; crudos no editables; `plot_id` nulo = captura sin configurar, pendiente de asignar |
| `diagnoses` | `id`, `measurement_id`, `engine_version`, `thresholds_version`, `calibration_version`, `firmware_version`, `context_snapshot_json`, `classes_json`, `limiting_factors_json`, `alerts_json`, `evidence_json`, `uncertainty_json`, `created_at` | Inmutable; recalcular crea otra fila |
| `calibrations` | `id`, `device_id`, `variable`, `points_json`, `version`, `valid_from`, `created_at` | Por sonda y por variable |
| `threshold_sets` | `version`, `payload_json`, `checksum`, `source`, `activated_at` | Nunca se edita en sitio; se importa una versión nueva |
| `sync_state` | `device_id`, `last_confirmed_sequence`, `status`, `updated_at` | Reanudación y deduplicación |
| `attachments` | `id`, `measurement_id`, `kind`, `path`, `created_at` | Fotos locales |
| `settings` | `key`, `value` | Separador decimal, tema, etc. |

Índices: `measurements(plot_id, captured_at_utc)`, `captures(device_id, sequence)`,
`diagnoses(measurement_id)`, `plots(farm_id)`.

## 9. Flujo de captura (camino crítico)

1. El bastón notifica un registro. La app valida CRC, `device_id`, secuencia y versión de protocolo.
2. En una transacción: guarda `captures` cruda y crea/actualiza `measurements` con calibración
   aplicada y validación.
3. Responde la confirmación de recepción (solo después del commit).
4. Calcula el diagnóstico si hay contexto y umbrales activos; guarda `diagnoses`.
5. Muestra valores, intervalo y veredicto; opcionalmente escribe el resumen de dos líneas a la OLED.
6. Si el paso 2 falla, no se confirma: el registro sigue en la microSD y se sincroniza después.

Latencia objetivo ≤ 2 s en el 95 % de las capturas (RNF-APP-001). El cálculo del diagnóstico nunca
bloquea el guardado.

## 10. Motor de diagnóstico

Contrato:

```ts
type DiagnosisInput = {
  values: CalibratedValues;        // con incertidumbre por variable
  context: PlotContextSnapshot;    // cultivo, profundidad, fertilización, restricciones
  measuredAtUtc: string;
  flags: CaptureFlags;
  calibrationVersion: string;
  firmwareVersion: string;
};

type DiagnosisResult = {
  validity: "valid" | "blocked" | "insufficient_data";
  classes: AptitudeClass[];        // una o varias: S1 | S2 | S3 | N
  perVariable: VariableResult[];   // clase o intervalo por variable
  limitingFactors: LimitingFactor[];
  alerts: Alert[];
  evidence: Evidence;              // entradas, umbrales y reglas usadas
  versions: { engine: string; thresholds: string; calibration: string; firmware: string };
  explanation: string;             // lenguaje sencillo
};

function diagnose(input: DiagnosisInput, thresholds: ThresholdSet): DiagnosisResult;
```

Orden de evaluación (no negociable):

1. Restricciones duras del lote (altitud, drenaje, profundidad efectiva, densidad): si limitan,
   aparecen primero y el resto pasa a secundario (RF-APP-024).
2. Validez del dato: banderas, rangos, posición, hora, origen de ensayo.
3. Validez temporal de nutrientes (3–4 meses desde fertilización) (RF-APP-022).
4. Enclavamiento por CE: si CE supera el umbral, no hay conclusión de nutrientes (RF-APP-023).
5. Regla del mensurando por variable: humedad absoluta; pH confianza media; P y K relativos; N
   estimado y nunca medido (RF-APP-028).
6. Propagación de incertidumbre: intervalo por variable; si cruza clases, se devuelven todas las
   clases posibles y no se elige (RF-APP-027).
7. Ley del mínimo: la clase final es la del factor más limitante; empates se listan ordenados
   (RF-APP-025, RF-APP-026).
8. Alertas y explicación en lenguaje sencillo con evidencia (RF-APP-030, RF-APP-031, RF-APP-032).

### 10.1 Formato de umbrales

JSON versionado y validado con Zod, cargado desde `assets/thresholds/<version>.json`:

```jsonc
{
  "schemaVersion": 1,
  "version": "2026.11-placeholder",
  "crops": {
    "cafe": {
      "validityMonths": 4,
      "hardConstraints": { "altitudeMaxM": null, "drainage": [] },
      "variables": {
        "humidity": { "unit": "% v/v", "classes": [], "uncertainty": 0 },
        "ph": { "unit": "adimensional", "classes": [], "confidence": "media" },
        "ec": { "unit": "uS/cm", "interlockMax": null },
        "p": { "unit": "mg/kg", "mode": "relative" },
        "k": { "unit": "mg/kg", "mode": "relative" },
        "nEstimated": { "unit": "mg/kg", "mode": "estimated" }
      }
    }
  },
  "alerts": [],
  "sampling": { "depthCm": 20, "minSubsamples": 15, "maxSubsamples": 20, "pattern": "zigzag" }
}
```

**Fuente de la ciencia:** `Objetivo1_Umbrales_Ecuaciones_Motor_Decision.docx` (v2, agosto 2026) y su
volcado Markdown, copiado al repo en
`docs/requirements/objetivo-1-umbrales-ecuaciones-motor.md`. Original externo:
`F:\uni\Z- Semillero baston\objetivo 1\V2\`. El set inicial se extrae de las tablas 17, 19–22 y
39–40 y de las ecuaciones 4–39; las celdas vacías de la tabla 17 se tratan como "sin umbral" y
nunca se rellenan con el valor de otro cultivo.

### 10.2 Entrega y versionado de umbrales

- El APK incluye un set base en `assets/thresholds/` para poder arrancar sin red.
- Ajustes permite importar un archivo JSON nuevo desde el almacenamiento del teléfono, validarlo con
  Zod y con `checksum`, y activarlo explícitamente (ADR-APP-006: la ciencia se actualiza sin
  reinstalar).
- Los sets nunca se editan en sitio: importar crea una versión nueva en `threshold_sets` y conserva
  las anteriores para poder recalcular y auditar.
- Todo diagnóstico usa la versión fijada en la sesión de la captura; si la captura llegó sin
  configuración, usa la versión activa en el momento de diagnosticar y lo registra en la evidencia.
- `recomputeDiagnosis` reutiliza el `context_snapshot_json` y la versión originales. Recalcular con
  el contexto o los umbrales actuales es una acción explícita que crea un diagnóstico nuevo, nunca
  sobrescribe el anterior (RF-APP-031).

### 10.3 Calibración del MVP

Mientras la calibración individual (RF-APP-052, v1.0) no exista, el MVP usa una calibración de
fábrica versionada (`factory-v1`, identidad sobre el valor crudo) para poder emitir diagnóstico con
las cuatro versiones. Decisión aceptada el 2026-11-12. La pantalla de calibración individual y el
asistente entran en el corte 4 (v1.0).

## 11. BLE

`BleStickGateway` implementa una máquina de estados explícita:

```
idle → scanning → connecting → discovering → ready
ready → configuring → ready
ready → capturing ↔ ready
ready → syncing → ready
ready → reconnecting → ready | error
error → idle (acción manual)
```

- Escaneo solo de dispositivos que anuncian el servicio propio; permisos en contexto (RF-APP-001,
  RF-APP-002).
- Un solo cliente conectado. Reintentos con espera creciente y límite; después, acción manual
  (RF-APP-005).
- Verificación de versión mayor.menor al conectar; un cambio mayor bloquea con mensaje claro
  (RF-APP-006).
- Cola serial de escrituras; configuración y resumen cifrados según contrato.
- **Cifrado pendiente de especificación:** el contrato dice "cifrada" sin algoritmo, claves ni
  emparejamiento. Propuesta del builder: usar cifrado de enlace BLE (LE Secure Connections con
  bonding) y confirmarlo con firmware antes del corte 2. Si el equipo exige cifrado de carga útil,
  se necesita un ADR y vectores de prueba compartidos.
- Fragmentación por MTU, CRC por bloque, confirmación del último `sequence` recibido y reanudación
  (ADR-APP-013).
- Todo evento de conexión se refleja en la UI con texto/ícono, no solo color (RF-APP-004).

### 11.1 Simulador

`SimulatedStickGateway` reproduce: capturas periódicas o por comando, CSV de la microSD, cortes de
conexión, MTU pequeño, CRC inválido, firmware incompatible y batería baja. Es la herramienta de
desarrollo mientras el hardware no exista y la base de las pruebas de integración.

## 12. Sincronización con microSD

- La app pide "enviar desde N", recibe bloques, guarda y confirma el último `sequence` persistido.
- Identidad `device_id + sequence`; duplicados se descartan; conflicto con mismo id y distinto
  contenido conserva el primero y avisa (RF-APP-040).
- Progreso por registros confirmados, no por paquetes (RF-APP-041).
- El bastón no borra hasta recibir confirmación (RF-APP-039).
- La importación manual de CSV usa el mismo pipeline y la misma deduplicación (RF-APP-042).

## 13. Mapas

Decisión del 2026-11-12: las teselas offline entran desde el MVP. El mapa es parte del recorrido de
campo, no un extra.

- Render: `maplibre-react-native` con paquete de teselas vectoriales `.pmtiles` por región.
- Origen: extracto Protomaps (datos OpenStreetMap, ODbL) o un proveedor con licencia que permita
  uso offline; la atribución se muestra siempre en el mapa.
- La app incluye un paquete mínimo de la zona de trabajo y permite descargar/importar otro con
  límite de tamaño y borrado explícito.
- Si no hay paquete para la zona, el mapa cae a un lienzo con los puntos en coordenadas relativas y
  lo dice; nunca deja de mostrar los puntos.
- Capas: puntos por variable, posición actual, ruta del recorrido y polígono del lote. La unidad
  cartográfica se dibuja como referencia, no se edita en el MVP.
- GPS del teléfono con `expo-location`, activo solo durante el muestreo (RNF-APP-010).

## 14. Exportación

- CSV UTF-8 con encabezados estables, unidades, UTC, versiones de umbrales y calibración, origen y
  calidad del dato (RF-APP-055, ADR-APP-014).
- Compartir con la hoja del sistema (`expo-sharing`). Sin subida a red.
- GeoJSON/KML en v2.0; PDF por lote en v1.0.
- N estimado se exporta con etiqueta `estimado`.

## 15. Estructura del repositorio

```
app/                      (raíz Expo: package.json, app.json, tsconfig)
  app/                    rutas expo-router (una por pantalla)
  src/
    domain/               entidades, motor, validación, unidades (puro)
    application/          casos de uso
    infrastructure/       ble/, db/, files/, maps/, export/, clock/
    ui/                   componentes, hooks, tiendas
    simulator/            bastón simulado
  assets/
    thresholds/           JSON versionado
  tests/                  unitarios de dominio y aplicación
docs/
  context/                soul, glossary, map
  adr/                    ADRs de implementación del repo
  superpowers/specs/      este documento
  plans/                  planes de implementación
.harness/                 harness
```

Sin monorepo por ahora: un solo paquete. Si el firmware entra al repo, pasará a `firmware/` como
parte, sin mover la app.

## 16. Herramientas y pruebas

- TypeScript estricto, ESLint y Prettier; `harness verify` corre formato, lint y tipos.
- Vitest para dominio y casos de uso (sin emulador).
- `jest-expo` + React Native Testing Library para pantallas críticas (Medir, Diagnóstico).
- Pruebas obligatorias del motor: tabla de umbrales, intervalos que cruzan clases, CE, validez
  temporal, N estimado, asocio café–plátano, datos faltantes (RNF-APP-005, RNF-APP-013).
- Pruebas de fallo: 100 desconexiones BLE, 50 cierres forzados durante escritura, migración desde
  cada versión publicada.
- Simulador como fixture de integración; ningún test depende del hardware.

## 17. Orden de construcción (prioridad)

Regla: se respeta la fase de Notion (MVP / v1.0 / v2.0). Lo que cambia es el orden dentro del MVP:
primero lo que desbloquea el recorrido de campo, después lo que lo completa. Ningún requisito MVP se
descarta; se posterga.

Cada corte termina con `verify` y una demo.

**Corte 0 — esqueleto verificable (P0).**
Expo + TypeScript + navegación; dominio con tipos; SQLite con migraciones; `StickGateway` con
simulador; captura → guardado → historial; exportación CSV. Sin diagnóstico todavía.

**Corte 1 — recorrido de campo mínimo (P0, MVP).**
Fincas y lotes; contexto del lote; configuración de sesión; calibración de fábrica `factory-v1`;
motor con set placeholder; pantalla de diagnóstico con intervalo, evidencia y lenguaje sencillo;
alertas; modo ensayo; estado del bastón; ajustes mínimos y aviso de privacidad.

**Corte 2 — hardware y robustez (P0, MVP).**
BLE real con el contrato v0.1; sincronización por microSD con reanudación; reconexión; versiones;
pruebas de corte y desconexión. Se acepta con simulador si el bastón no está disponible.

**Corte 3 — completar el MVP (P1).**
Mapa con teselas offline (PMTiles), puntos, GPS del teléfono, ruta y polígono del lote; guía del
protocolo de muestreo con contador. Se acepta sin teselas solo si la licencia del proveedor no
llega a tiempo; el lienzo con puntos sigue siendo el respaldo.

**Corte 4 — v1.0 (P2).**
Calibración individual y asistente; N estimado; asocio café–plátano; resumen por lote; PDF por lote;
gráficas de evolución; análisis de laboratorio; unidad cartográfica por GPS; importación CSV.

**Corte 5 — v2.0 (P3).**
Dosis (solo con ecuaciones validadas), GeoJSON/KML y mapa de calor por variable.

## 18. Decisiones que quedan abiertas

Resueltas el 2026-11-12: umbrales (documento v2 disponible y copiado al repo), calibración del MVP
(`factory-v1`), teselas offline desde el MVP, bastón físico en construcción (el corte 2 se acepta
con simulador y se integra cuando exista) y entrega objetivo: lo antes posible, idealmente en 2027.

Siguen abiertas y no las puede resolver el builder:

1. **Proveedor de teselas y licencia**: Protomaps/OSM (ODbL) u otro que permita uso offline;
   atribución y tamaño máximo del paquete.
2. **Android mínimo** y teléfonos objetivo (RNF-APP-009).
3. **Umbral de batería** del teléfono (RNF-APP-010, marcado "por confirmar").
4. **Unidad cartográfica**: ¿texto libre en el MVP o catálogo local? El motor necesita la unidad
   para el umbral de humedad (RF-APP-021); la tabla 17 y las ecuaciones 8–12 fijan la conversión.
5. **Cifrado BLE**: ¿cifrado de enlace (LE Secure Connections con bonding) o cifrado de carga útil?
   Propuesta del builder: enlace; confirmar con firmware antes del corte 2.
6. **Protocolo BLE definitivo**: UUIDs, versión y pines; dependen del hardware en construcción.

## 19. Lo que decide el builder

- Versiones exactas de Expo/RN y librerías, fijadas al crear el proyecto.
- Zustand frente a otra tienda liviana; expo-router frente a React Navigation.
- Formato interno del payload crudo y del JSON de evidencia.
- Estrategia de fragmentación BLE dentro del contrato.
- Cómo se representa el intervalo de incertidumbre en la UI (texto, banda, ambos).
- Detalles de migraciones y respaldo local.

## 20. Criterio de aceptación de este diseño

- Una persona puede leerlo y saber qué se construye primero y por qué.
- Cada requisito del MVP tiene un módulo y una capa donde vive.
- No hay función central que dependa de red.
- Los datos crudos, el diagnóstico y sus versiones son auditables y recalculables.
- El motor se puede probar sin teléfono y sin bastón.
- Las decisiones pendientes están separadas de las tomadas.