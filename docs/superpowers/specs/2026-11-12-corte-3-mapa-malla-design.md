# Corte 3: mapa, malla y dictamen por espacio

**Estado:** borrador para revisión · 2026-11-12
**Reemplaza en alcance a:** RF-APP-050 (contador de puntos y “muestreo completo”)
**Complementa a:** `docs/requirements/muestreo-espacial-mallas-gradientes.md` (evidencia) y
`docs/superpowers/specs/2026-11-12-app-movil-arquitectura-design.md` §13 y §13.1.

---

## 1. Intención y por qué

La app no es una guía de muestreo. Es un sistema de **documentación y alertas**: registra dónde se
midió, qué dio cada lugar, en qué condición está el suelo y qué alertas salen del cultivo y del tipo
de suelo. La persona decide cuántos puntos tomar y dónde; la app no se lo dice.

Un punto suelto no representa un lote. Por eso el corte 3 no muestra “el lote está en tal clase”:
muestra **espacios**. Las coordenadas que ya trae el bastón se agrupan en una malla de celdas de
tamaño publicado y cada celda dictamina solo con lo que se midió dentro. Donde no hay dato, se dice
que no hay dato.

El mapa es parte del producto, no un adorno: si se ve pobre o desordenado, el sistema se percibe
pobre. Tiene que ser legible en el celular, en el campo, a pleno sol, sin internet y sin teselas
cuando falten.

## 2. Objetivos

1. Dibujar en el mapa las coordenadas que el bastón registró en cada medición.
2. Derivar una malla automática de celdas de ~0,4 ha (1 acre) sobre el área medida.
3. Mostrar, por **punto**: hora, posición, calidad de la posición, valores, diagnóstico y alertas.
4. Mostrar, por **celda**: estado, clases presentes y conteo, resumen numérico cuando las clases
   coinciden, y acceso a las mediciones que lo sostienen.
5. Mostrar, por **lote**: cuántas celdas tienen dato, cuántas no, cuántas no concluyen, y las alertas
   del motor agrupadas.
6. Funcionar sin internet: teselas vectoriales offline en un archivo `.pmtiles`, con respaldo en
   lienzo si no hay archivo.
7. No inventar nada: ni interpolación, ni promedio de clases, ni gradientes calculados.

## 3. No objetivos (corte 3)

- Interpolación, mapa de calor o kriging (RF-APP-047 queda en v2.0).
- Gradiente calculado; solo se declaran zonas cuando haya datos que lo sostengan.
- Resolver la unidad cartográfica por georreferenciación; se sigue declarando en el lote.
- Delimitar el perímetro del lote, caminarlo o dibujarlo. La malla se arma con los puntos medidos;
  el contorno del lote queda para v2.
- Editar la malla a mano, mover celdas o crear celdas sueltas.
- Descargar teselas por internet desde la app. Los paquetes se importan como archivo.
- Ruta del recorrido y GPS del teléfono: la posición la da el bastón.
- Contador de puntos, metas, “faltan N puntos” o instrucciones de patrón de muestreo.

## 4. Anti-objetivos (fallaría aunque compile)

- Pintar una celda vacía con el color de una clase.
- Promediar clases que discrepan para mostrar una sola.
- Presentar una captura del bastón como muestra compuesta de 15–20 submuestras.
- Dibujar una superficie continua entre puntos con 15–20 capturas.
- Mostrar un punto en el mapa con una posición que no se midió.
- Depender de internet para ver el mapa o para abrir la app.

## 5. Restricciones

- Offline first: sin cuentas, sin servidor, sin red. El mapa nunca hace peticiones.
- Capas: `app/` → `src/ui` → `src/application` → `src/domain`; `src/ports` define interfaces;
  `src/infrastructure` implementa. `src/domain` no importa React Native, Expo, SQLite ni BLE.
- SQLite es la única fuente de verdad; las capturas son inmutables en su contenido.
- El dictamen sale del motor existente (`diagnose.ts`), no de un segundo motor espacial.
- Todo texto en español de Colombia; los estados se distinguen con texto, no solo con color.
- Un dato ausente se muestra como “sin dato”, nunca como cero.

