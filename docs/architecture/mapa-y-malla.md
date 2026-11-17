# Mapa del lote: malla, posición y dictamen

Este documento explica cómo la app convierte mediciones sueltas en una malla con dictamen por
espacio. Es el contrato entre `src/domain/geo/`, `src/application/map/` y la pantalla del mapa.

La app es un sistema de **documentación y diagnóstico**: dice qué se midió, dónde y qué significa.
No es una guía de muestreo: no indica cuántos puntos tomar, no cuenta puntos faltantes y no declara
un muestreo «completo». La persona mide donde decide; la app documenta lo que hay.

## 1. Posición: solo el GPS del bastón

La posición de cada punto sale del GPS del bastón, capturada en el momento de la medición. La app
**no usa el GPS del teléfono** y no pide caminar el contorno del lote.

`readPosition(payload, positionValid)` en `src/domain/geo/position.ts`:

| Regla | Resultado |
| --- | --- |
| `positionValid === false` | sin posición, aunque lleguen coordenadas |
| latitud o longitud `null` | sin posición |
| `0,0` | sin posición (un GPS sin fix reporta ceros) |
| HDOP ≤ 2 | `buena` |
| HDOP ≤ 5 | `aceptable` |
| HDOP > 5 | `imprecisa` |
| sin HDOP | `aceptable`; no se afirma una precisión que no se conoce |

El HDOP se muestra tal cual, nunca se convierte a metros. Un punto sin posición **sí existe**: se
lista, se diagnostica y se exporta; solo no se dibuja en la malla.

## 2. La malla

`buildGrid(points, targetAreaHa = 0.4)` en `src/domain/geo/grid.ts`:

1. Proyecta los puntos a un plano local (equirectangular, latitud media como origen).
2. Calcula la caja envolvente.
3. Solo los ejes **sin dispersión** crecen hasta `√(área objetivo × 10 000)`; un eje con dispersión
   medida nunca se agranda, porque la malla no inventa área que los puntos no delimitan. Un solo
   punto produce una celda; una línea de puntos crece solo a lo ancho.
4. Busca filas × columnas con área de celda cercana a la objetivo, relación de aspecto entre 0,4 y
   2,5, y desempata por cercanía al cuadrado y luego `columnas ≥ filas`.
5. Si ningún par califica (cajas muy alargadas), usa una sola fila o una sola columna con la celda
   más parecida a un cuadrado; se acepta una celda fea antes que agrandar la caja.
6. Si la malla supera **400 celdas**, sube el área objetivo una sola vez y lo informa
   (`grid.adjusted === true`); la pantalla muestra el área resultante.
7. Las celdas son rectángulos completos, alineados al norte, sin recorte. La fila 0 es el norte, la
   columna 0 el oeste; el identificador es `r<fila>c<columna>`.

**La malla no se guarda.** Se recalcula cada vez con los puntos vigentes del lote; por eso una
medición que se asigna a otro lote cambia la malla sin migrar nada.

## 3. Dictamen por celda

`verdictForCell(inputs)` en `src/domain/geo/cell-verdict.ts` solo lee diagnósticos ya guardados. No
calcula clases, no promedia clases y no elige la peor.

| Estado | Cuándo | Qué se muestra |
| --- | --- | --- |
| `sin_dato` | ninguna medición válida en la celda | «Sin dato», nunca un color de clase |
| `un_punto` | una medición válida con diagnóstico utilizable | sus clases posibles, sin colapsarlas |
| `resumen` | dos o más mediciones válidas con el mismo conjunto de clases | el conjunto y el conteo de puntos |
| `no_concluyente` | hay mediciones válidas pero falta diagnóstico, está bloqueado, faltan datos o los conjuntos de clases difieren | el motivo y cómo se reparten los grupos |

Motivos, en orden de prioridad: `sin_diagnostico`, `diagnostico_bloqueado`, `datos_insuficientes`,
`clases_distintas`. Los grupos de clases se devuelven igual, así que la celda muestra lo que sí se
sabe además del motivo.

Un dictamen de dos clases (por ejemplo «entre S1 y S2») es un **rango**: se conserva como rango en
la celda, en la leyenda y en el mapa (relleno de una clase y borde de la otra). Nunca se elige una
de las dos.

### Resumen por variable

Solo con estado `resumen`, `summarizeVariables` calcula mediana, mínimo, máximo y número de puntos
por variable, sobre las mediciones válidas y diagnosticadas de la celda. En un dictamen no
concluyente no hay resumen: promediar sería inventar consenso.

## 4. Puntos, no celdas

- Una medición **inválida** pertenece a su celda y cuenta en `invalidPoints`, pero no entra al
  dictamen.
- Una medición **sin posición** queda en la lista con «sin posición» y `cellId = null`.
- Una medición **fuera de la caja** solo puede pasar por una carrera de datos; se cuenta en
  `outsideArea` y no se dibuja.
- La lista de puntos muestra siempre la medición completa (fecha, lote, valores, calidad de
  posición), aunque el mapa no la pueda ubicar.

## 5. Diagnósticos que faltan

Lo sincronizado por BLE o por CSV llega sin diagnóstico. Antes de dibujar, la pantalla corre
`ensurePlotDiagnoses(plotId)`:

