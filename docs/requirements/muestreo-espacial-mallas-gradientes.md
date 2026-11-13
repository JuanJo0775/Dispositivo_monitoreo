# Muestreo espacial: mallas y gradientes

**Estado:** borrador para revisión · 2026-11-12
**Para qué sirve:** fijar, con respaldo publicado, cómo se pasa de “un punto medido” a “una condición
del lote por espacios”, y qué no se puede afirmar con los datos que este bastón produce.

Este documento no inventa umbrales agronómicos. Los umbrales de aptitud siguen viviendo en
`objetivo-1-umbrales-ecuaciones-motor.md`; acá se documenta **cómo se reparte el espacio** y **qué
método espacial es honesto** con cada cantidad de datos.

---

## 1. El problema: un punto no representa un lote

El suelo varía en el espacio por procesos de formación, topografía, manejo e historia del lote. Una
sola lectura describe el lugar donde se insertó la sonda, no el lote. Por eso la extensión agrícola
no recomienda una lectura única: recomienda **muestras compuestas** (varias submuestras mezcladas) o
**mallas** (el campo dividido en celdas o puntos) para capturar esa variabilidad.

La consecuencia para la app es directa: si el mapa muestra un punto y el usuario lee “el lote está
así”, la app miente. La unidad de lectura es el punto; la unidad de decisión es el espacio que ese
punto representa, y ese espacio hay que declararlo.

---

## 2. Lo que dice la literatura

### 2.1 Muestra compuesta y patrón en zigzag

- Una muestra compuesta reúne **15 a 20 submuestras** tomadas al azar en el área que se quiere
  representar (NC State Extension, AG-439-36; USDA NRCS; CSIRO).
- El patrón recomendado es **zigzag**, para no muestrear en línea recta ni en grumos, que sesgan la
  muestra hacia hileras, franjas de fertilizante o caminos (Purdue Extension, AY-368-W; NC State).
- En café, Cenicafé reporta **10 submuestras** en los primeros **20 cm** del horizonte A, mezcladas
  en unos 2 kg de suelo (González-Osorio et al., 2025).
- Profundidad: 0–20 cm es el estándar para café y pastos; 0–8 pulgadas (0–20 cm) en las guías
  estadounidenses.

**Límite importante:** la muestra compuesta es para **análisis de laboratorio**. El bastón mide una
inserción, no mezcla 15 submuestras. Una captura del bastón es una **medición puntual**; no se puede
presentar como el promedio de una celda sin decirlo.

### 2.2 Malla por celdas (cell sampling)

- El campo se divide en celdas de tamaño uniforme y **cada celda se muestrea por separado**.
- Tamaño típico: **1 a 3 acres por celda** (0,40 a 1,21 ha). Celdas más pequeñas se justifican en
  cultivos de alto valor o donde se espera más variabilidad (NC State).
- Dentro de cada celda se toman **15–20 núcleos** al azar o en patrón escalonado; se evitan los
  grumos y las líneas rectas (NC State).
- La celda produce un valor promedio que se usa para decidir ese espacio.

### 2.3 Malla por puntos e interpolación

- Se coloca una malla de **1 a 3 acres** y se muestrea en puntos (intersecciones o centros).
- Separación recomendada: **100 a 200 pies (30 a 61 m)**; a 209 pies (64 m) hay una muestra por acre
  (NC State).
- En cada punto se toman **8 a 10 núcleos** en un radio de 15–30 pies (4,5–9 m).
- Los valores se **interpolan** (IDW, spline, kriging) para estimar lo no muestreado.
- Advertencia textual de la fuente: un método de interpolación mal elegido o mal parametrizado
  “puede producir resultados y recomendaciones erróneas, costosas o injustificadas”.

### 2.4 Zonas y gradientes

- **Muestreo por zonas:** se delimitan áreas con propiedades similares (tipo de suelo, topografía,
  historial de manejo, rendimiento histórico) y se muestrea cada zona con 15–20 núcleos.
- Los **gradientes topográficos** (elevación, pendiente, orientación) explican parte de la variación
  del suelo; en estudios de variación espacial se usan para **quitar la tendencia** antes de calcular
  el semivariograma (Loescher et al., 2014).
- En un campo agrícola de Michigan, casi todas las propiedades mostraron estructura espacial y las
  mediciones predijeron valores hasta **~60 m** de distancia (Robertson et al., citado por Loescher
  et al., 2014). Ese es el orden de magnitud del “rango” en suelos agrícolas, no una regla universal.

---

## 3. Tamaño de celda y densidad