## 6. Alcance funcional

### 6.1 Navegación

- Inicio: botón **Mapa** (además de Conectar, Medir, Historial, Sincronizar).
- `app/map.tsx`: selector de lote, mapa, leyenda, resumen, alertas y lista de puntos.
- `app/map-packages.tsx`: paquetes de mapa offline (incluido, importados, borrar).
- El detalle de un punto abre `app/diagnosis.tsx` con `measurementId` (ya existe).
- Las mediciones sin lote se asignan desde el historial (§8.4).

### 6.2 Pantalla de mapa (organización)

De arriba hacia abajo, en una sola pantalla con desplazamiento:

1. **Encabezado del lote:** nombre, cultivo, unidad cartográfica y área declarada. Si falta algo, se
   dice con un enlace para completarlo.
2. **Mapa** (≈55 % de la altura): teselas, celdas, puntos, escala y atribución. Abajo a la izquierda,
   botón “encuadrar” (vuelve a los puntos); abajo a la derecha, atribución.
3. **Resumen:** “12 celdas: 5 con dato, 6 sin dato, 1 no concluyente · 7 puntos · 1 sin posición”.
   Es un conteo, no un veredicto del lote.
4. **Leyenda:** color + texto por clase, “sin dato”, “no concluyente” y el caso de dos clases.
5. **Alertas:** del motor, agrupadas por código y gravedad; aparte, avisos de calidad del registro.
6. **Puntos documentados:** lista con hora, coordenadas o “sin posición”, calidad, clase y alertas;
   tocar abre el diagnóstico.

Tocar una celda abre una hoja inferior con: estado, área de la celda, clases y conteo, resumen
numérico por variable (mediana y mínimo–máximo), advertencias y la lista de mediciones.

### 6.3 Capas y orden de dibujo

1. Teselas del paquete activo.
2. Celdas: relleno por estado, borde blanco de 1 px; la celda seleccionada con borde de 3 px.
3. Puntos: círculo por clase; anillo hueco si la posición es imprecisa; “?” si no concluye.
4. Sin polígono del lote: la malla cubre el área medida y así se rotula.

Los puntos van por encima de las celdas. La atribución, la escala y la leyenda nunca se tapan.

### 6.4 Colores

| Estado | Color | Texto de leyenda |
| --- | --- | --- |
| S1 | `#2E7D32` | Apto |
| S2 | `#7CB342` | Moderadamente apto |
| S3 | `#F9A825` | Marginalmente apto |
| N | `#C62828` | No apto |
| `sin_dato` | `#EDEAE0` | Sin dato (no se colorea por clase) |
| `no_concluyente` | `#CFCBC0` | No concluyente (ver motivo) |

Relleno de celda al 45 % de opacidad; el mapa se sigue leyendo debajo. La leyenda repite el nombre de
la clase, así que el color no es el único canal.

**Dos clases posibles** (el motor devuelve “entre S1 y S2” cuando la incertidumbre cruza un umbral):
el punto y la celda se pintan con el color de la clase mejor en el relleno y el borde con el color de
la peor, y la etiqueta dice el rango completo (“entre Apto y Moderadamente apto”). La leyenda tiene
una entrada propia con la muestra de dos tonos. No se elige una sola clase.

## 7. La malla

### 7.1 De dónde sale

Las coordenadas vienen del GPS del bastón, registro por registro. No se camina nada, no se dibuja
nada y no se usa el GPS del teléfono.

La malla tapa el **área medida**, no el lote: es un rectángulo alineado al norte que cubre todos los
puntos con posición del lote, dividido en celdas de ~0,4 ha. Se rotula tal cual, para que nadie lea
“malla del lote” donde dice “área medida”. Cuando en v2 haya contorno del lote, la malla se recortará
a él sin cambiar las reglas de dictamen.

### 7.2 Algoritmo

Todo en `src/domain/geo/`, puro y con pruebas.