- diagnóstica cada medición del lote que no tenga ninguno;
- usa **la sesión que guardó su `configId`** (`sessions.get(measurement.sessionId)`), no la sesión de
  hoy del lote: usar la actual dictaminaría con umbrales ajenos;
- primero descarta las inválidas, después las que no tienen sesión;
- no recalcula lo que ya existe (el diagnóstico es inmutable);
- si una falla, la cuenta y sigue; el mapa abre con lo que sí se pudo completar y la pantalla avisa.

## 6. ¿A qué lote pertenece una medición?

Orden de resolución al ingerir (`resolve-capture-assignment.ts`, diseño §8.1):

1. `payload.plotCode` coincide con el **id** de un lote existente → ese lote;
2. `configId` coincide con una sesión guardada → el lote de esa sesión, si todavía existe (la sesión
   se conserva aunque su lote se haya borrado: el motor la necesita para dictaminar);
3. nada de lo anterior resolvió → el lote que la pantalla tenía seleccionado;
4. si tampoco hay, la medición queda sin lote y la persona puede asignarlo desde el historial.

Una captura que llegó sin lote se puede asignar después:

- el arranque rellena solo los campos vacíos y nunca pisa un lote asignado a mano
  (`backfillMeasurementContext`);
- el historial muestra el lote de cada medición y, si no tiene, abre el selector de lotes
  (`PlotPicker`). La asignación cambia **solo `plot_id`**: los valores medidos, la hora y el
  diagnóstico quedan igual.

## 7. Dibujo

`src/ui/components/map/`:

| Archivo | Qué hace |
| --- | --- |
| `plot-map.tsx` | MapLibre con las fuentes base y detallada, celdas y puntos como GeoJSON |
| `fallback-map.tsx` | Croquis con celdas y puntos para cuando el mapa de teselas no puede abrir |
| `map-error-boundary.tsx` | Atrapa un fallo al montar el módulo nativo y cambia al croquis |
| `map-colors.ts` | Colores y etiquetas por clase; relleno y borde del rango de dos clases |
| `map-geometry.ts` | Pasa la malla local a GeoJSON y calcula la caja con relleno del 10 % |
| `map-legend.tsx` | Leyenda; siempre incluye «Sin dato» y «No concluyente» |
| `cell-sheet.tsx` | Detalle de la celda tocada: estado, área, grupos, resumen y puntos |
| `point-list.tsx` | Lista de puntos documentados, incluidos los que no van al mapa |

Reglas de honestidad visual:

- una celda `sin_dato` nunca lleva color de clase;
- un punto `imprecisa` se dibuja como anillo hueco, no como punto lleno;
- la caja del mapa se abre sobre los puntos y se reencuadra a pedido («Encuadrar»);
- la atribución «Teselas © OpenStreetMap · Protomaps» siempre está visible.

Cuando el mapa de teselas no puede abrir —MapLibre avisa que falló al cargar el estilo o el paquete,
o el módulo nativo revienta al montar— la pantalla **cambia al croquis** y lo dice con un aviso. El
área medida, sus celdas y sus puntos nunca quedan en blanco (diseño §11.4). El croquis usa la misma
proyección y permite tocar celdas y puntos igual que el mapa.

Si la malla se ajustó para no pasar de 400 celdas, la cabecera lo dice con el tamaño de celda
resultante: nadie debe leer la malla como si fuera la original de 0,4 ha.

## 8. Paquetes de mapa

- **Incluido:** `assets/maps/base.pmtiles`, Colombia a zoom 0–6, versionado en el repositorio y
  empaquetado en el APK por `plugins/with-map-assets.js`.
- **Detallado:** la persona importa un `.pmtiles` desde el teléfono en «Paquetes de mapa»; se copia
  al almacenamiento privado y se dibuja encima del incluido. No se descarga nada.
- Un paquete importado queda activo; «Usar solo el incluido» vuelve al base. Borrar el activo
  devuelve el mapa al incluido.
- Al importar se comprueba la **firma** `PMTiles` en los primeros bytes, antes de leer el tamaño o
  copiar: un archivo cualquiera renombrado se rechaza y no entra al mapa.
- Cómo se generan: `assets/maps/README.md` y `scripts/map/extract-pmtiles.mjs`.

## 9. Pruebas que lo sostienen

| Prueba | Qué defiende |
| --- | --- |
| `tests/domain/geo/grid.test.ts` | caja, ejes degenerados, tope de 400 celdas, aspecto |
| `tests/domain/geo/cell-verdict.test.ts` | estados, motivos y no promediar clases |
| `tests/domain/geo/position.test.ts` | bandera, `0,0` y umbrales de HDOP |
| `tests/application/map/describe-plot-space.test.ts` | armado del espacio y conteos |
| `tests/application/map/ensure-plot-diagnoses.test.ts` | sesión por `configId` e idempotencia |
| `tests/integration/map-flow.test.ts` | flujo completo sobre SQLite real: finca → lote → sesión → capturas → malla |
| `tests/ui/components/map-*`, `cell-sheet`, `point-list` | que la UI no invente ni oculte |

## 10. Fuera de alcance de este corte

- Interpolación entre puntos y mapa de calor (RF-APP-047, v2.0).
- Gradientes calculados y dirección de pendiente.
- Perímetro o polígono del lote.
- Resolución de la unidad cartográfica desde coordenadas.
- Etiquetas de lugares (requieren empaquetar glifos).