Conversiones usadas: 1 acre = 4 046,86 m² = 0,4047 ha; 1 ha = 2,471 acres; 100 pies = 30,48 m;
200 pies = 60,96 m.

| Fuente | Diseño | Tamaño / separación | Submuestras |
| --- | --- | --- | --- |
| NC State AG-439-36 | Celdas | 1–3 acres (0,40–1,21 ha) | 15–20 núcleos por celda |
| NC State AG-439-36 | Puntos | 100–200 pies (30–61 m) | 8–10 núcleos por punto |
| UNL EC154 | Malla | 1 muestra/acre; 2–2,5 acres aceptable | 5 núcleos en 8–10 pies |
| Purdue AY-368-W | Compuesta | Área homogénea | 10–20 submuestras en zigzag |
| Cenicafé 2025 | Café | 0–20 cm | 10 submuestras |

### Regla para la app

- **Celda por defecto: 0,4 ha (1 acre)**, porque el café es cultivo de alto valor y la fuente admite
  celdas menores en ese caso.
- Si el lote mide **menos de 0,4 ha**, se usa **una sola celda** que cubre el lote completo; no se
  inventan celdas más pequeñas sin respaldo.
- Si el lote mide más, la malla se ajusta a un número entero de celdas parecidas a 0,4 ha.
- La malla **no indica dónde medir**: organiza en el espacio lo que la persona ya midió.

---

## 4. Geoestadística: cuándo se puede interpolar

El semivariograma describe cómo crece la diferencia entre dos mediciones con la distancia:

- **nugget**: variación no explicada por la distancia (error de medición + microvariación).
- **sill**: varianza total.
- **range**: distancia hasta la que dos puntos siguen correlacionados.

Para construir un semivariograma representativo con datos de suelo se recomienda **al menos 100
puntos** (McBratney y Webster, citados por Loescher et al., 2014; Wadoux et al., 2019: “se acepta
generalmente que se requieren 100 unidades para una estimación robusta por el método de momentos”).

Con menos puntos:

- el semivariograma no es confiable;
- kriging no aporta una ventaja verificable sobre métodos simples;
- la superficie interpolada puede verse bien y estar equivocada.

**Consecuencia:** con 15–20 capturas no se interpola. El mapa de calor por variable sigue siendo
v2.0 (RF-APP-047) y exige, como mínimo, el umbral de puntos y la prueba de estructura espacial.

---

## 5. Gradientes: qué se puede afirmar

- La **pendiente, la elevación y el drenaje** del lote son covariables publicadas de la variación del
  suelo y sirven para **definir zonas**, no para inventar un valor entre puntos.
- La **altitud del GPS del teléfono** tiene error vertical mucho mayor que el horizontal; no se usa
  para calcular gradientes sin verificación en campo.
- Un **gradiente medido** (tendencia de una variable con la distancia o la elevación) solo se muestra
  si hay suficientes puntos y la tendencia es estadísticamente significativa. Con pocos puntos se
  declara “no concluyente”, no se dibuja una flecha.

---

## 6. Qué puede hacer la app con honestidad

### 6.1 Malla de documentación

La malla cubre el **área medida** (las coordenadas que registró el bastón), no el contorno del lote, y
así se rotula. Cada celda tiene un estado:

| Estado | Condición | Qué muestra |
| --- | --- | --- |
| `sin_dato` | 0 mediciones válidas en la celda | “sin dato”; no se colorea por clase |
| `un_punto` | 1 medición válida | la clase de ese punto, rotulada “un punto” |
| `resumen` | 2 o más mediciones válidas | mediana y mínimo–máximo, rotulado “resumen de N puntos” |
| `no_concluyente` | mediciones inválidas o sin posición | “no concluyente”, con el motivo |

- La celda **nunca** se colorea como si fuera un promedio del lote.
- Los puntos sin posición válida **no se dibujan**, pero cuentan en el historial y se informan.
- La leyenda es texto + color (RNF-APP-020).

### 6.2 Dictamen por espacio

El dictamen de una celda sale del **motor de diagnóstico** aplicado a sus mediciones, con el cultivo
y la unidad cartográfica del lote. No hay un segundo motor espacial que invente clases.

- Con una medición: el dictamen es el del punto, rotulado.
- Con varias: se muestran las clases presentes y el conteo; si todas coinciden, se puede decir la
  clase de la celda con la etiqueta “N puntos”.
- Si las clases discrepan, la celda muestra **las dos o más clases**, no un promedio.

### 6.3 Interpolación

- **Corte 3: no hay interpolación.** Celdas con dato y celdas sin dato.
- **v2.0:** superficie interpolada solo si hay ≥100 puntos con estructura espacial demostrada; se
  rotula el método y la incertidumbre.