1. Proyectar los puntos a metros locales: equirectangular con `R = 6 371 008,8 m` y
   `x = R·cos(lat0)·Δλ`, `y = R·Δφ`, con `lat0` la latitud media de los puntos. A escala de lote el
   error es despreciable y no se agrega una librería de proyecciones.
2. Caja envolvente de los puntos. **Solo los ejes con dispersión cero** se expanden hasta el lado
   objetivo (`s = 63,2 m`) centrados en los puntos: un eje sin dispersión no forma una celda, y con
   un solo punto la caja es `s × s`. Un eje con dispersión mayor que cero se deja como está: la
   malla cubre el área medida, no un área inventada.
3. Área `A = ancho × alto`. Candidatos de número de celdas: `floor(A / 0,4 ha)` y
   `ceil(A / 0,4 ha)`, sin repetir, mínimo 1.
4. Para cada candidato `n`, buscar el par de factores `filas × columnas = n`. Un par califica si la
   celda resultante tiene relación de aspecto entre 0,4 y 2,5; así se evitan las franjas. Si un
   candidato no tiene ningún par que califique, se descarta.
5. Entre los pares que califican gana el que deja el área de celda más cerca de 0,4 ha
   (`|A/n − 0,4 ha|`); el parecido con un cuadrado solo desempata. Si ningún candidato califica, se
   usa la malla de una sola fila o una sola columna más parecida a la caja.
6. Celdas rectangulares de `ancho/columnas` por `alto/filas`, alineadas al norte, cubriendo la caja.
   No hay recorte: cada celda es un rectángulo completo.
7. Identificador estable: `r{fila}c{columna}`.

Casos que fijan el comportamiento y las pruebas:

| Dispersión de los puntos | Área | Celdas | Celda |
| --- | --- | --- | --- |
| 55 × 55 m | 0,30 ha | 1 | 0,30 ha |
| 100 × 100 m | 1,00 ha | 2 | 0,50 ha (50 × 100 m) |
| 155 × 155 m | 2,40 ha | 6 | 0,40 ha (77 × 52 m) |
| 316 × 316 m | 10,0 ha | 25 | 0,40 ha |
| 2 puntos a 200 m, en línea | 1,26 ha | 3 | 0,42 ha (66 × 63 m) |

Tope de tamaño: si `n > 400`, se recalcula con `área objetivo = A / 400`, se informa el tamaño usado
y la pantalla lo dice (“malla ajustada a X ha por celda por el tamaño del área medida”).

La malla **no se guarda**: se recalcula desde los puntos cada vez. No hay dos verdades que se
desincronicen cuando llega una medición nueva.

### 7.3 Asignación

- Una medición pertenece a la celda que contiene su posición.
- Si cae fuera de la caja (no debería: la caja los contiene), es un error de cálculo y la prueba lo
  detecta; en ejecución se cuenta en “fuera del área”.
- Sin posición: no se dibuja, no entra en celdas, se cuenta en “sin posición” y se lista.
- Las mediciones inválidas no entran en ninguna celda; se cuentan en el detalle.

## 8. De dónde sale la posición

El bastón ya trae GPS propio en cada registro (`latitude`, `longitude`, `satellites`, `hdop`,
`fixAgeS`, bandera `positionValid`). Esa es la única fuente: es la posición del punto medido, no la de
la persona que después sincroniza.

| Situación | Calidad | Trato |
| --- | --- | --- |
| `positionValid = true`, HDOP ≤ 2 | buena | punto lleno |
| `positionValid = true`, HDOP ≤ 5 | aceptable | punto lleno, HDOP y satélites a la vista |
| `positionValid = true`, HDOP > 5 | imprecisa | anillo hueco y aviso |
| `positionValid = false` o coordenadas nulas | ninguna | no se dibuja; se lista y se cuenta |

- El motor ya considera `positionValid` desde el payload; el mapa usa la misma verdad, no otra.
- `positionValid = false` se trata como sin posición aunque haya coordenadas: la bandera existe para
  decir que no se confíe en ellas.
- HDOP no se convierte a metros: se muestra tal cual con los satélites. Es una convención de GPS, no
  un umbral agronómico.
- No se permite mover un punto a mano ni completar la posición con el teléfono.

### 8.1 Mediciones sin lote (corrección de la vía de datos)

Hoy la sincronización y la importación CSV guardan `plotId: null`, aunque el registro trae
`plotCode` y `configId`. Sin esto, el mapa solo mostraría capturas en vivo.

Regla de asignación, en la ingesta y en el relleno de lo ya guardado:

1. `payload.plotCode` coincide con el `id` de un lote existente → ese lote.
2. Si no, `configId` coincide con una sesión guardada → `session.plotId`, si el lote existe.
3. Si no, queda sin lote y se puede asignar desde el historial con el selector de lotes existente.

La migración 5 rellena `captures.plot_id` y `measurements.plot_id` con esa misma regla para lo que ya
está en la base. Asignar lote es metadato: no cambia el contenido de la captura ni de la medición.

## 9. Dictamen por celda

Insumo por medición: el último diagnóstico guardado (`DiagnosisStore`), que trae `validity`,
`classes` (una o dos clases posibles) y `alerts`.

- `sin_dato`: ninguna medición válida dentro de la celda. Si hay mediciones inválidas, el detalle dice
  cuántas y por qué.
- `un_punto`: una medición válida. Se muestra el diagnóstico de ese punto, rotulado “1 punto”.
- `resumen`: dos o más mediciones válidas y **todas con el mismo conjunto de clases** (incluido el
  mismo par “entre S1 y S2”). Se muestra esa clase o rango con “N puntos” y, por variable del
  veredicto, mediana y mínimo–máximo.
- `no_concluyente`: hay mediciones pero no se puede dar una clase: diagnósticos bloqueados o con
  datos insuficientes, conjuntos de clases distintos entre puntos, o mediciones **sin diagnóstico**.
  Se listan las clases presentes con su conteo y el motivo. **No se promedia ni se elige la peor por
  conveniencia.**

Ejemplo: 3 puntos S1 y 1 punto S3 → la celda no es “S1”; es no concluyente con “3 aptos, 1
marginalmente apto”.

La celda no calcula clases: las toma del motor. La celda no mira la fecha para “vencer” datos; la
fecha se muestra y la persona decide.

### 9.1 Diagnóstico de lo que llegó por sincronización

El motor no diagnostica sin sesión, y las mediciones sincronizadas no tenían diagnóstico. Para que el
mapa no quede en blanco:

- Al abrir el mapa de un lote se ejecuta `ensurePlotDiagnoses`: busca las mediciones del lote sin
  diagnóstico y las diagnostica con la **sesión de su `configId`** (el contexto que el bastón tenía
  cuando capturó), no con el contexto actual del lote.
- Si no hay sesión para ese `configId`, la medición queda sin diagnóstico y la celda lo dice:
  “sin sesión del bastón: no se puede dictaminar”. Los valores crudos se siguen viendo.
- Se guarda igual que siempre (diagnóstico inmutable con sus cuatro versiones). Si ya existe, no se
  recalcula.
- El proceso es idempotente y corre dentro de una transacción; si falla, el mapa abre sin clases y
  avisa, no se queda cargando.

## 10. Alertas

- Del motor: se agrupan por `code` + `severity`, con el mensaje del motor y el conteo de puntos
  afectados. Orden: `blocking`, `warning`, `info`. Se muestran las tres primeras y “+N más”.
- De registro (las genera la app, no el motor, y van en bloque aparte): “sin posición”,
  “posición imprecisa”, “fuera del área”, “mediciones inválidas”, “sin diagnóstico”.
- Cada alerta enlaza al primer punto que la produce.

## 11. Mapa offline

### 11.1 Piezas

- `@maplibre/maplibre-react-native@11.5.1`, que arrastra MapLibre Native Android **13.6.1** (≥ 11.7,
  que es donde aparece el soporte de `pmtiles://`). Verificado en el `gradle.properties` del paquete.