### 6.4 Gradientes

- Las zonas por pendiente, drenaje o historial se pueden **declarar** y documentar.
- El gradiente **calculado** queda para cuando haya puntos suficientes; mientras tanto se muestra
  como “no concluyente”.

---

## 7. Consecuencias para el corte 3

1. **La malla sale de los puntos, no del lote.** El bastón ya trae GPS propio; no se camina ni se
   dibuja un perímetro. La caja que cubre los puntos se divide en celdas y se rotula “área medida”.
   El contorno del lote, si algún día existe, solo recortará la malla.
2. **Migración nueva:** `config_id` en las mediciones, tabla de paquetes de mapa y relleno del lote
   en lo ya sincronizado. La malla no se guarda: se recalcula.
3. **Pantalla de mapa:** celdas con estado, puntos, celda seleccionada; leyenda en texto y
   atribución de teselas.
4. **Pantalla de celda:** dictamen, mediciones que lo sostienen, fecha y motivo cuando no concluye.
5. **Pruebas:** celda vacía, celda con un punto, celda con clases discrepantes, punto sin posición,
   un solo punto, puntos en línea, área con más de 400 celdas.
6. **Nada de contadores ni metas:** la malla documenta; no dirige el muestreo.

---

## 8. Decisiones abiertas

1. **Cómo se obtiene el polígono del lote:** dibujar sobre el mapa, recorrer el perímetro con GPS, o
   importar un archivo. Afecta la precisión de la malla.
2. **Celda de 0,4 ha vs. 1 ha** como valor por defecto para café en la zona de estudio.
3. **Qué hacer cuando la celda tiene 2 mediciones:** mostrar ambas o un resumen con mediana.
4. **Umbral de puntos para el gradiente** y prueba estadística asociada (v2.0).
5. **Unidad cartográfica:** hoy se declara en el lote; el documento científico la resuelve por
   georreferenciación contra cartografía precargada. Ese salto es un proyecto aparte.

---

## 9. Referencias

1. Austin, R., Gatiboni, L., Havlin, J. (2020, rev. 2025). *Soil Sampling Strategies for
   Site-Specific Field Management*. NC State Extension, AG-439-36.
   https://content.ces.ncsu.edu/soil-sampling-strategies-for-site-specific-field-management
2. University of Nebraska–Lincoln. *Soil Sampling for Precision Agriculture* (EC154).
   https://cropwatch.unl.edu/soil-sampling-precision-agriculture/
3. Purdue Extension. *Soil Sampling Guidelines* (AY-368-W).
   https://www.extension.purdue.edu/extmedia/AY/AY-368-w.pdf
4. CSIRO. *Soil Sampling Manual*.
   https://research.csiro.au/pacsoils/wp-content/uploads/sites/404/2021/12/2-Soil-sampling-manual.pdf
5. USDA NRCS. *Small Scale Solutions for your Farm: Soil Testing*.
   https://www.usda.gov/sites/default/files/guidance-documents/NRCS.small-scale-solutions-soil-testing.pdf
6. Loescher, H., Ayres, E., Duffy, P., Luo, H., Brunke, M. (2014). *Spatial Variation in Soil
   Properties among North American Ecosystems and Guidelines for Sampling Designs*. PLoS ONE 9(1):
   e83216. https://doi.org/10.1371/journal.pone.0083216
7. Wadoux, A. M. J.-C., et al. (2019). *Efficient sampling for geostatistical surveys*. European
   Journal of Soil Science. https://doi.org/10.1111/ejss.12797
8. González-Osorio, H., et al. (2025). *An approach for predicting phosphorus…*. Cenicafé.
   https://publicaciones.cenicafe.org/index.php/cenicafe/article/download/4977/5278/3994
9. Ouabo, R. E., et al. (2020). *Assessment of Ordinary Kriging and Inverse Distance Weighting
   Methods for Modeling…*. PMC7269327. https://pmc.ncbi.nlm.nih.gov/articles/PMC7269327/
10. Munyati, C., et al. (2021). *Comparative suitability of ordinary kriging and inverse distance
    weighted interpolation…*. https://doi.org/10.1016/j.gecco.2021.e01569

---

## 10. Lo que este documento no afirma

- No afirma que 15–20 capturas alcancen para interpolar un lote.
- No afirma que una celda de 0,4 ha sea válida en todos los suelos; es el valor publicado para
  cultivos de alto valor y se ajusta al área real.
- No afirma que la malla reemplace el criterio del técnico ni el análisis de laboratorio.
- No convierte la muestra compuesta de laboratorio en una medición del bastón.