- Estilo generado con `@protomaps/basemaps` (sabor claro) sobre una fuente `pmtiles://`; no se
  escriben capas a mano ni se usan estilos remotos.
- En el corte 3 el estilo usa solo las capas **sin rótulos** (sin opciones de idioma): no pide
  glifos ni sprites, y por lo tanto no pide nada por red. Agregar rótulos de lugar exige
  empaquetar fuentes y queda fuera de este corte.
- Un paquete base incluido en la app y paquetes detallados que se importan como archivo.
- `expo-document-picker` (ya instalado) para importar el `.pmtiles`.

### 11.2 Paquetes sin acoplarse a un municipio

El código no menciona Quindío ni ningún municipio: el paquete es un dato con nombre y ruta.

- **Paquete base incluido:** cobertura de país a zoom bajo (el zoom máximo se baja hasta que el
  archivo quede dentro del presupuesto de tamaño que fije el plan). Sirve para ubicar cualquier punto
  y para no arrancar en blanco.
- **Paquete detallado:** se genera con un script (`scripts/map/extract-pmtiles.mjs`) que recibe una
  caja de coordenadas y un zoom máximo, y produce el `.pmtiles` a partir del corte diario de
  Protomaps. La app no descarga nada: la generación es de construcción, con internet, una vez.
- **Importación:** la persona puede importar el `.pmtiles` de su zona desde el celular. Se copia al
  almacenamiento privado con verificación de espacio, límite de tamaño y borrado explícito.
- **Pruebas:** se genera el paquete del Quindío con el script como caso de prueba; no queda cableado
  en el código.

Si el paquete detallado no cubre el área que se está viendo, se ve el paquete base y un aviso:
“Sin mapa detallado para esta zona. Puedes importar uno.”

### 11.3 Cómo se abre el archivo

`pmtiles://file://<ruta absoluta>` para archivos copiados al almacenamiento de la app. Para el
paquete incluido se intenta `pmtiles://asset://<nombre>.pmtiles`; si en el arranque no resuelve, se
copia una vez al almacenamiento privado y se usa `file://`. Esa decisión se cierra en el primer
pincho de verificación (§15), no antes.

El mapa usa **dos fuentes**: la base incluida, que cubre el país a zoom bajo, y el paquete
detallado activo, que se dibuja encima. Donde el paquete detallado no alcanza, se ve la base: el
mapa nunca queda en blanco y no hace falta saber los límites de cada archivo para saber si la
zona está cubierta.

### 11.4 Respaldo sin teselas

Si no hay paquete, el archivo no abre o el módulo nativo falla, el mapa se dibuja en un lienzo con
`View` absolutos y la misma proyección local: celdas, puntos y escala. Un rótulo dice “Mapa sin
teselas”. Nunca se deja de mostrar lo medido, y no se agrega una segunda librería de mapas.

## 12. Modelo de datos (migración 5)

```sql
ALTER TABLE measurements ADD COLUMN position_valid INTEGER;  -- bandera del GPS del bastón

CREATE TABLE map_packages (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  imported_at TEXT NOT NULL,
  deleted_at TEXT
);
```

- La posición no se duplica: se lee de `payload_json` (`latitude`, `longitude`, `hdop`,
  `satellites`, `positionValid`). Una sola verdad.
- La **bandera** sí se guarda (`position_valid`): `positionValid = false` significa “sin posición”
  aunque las coordenadas vengan, y eso no se puede reconstruir a partir de las coordenadas.
- La sesión se guarda como `measurements.session_id` (columna que la migración 2 ya creó): el
  `config_id` se resuelve en la ingesta y queda el `id` de la sesión, que es la que el motor
  necesita. No se agrega `config_id` a las mediciones.
- La malla y la asignación de celdas no se guardan.
- El paquete activo vive en `settings` con la clave `active_map_package_id`.
- La exportación CSV no cambia: ya incluye `lat`, `lon`, `sats` y `hdop` del bastón.
- Relleno de la migración: `session_id` y `position_valid` desde `captures`; `plot_id` con la
  regla de §8.4.

## 13. Arquitectura y módulos

```
src/domain/geo/                 Puro. Proyección local, malla desde puntos, calidad de posición,
                                dictamen por celda.
  types.ts                      LatLon, BoundingBox, GridCell, CellState
  projection.ts                 ida y vuelta lat/lon ↔ metros locales
  grid.ts                       buildGridFromPoints(points, targetCellAreaHa) → celdas
  position.ts                   calidad de la posición desde el payload del bastón
  cell-verdict.ts               agrupación de diagnósticos por celda (reglas de §9)
src/application/map/
  describe-plot-space.ts        lote + mediciones + diagnósticos → modelo de pantalla
  ensure-plot-diagnoses.ts      completa los diagnósticos que faltan (§9.1)
  assign-measurement-plot.ts    asigna lote a una medición suelta (§8.4)
  manage-map-packages.ts        importar, listar, activar, borrar
src/ports/stores/map-package-store.ts
src/infrastructure/maps/
  pmtiles-archive-store.ts      copiar, verificar espacio, borrar
  map-style.ts                  estilo Protomaps sobre pmtiles://
src/ui/components/map/
  plot-map.tsx                  MapLibre
  fallback-map.tsx              lienzo sin teselas
  map-legend.tsx
  cell-sheet.tsx
  point-list.tsx
```

Regla de dependencias: `domain/geo` no importa nada de la app; `@maplibre/*` vive solo en
`infrastructure` y `ui`.

`app-context.ts` gana `mapPackages: MapPackageStore`.

## 14. Pruebas

Dominio (Jest, sin emulador):

- Proyección: ida y vuelta con error < 1 cm en un cuadrado de 100 m.
- Malla: los cinco casos de la tabla de §7.2; un solo punto; puntos en línea; área con más de 400
  celdas (área objetivo ajustada y reportada); todos los puntos quedan dentro de su celda.
- Posición: bastón válido en los tres tramos de HDOP; `positionValid = false`; coordenadas nulas.
- Dictamen: celda vacía; un punto; dos puntos con la misma clase; dos con clases distintas; un punto
  con dos clases posibles; un punto sin diagnóstico; un punto bloqueado.

Aplicación e infraestructura:

- `describe-plot-space` con almacenes en memoria: conteos, alertas agrupadas, orden de puntos.
- `ensure-plot-diagnoses`: diagnostica con la sesión del `configId`; no recalcula lo existente; sin
  sesión no escribe y lo informa; es idempotente.
- Asignación de lote: por `plotCode`, por `configId`, sin coincidencia.
- Migración 5 sobre SQLite real (`node:sqlite`): `config_id`, `map_packages`, relleno de `plot_id`.
- Estilo del mapa: ninguna fuente ni sprite con `http://` o `https://` (prueba de offline).
- Almacén de paquetes: límite de tamaño, espacio insuficiente, borrado, archivo ausente.

UI:

- Leyenda con texto y color; celda vacía sin color de clase; muestra de dos tonos.
- Lista de puntos: sin posición, posición imprecisa.
- Respaldo: sin paquete se dibuja el lienzo y se lee “Mapa sin teselas”.

## 15. Riesgos y verificación temprana

**El APK no sale de Expo Go.** Expo Go ejecuta solo JavaScript con los módulos que trae; no carga BLE
ni MapLibre. Decisión del 2026-11-12: se compila en la nube con **EAS Build** (cuenta gratuita de
Expo), sin instalar Android SDK ni JDK en la máquina:

- `eas build --profile development --platform android` produce un APK de desarrollo con
  `expo-dev-client`, que se instala en el teléfono y recarga el JS como Expo Go.
- El perfil `preview` produce APK de prueba para compartir.
- Requiere cuenta de Expo y conexión solo para compilar; la app sigue sin cuentas ni red.
- Si la cuota gratuita de EAS se vuelve un estorbo, la alternativa es un flujo de GitHub Actions que
  haga `expo prebuild` y `gradlew assembleRelease`; también deja CI, que hoy es un riesgo abierto.

**Pincho obligatorio antes de construir el resto (medio día):**

1. Instalar `@maplibre/maplibre-react-native@11.5.1` con su config plugin y compilar el primer APK de
   desarrollo por el camino elegido.
2. Cargar un `.pmtiles` pequeño y confirmar que renderiza con `pmtiles://asset://` o
   `pmtiles://file://`.
3. Confirmar que funciona con la arquitectura nueva (`newArchEnabled: true`).
4. Medir el tamaño del paquete base, del detallado y del APK.

Si PMTiles no renderiza, la contingencia es **MBTiles** (`mbtiles://`, soportado por MapLibre Native)
cambiando solo `pmtiles-archive-store` y `map-style`. El resto del diseño no cambia.

**Riesgo de tamaño:** los paquetes compiten con el tamaño del APK. Se mide y se ajusta el zoom; si no
alcanza, se reduce la cobertura del base y se documenta qué cubre.

**Riesgo de rendimiento:** 400 celdas y varios cientos de puntos en un celular de gama baja. Se
prueba con el área máxima y se mide el tiempo de apertura; si molesta, se simplifica el dibujo
(puntos como una sola fuente GeoJSON, sin etiquetas por celda).

## 16. Decisiones que tomé (el builder puede cambiarlas si el plan lo justifica)

1. La malla sale de las coordenadas del bastón, no de un perímetro dibujado.
2. Celda objetivo 0,4 ha; celdas rectangulares lo más cuadradas posible, nunca franjas.
3. La malla se recalcula, no se guarda.
4. Solo la posición del bastón; sin GPS del teléfono y sin posición manual.
5. El dictamen de celda exige coincidencia exacta de conjuntos de clases; si no, no concluyente.
6. Los diagnósticos que faltan se calculan con la sesión del `configId`, no con el contexto actual.
7. El paquete base es de país a zoom bajo; el detallado se genera con un script por caja de
   coordenadas y no está cableado a ningún municipio.
8. Respaldo en lienzo con `View`, no una segunda librería de mapas.

## 17. Decisiones de la persona (2026-11-12)

1. **Compilación:** EAS Build, nube de Expo, sin instalar SDK ni JDK local.
2. **Paquete base:** Colombia a zoom bajo incluido; el detalle de la zona se importa desde el
   celular. Nada cableado a un municipio.

No quedan preguntas abiertas para empezar.

## 18. Criterios de aceptación

- Los puntos del bastón aparecen en el mapa con su posición, y los sin posición se cuentan y se
  listan.
- Un lote con 7 puntos repartidos muestra una malla; con 1 punto muestra una celda; todos los puntos
  caen dentro de su celda.
- Una celda vacía no tiene color de clase; una con clases discrepantes dice “no concluyente” con el
  conteo de cada clase.
- Las mediciones sincronizadas aparecen en su lote y, si tienen sesión, con diagnóstico.
- Las alertas coinciden con las del diagnóstico de cada punto; no hay un segundo motor.
- Con el paquete detallado borrado o ausente, el mapa sigue mostrando celdas y puntos (base o
  lienzo) y lo dice.
- `npm run check` y `node .harness/bin/harness.mjs verify` en verde; el APK abre y muestra el mapa.

## 19. Referencias

- `docs/requirements/muestreo-espacial-mallas-gradientes.md` (tamaños de celda, muestreo compuesto,
  límites de la geoestadística y fuentes).
- MapLibre Native Android, ejemplo PMTiles: soporte desde 11.7.0; `pmtiles://` obligatorio; sin
  descarga de paquetes offline para fuentes PMTiles.
  https://www.maplibre.org/maplibre-native/android/examples/data/PMTiles/
- `@maplibre/maplibre-react-native` 11.5.1, `gradle.properties` con `nativeVersion=13.6.1`.
- `@protomaps/basemaps` 5.7.2 (estilo).
- RNF-APP-010 (GPS solo cuando hace falta): el del teléfono no se usa en este corte.