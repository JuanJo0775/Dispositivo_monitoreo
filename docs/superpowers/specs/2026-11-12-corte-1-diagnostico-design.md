# Corte 1 — Motor de diagnóstico y recorrido de campo mínimo

> Diseño aprobado para construir. Ciencia de origen:
> `docs/requirements/objetivo-1-umbrales-ecuaciones-motor.md` (Objetivo 1 v2, agosto 2026).
> Diseño general de la app: `docs/superpowers/specs/2026-11-12-app-movil-arquitectura-design.md`.
> Todo número de este documento sale de una tabla citada. Nada se completa por analogía.

**Objetivo:** que la app emita un diagnóstico de aptitud del suelo con su versión de umbrales, su
contexto de lote y su evidencia, sin internet y sin servidor.

**Decidido con la persona el 2026-11-12:** alcance, cultivos, unidad cartográfica, tratamiento de
P/K/N, tratamiento de la CE y aviso de privacidad.

---

## 1. Alcance

### 1.1 Entra en el corte 1

1. Fincas y lotes (alta, edición, borrado lógico).
2. Unidad cartográfica como catálogo de las 5 unidades del Quindío.
3. Configuración de sesión: bloque que la app escribe al bastón y copia inmutable del contexto.
4. Set de umbrales versionado en `assets/thresholds/`, validado con Zod e importado a la base.
5. Motor de diagnóstico puro: clases, intervalos, factor limitante, alertas y evidencia.
6. Modo ensayo.
7. Ajustes mínimos y aviso de privacidad (primer arranque y Ajustes).
8. Integración punta a punta sobre SQLite real.

### 1.2 No entra en el corte 1

Dosis (tablas 19–22): corte 5. Mapas y teselas: corte 3. BLE real y microSD: corte 2.
Calibración individual por sonda: corte 4. Kriging y submuestreo agregado: corte 3.
Importación de sets nuevos desde el teléfono: corte 3.

### 1.3 Antiobjetivos

- Ningún valor de la ciencia se inventa, se completa por analogía ni se deduce de otro cultivo.
- Ninguna celda vacía de la tabla 17 se rellena.
- Ningún dato del usuario sale del teléfono sin una acción explícita.
- Ninguna clase única cuando el intervalo de la lectura cruza clases.

---

## 2. Decisiones con la persona

| # | Decisión | Elección |
| --- | --- | --- |
| D1 | Alcance | Completo según spec, sin dosis ni mapas. |
| D2 | Cultivos | Los cinco de la tabla 17: café, plátano, banano, aguacate Hass, cítricos. |
| D3 | Unidad cartográfica | Catálogo de las 5 unidades del Quindío. |
| D4 | Variables | **Todas las variables medidas entran al diagnóstico**, cada una con su rol y su etiqueta. |
| D5 | CE | **Alerta, no enclavamiento**: la ciencia no publica el umbral de seguridad. |
| D6 | Privacidad | Al primer arranque y en Ajustes; todo local. |

### 2.1 Cómo se cumple D4

Cada variable medida produce un resultado computado con uno de tres roles:

| Rol | Significado | Variables del corte 1 |
| --- | --- | --- |
| `verdict` | Entra en la ley del mínimo y sostiene la clase final de aptitud. | Humedad; pH de café; N estimado desde MO (solo café). |
| `indicative` | Se calcula y se muestra con su intervalo, pero la fuente lo reserva a variabilidad relativa dentro del lote, así que no mueve la clase. | P; K; pH de los otros cultivos; MO y CIC estimados. |
| `reference` | No hay umbral comparable o no diagnostica; se muestra el dato con su explicación. | CE (alerta); temperatura. |

La app nunca deja una variable medida fuera de la pantalla: cada una aparece con su rol, su valor,
su banda de referencia, su incertidumbre y, cuando el intervalo cruza clases, con la frase
«no se puede elegir clase con esta sonda» y el motivo publicado.

---

## 3. Datos verificados de la ciencia

### 3.1 Unidades cartográficas (tabla 3, Quindío; MO de la tabla 8)

| Unidad | Material parental | MO % | Da g/cm³ | Dr | Pt % | CC % (grav) | PMP % (grav) | CAA % (vol) | N ec. 4 % | N mineralizado kg/ha/año |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chinchiná | Ceniza volcánica | 14,33 | 0,72 | 2,03 | 64,91 | 67,12 | 38,90 | 19,49 | 0,535 | 115,5 |
| Quindío | Ceniza volcánica | 11,42 | 0,82 | 2,15 | 61,98 | 42,64 | 29,70 | 10,57 | 0,451 | 110,9 |
| Montenegro | Ceniza volcánica | 6,25 | 1,07 | 2,25 | 52,21 | 26,14 | 15,55 | 11,30 | 0,275 | 88,2 |
| Génova | Esquisto | 6,16 | 1,19 | 2,33 | 48,96 | 32,65 | 17,51 | 17,89 | 0,271 | 96,8 |
| Buenavista | Ígnea extrusiva | 5,54 | 1,29 | 2,34 | 44,77 | 32,24 | 15,06 | 22,23 | 0,248 | 95,9 |

La tabla 3 publica 15 unidades; el corte 1 expone las 5 del Quindío (D3). Las otras 10 quedan
disponibles para una versión posterior del set.

### 3.2 Humedad: tabla 15 y ecuación 11

`θ_umbral = CCv − p × CAA`, con `CCv = CC_grav × Da` (ecuación 8) y `p` de la tabla 14.

| Unidad | CCv % v/v | PMPv % v/v | CAA % v/v | Café (p 0,40) | Plátano y banano (p 0,35) | Aguacate (p 0,70) | Cítricos (p 0,50) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chinchiná | 48,3 | 28,0 | 20,3 | 40,2 | 41,2 | 34,1 | 38,2 |
| Quindío | 35,0 | 24,4 | 10,6 | 30,7 | 31,3 | 27,5 | 29,7 |
| Montenegro | 28,0 | 16,6 | 11,3 | 23,4 | 24,0 | 20,0 | 22,3 |
| Génova | 38,9 | 20,8 | 18,0 | 31,6 | 32,5 | 26,2 | 29,8 |
| Buenavista | 41,6 | 19,4 | 22,2 | 32,7 | 33,8 | 26,1 | 30,5 |

Los umbrales se calculan con la fórmula y se validan contra estos números en las pruebas.
Cítricos: manejo por debajo de 80 % de la capacidad de campo (tabla 13).

### 3.3 pH (tablas 9, 13 y 17)

| Cultivo | Banda óptima | Límites absolutos | Rol |
| --- | --- | --- | --- |
| Café | 5,0–5,5 | superior publicado: «mayor a 6,0 perjudica» | `verdict` |
| Plátano | 5,5–7,0 | ninguno publicado | `indicative` |
| Banano | 5,5–7,0 | inferior publicado: «alerta si pH menor a 5,5» (Al fitotóxico) | `indicative` |
| Aguacate Hass | 5,0–7,0 | ninguno publicado | `indicative` |
| Cítricos | 4,5–6,0 | ninguno publicado | `indicative` |

### 3.4 Nitrógeno: ruta indirecta (tablas 5, 8, 9 y ecuación 4)

- La lectura de N de la sonda **no alimenta el diagnóstico**: su fondo de escala es 1.999 mg/kg y el
  umbral de café es 0,34 % de N total, equivalente a 3.400 mg/kg. La fuente lo dice sin ambigüedad:
  «Fuera de rango y de fracción» (tabla 36) y «el campo de nitrógeno del sensor no alimenta el
  diagnóstico de aptitud» (sección 4.5.2).
- La ruta sancionada es la ecuación 4 sobre la materia orgánica de la unidad cartográfica:
  `N = 0,01644 + 0,045277 × MO − 0,00063493 × MO²`, con la MO de la tabla 3.
- Bandas de café (tabla 9): bajo menor a 0,34 %, medio 0,34–0,58 %, alto mayor a 0,58 %.
- Solo café tiene umbral de N publicado; los otros cuatro cultivos no tienen banda de N.
- La interfaz debe distinguir visualmente el N estimado de lo medido (sección 4.5.2). En la app el
  N estimado aparece con la etiqueta «estimado», nunca como «medido».

### 3.5 Fósforo y potasio: comparables en mg/kg, con etiqueta de confianza baja

- P (tabla 17, con el método publicado): café Bray II 10/20; plátano Bray II 8/15; banano Olsen
  modificada 10/20; aguacate Bray 8/13; cítricos 10–20 (sin método). Tabla 11 además: Olsen
  20/40 y Bray 8/13.
- K (tabla 17, en cmol/kg): café 0,2/0,4; plátano 0,29 crítico y 0,35 de fertilización (tabla 13);
  banano 0,2/0,5; aguacate 0,2/0,4; cítricos 0,3–0,4.
- Conversión publicada (tabla 6): 1 cmol de carga por kg de K equivale a 390,98 mg/kg. La tabla 9
  publica el equivalente en mg/kg de café: **78–156 mg/kg**.
- La fuente las reserva a variabilidad relativa dentro del lote: «deben reservarse para mapeo de
  variabilidad relativa dentro del lote, el fósforo y el potasio» (sección 12.2) y «ninguna
  calibración puede hacer que el fósforo discrimine clases» (sección 12.7).
- Consecuencia medible y verificable: con ±40 mg/kg de incertidumbre, en P el intervalo cubre de
  dos a cuatro veces el rango de decisión, así que el resultado «será siempre indeterminado, que es
  la afirmación correcta» (sección 13.4). En K la incertidumbre cubre la mitad de la banda.

Por eso P y K son `indicative`: la app calcula su banda, muestra el intervalo y dice que no puede
elegir clase. No es un hueco de la app: es el resultado que publica la ciencia.

### 3.6 Conductividad eléctrica (tablas 13, 16 y 17)

Café: afecta desde 1,1 dS/m (1.100 µS/cm). Plátano, banano, aguacate y cítricos: menor a 2 dS/m.
La fuente no publica el «umbral de seguridad» del enclavamiento (sección 12.3 lo deja como tarea de
calibración), así que la CE produce **alerta**, no veto (D5). La compensación térmica de la
ecuación 15 se aplica antes de comparar.

### 3.7 Restricciones duras (tablas 39 y 1)

| Restricción | Criterio | Efecto en la app |
| --- | --- | --- |
| Validez temporal | 3 a 4 meses tras la última fertilización | Sin veredicto. |
| Altitud | Fuera de la franja del cultivo | Sin veredicto; no apto por altitud. |
| Drenaje | Deficiente en aguacate Hass | Sin veredicto. |
| Profundidad efectiva | Por debajo del mínimo del cultivo | Solo aviso: no hay mínimo publicado. |
| Densidad de siembra | Fuera de 1.500–2.500 plantas/ha en plátano | Aviso. |
| Enclavamiento por CE | Sobre el umbral de seguridad | Sin valor publicado → alerta (D5). |

Franja altitudinal (tabla 1): café 1.200–2.000 m; plátano Dominico-Hartón hasta 1.400 m (la fuente
declara sin resolver una discrepancia con 800–1.500 m); banano Cavendish 0–300 m y material regional
del Eje Cafetero 1.000–1.800 m; aguacate Hass hasta 2.800 m en patrón mexicano o guatemalteco y
menor a 800 m en patrón antillano; cítricos óptimo menor a 1.800 m.

### 3.8 Clases e índices (tabla 40 y ecuaciones 37 y 38)

| Clase | Índice | Denominación |
| --- | --- | --- |
| S1 | S ≥ 0,75 | Apto |
| S2 | 0,50 ≤ S < 0,75 | Moderadamente apto |
| S3 | 0,25 ≤ S < 0,50 | Marginalmente apto |
| N | S < 0,25 | No apto |

`S_mín = mín(S_i)` (ec. 37) e `S_par = S_mín × √(∏ S_j)` (ec. 38), con la advertencia de la fuente
sobre la formulación del índice paramétrico.

### 3.9 Funciones de aptitud (ecuaciones 34 a 36 y 39)

- Banda ascendente (34): `S(x) = (x − m) / (L − m)` para `m < x < L`; vale 1 dentro de la banda.
- Banda descendente (35): `S(x) = (M − x) / (M − U)` para `U < x < M`.
- Creciente (36): `S(x) = 0,5 + 0,5 × (x − T₁) / (T₂ − T₁)` para `T₁ ≤ x < T₂`; 1 por encima de T₂.
- Decresciente: reflexión de la anterior.
- Incertidumbre (39): `S_inf = mín(S(x − u), S(x + u))`, `S_sup = máx(S(x − u), S(x + u))`.

### 3.10 Incertidumbre del instrumento (tabla 35) y su contraste (tabla 36)

| Variable | Exactitud | Contraste publicado |
| --- | --- | --- |
| Humedad | ±2 % de 0 a 50 %; ±3 % de 50 a 100 % | Cubre el 10 % del rango en Chinchiná: bien dimensionada. |
| pH | ±0,3 | Cubre el 60 % de la banda óptima de café: no se resuelve la clasificación. |
| CE | ±3 %, resolución 10 µS/cm | Bien dimensionada frente al umbral de 1.100 µS/cm. |
| N, P, K | ±2 % del fondo de escala ≈ ±40 mg/kg | En café, K: la banda media mide 78 mg/kg y la incertidumbre cubre la mitad. En P: 2 a 4 veces el rango. |
| Temperatura | ±0,5 °C | No diagnostica. |

Para el N estimado se usa como incertidumbre la diferencia entre las dos rutas institucionales de
la tabla 8 (11,8 % a 34,0 % según la unidad): es una incertidumbre publicada, no supuesta.

### 3.11 Límites estructurales del instrumento (tabla 42)

| Limitación | Decisión adoptada por la fuente | Cómo se ve en la app |
| --- | --- | --- |
| Nitrógeno | Diagnóstico por estimación indirecta desde MO, con valores precalculados por unidad | N estimado con etiqueta «estimado»; la lectura de la sonda se muestra como referencia con el motivo «fuera de rango y de fracción». |
| Fósforo | Uso exclusivo para mapeo de variabilidad relativa | Banda de P con intervalo y la frase «no se puede elegir clase». |
| Relaciones catiónicas (Ca, Mg, K) | Deben ingresarse desde análisis de laboratorio | K en mg/kg con etiqueta de confianza baja; Ca y Mg no están en la sonda. |
| Conductividad del extracto | Uso como enclavamiento y valor relativo hasta calibración | CE como alerta con el umbral agronómico del cultivo. |
| Encalado | El dispositivo detecta que el pH está fuera de banda y no calcula dosis | Sin dosis en este corte; la alerta de pH deja constancia. |

---

## 4. Modelo de datos (migración 2)

La migración 1 no se modifica.

```sql
ALTER TABLE plots ADD COLUMN cartographic_unit TEXT;
ALTER TABLE measurements ADD COLUMN session_id TEXT REFERENCES sessions(id);
ALTER TABLE measurements ADD COLUMN thresholds_version TEXT;
ALTER TABLE measurements ADD COLUMN calibration_version TEXT;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  plot_id TEXT NOT NULL REFERENCES plots(id),
  config_id INTEGER NOT NULL,
  crop_primary TEXT NOT NULL,
  crop_secondary TEXT,
  depth_cm INTEGER NOT NULL,
  cartographic_unit TEXT NOT NULL,
  last_fertilization_date TEXT,
  thresholds_version TEXT NOT NULL,
  firmware_version TEXT,
  sent_at TEXT NOT NULL,
  accepted_at TEXT,
  status TEXT NOT NULL
);

CREATE TABLE threshold_sets (
  version TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  checksum TEXT NOT NULL,
  source TEXT NOT NULL,
  activated_at TEXT NOT NULL
);

CREATE TABLE diagnoses (
  id TEXT PRIMARY KEY,
  measurement_id TEXT NOT NULL REFERENCES measurements(id),
  engine_version TEXT NOT NULL,
  thresholds_version TEXT NOT NULL,
  calibration_version TEXT NOT NULL,
  firmware_version TEXT,
  context_snapshot_json TEXT NOT NULL,
  classes_json TEXT NOT NULL,
  limiting_factors_json TEXT NOT NULL,
  alerts_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  uncertainty_json TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE INDEX idx_diagnoses_measurement ON diagnoses (measurement_id);
CREATE INDEX idx_sessions_plot ON sessions (plot_id, sent_at DESC);
```

---

## 5. Motor de diagnóstico

### 5.1 Contrato

```ts
type AptitudeClass = 'S1' | 'S2' | 'S3' | 'N';
type VariableRole = 'verdict' | 'indicative' | 'reference';

type VariableResult = {
  variable: 'humidity' | 'ph' | 'ec' | 'n' | 'p' | 'k' | 'temperature' | 'organicMatter' | 'cic';
  role: VariableRole;
  status: 'class' | 'interval' | 'band' | 'alert' | 'reference';
  value: number | null;
  unit: string;
  uncertainty: number | null;
  class: AptitudeClass | null;
  band: string | null;                 // 'bajo' | 'medio' | 'alto' | 'optimo' | 'fuera de banda'
  possibleBands: string[];
  suitability: number | null;          // valor S
  suitabilityInterval: { lower: number; upper: number } | null;
  confidence: 'alta' | 'media' | 'baja' | 'estimada' | null;
  reference: string | null;            // umbral o banda publicada, con su unidad
  method: string | null;               // método con que se comparó, cuando difiere
  reason: string | null;               // por ejemplo 'umbral_no_comparable'
};

type DiagnosisResult = {
  validity: 'valid' | 'blocked' | 'insufficient_data';
  classes: AptitudeClass[];
  perVariable: VariableResult[];
  limitingFactors: { variable: string; suitability: number; class: AptitudeClass }[];
  alerts: { code: string; severity: 'info' | 'warning' | 'blocking'; message: string }[];
  evidence: {
    thresholdsVersion: string;
    crop: string;
    cartographicUnit: string | null;
    rules: string[];
    assumptions: string[];
    missing: string[];
    sources: string[];
  };
  versions: { engine: string; thresholds: string; calibration: string; firmware: string | null };
  explanation: string;
};
```

### 5.2 Fases (1 a 7 de la sección 13.5 de la fuente; la fase 8 de dosis no existe todavía)

1. **Validez del dato**: banderas del contrato (b2 sonda OK, b4 hora válida), rangos, origen de
   ensayo y validez temporal de nutrientes (3 a 4 meses desde la última fertilización).
2. **Restricciones duras**: altitud, drenaje, profundidad efectiva (aviso) y densidad de siembra.
3. **Carga de parámetros** de la unidad cartográfica (MO, Da, CC, PMP, CAA).
4. **Conversiones**: humedad a % de agua disponible (ec. 12); CE de µS/cm a dS/m y compensación
   térmica (ec. 15); K de mg/kg a cmol/kg con el factor 390,98 (ec. 6 y tabla 6) cuando el umbral
   venga en cmol/kg.
5. **Estimación indirecta**: N total con la ecuación 4 y MO de la unidad; CIC con la ecuación 5
   (`CIC = 10,26 + 1,25 × MO`), ambos etiquetados como estimados.
6. **Aptitud por variable e intervalo** (ecuaciones 34 a 36 y 39) con la incertidumbre de la
   tabla 35 y, en el N estimado, la diferencia entre rutas de la tabla 8.
7. **Factor limitante, índice paramétrico y clases** (ecuaciones 37 y 38, tabla 40).

### 5.3 Qué se calcula por variable

| Variable | Cálculo | Rol | Resultado esperado |
| --- | --- | --- | --- |
| Humedad | Banda `[θ_umbral, CCv]` con la unidad cartográfica y el cultivo | `verdict` | Clase decidible; la incertidumbre cubre el 10 % del rango. |
| pH café | Banda `[5,0, 5,5]` con límites 4,0 y 6,0 | `verdict` | Con ±0,3 el intervalo suele cruzar y se devuelven todas las clases. |
| pH otros cultivos | Banda publicada sin límites absolutos | `indicative` | Solo dentro o fuera de la banda. |
| N estimado (café) | Ecuación 4 sobre la MO de la unidad; banda 0,34/0,58 % | `verdict` | Clase según la banda, con incertidumbre de la diferencia entre rutas. |
| N de la sonda | Lectura en mg/kg | `reference` | Fuera de rango y de fracción: se muestra el valor y el motivo. |
| P | Banda publicada en mg/kg con su método | `indicative` | Intervalo que casi siempre cruza: «no se puede elegir clase». |
| K | Banda publicada, convertida a mg/kg con 390,98 o con el equivalente publicado | `indicative` | Banda e intervalo; confianza baja. |
| CE | dS/m compensada (ec. 15) contra el umbral del cultivo | `reference` | Alerta por encima del umbral; no da clase. |
| Temperatura | Solo lectura | `reference` | No diagnostica. |
| MO | MO de la unidad | `indicative` | Banda publicada del cultivo. |
| CIC | Ecuación 5 con la MO de la unidad | `indicative` | Banda publicada de café (15/25). |

### 5.4 Supuestos (van en `evidence.assumptions`)

1. `humedad_limites_fisicos`: la banda de humedad usa `m = 0 % v/v` y `M = 100 % v/v`, porque la
   fuente publica la banda sin estrés y los límites de daño total no están publicados.
2. `ph_cafe_limite_inferior`: límite inferior absoluto del pH de café en 4,0, tomado del texto «a pH
   cercano a 4,0 las concentraciones [de Al] son muy altas».
3. `ph_cafe_limite_superior`: límite superior absoluto del pH de café en 6,0, del texto «mayor a 6,0
   perjudica».
4. `creciente_desde_cero`: en variables crecientes, S vale 0 en contenido cero.
5. `indice_parametrico_advertencia`: el índice paramétrico se calcula sobre las variables con umbral
   comparable y viaja con la advertencia de la fuente sobre la formulación de la ecuación 38.

### 5.5 Vacíos que quedan por escrito (`evidence.missing`)

Umbral de seguridad de CE para el enclavamiento; límites absolutos de pH de plátano, banano,
aguacate y cítricos; profundidad efectiva mínima por cultivo; umbrales de temperatura del suelo;
constantes de calibración por sonda; factores de conversión de cationes distintos de los de la
tabla 6; equivalencia publicada entre N total en % y mg/kg.

---

## 6. Set de umbrales versionado

Archivo `assets/thresholds/2026.11-v1.json`, validado con Zod, con `checksum` sobre el contenido y
guardado en `threshold_sets` al abrir la app.

```jsonc
{
  "schemaVersion": 1,
  "version": "2026.11-v1",
  "source": "Objetivo 1 v2 (agosto 2026): tablas 1, 3, 8, 9, 11, 13, 14, 15, 17, 35, 36, 39, 40",
  "crops": {
    "cafe": {
      "label": "Café",
      "altitude": { "minM": 1200, "maxM": 2000, "source": "tabla 1" },
      "drainage": { "veto": false, "note": null },
      "variables": {
        "humidity": { "role": "verdict", "kind": "band", "unit": "% v/v", "confidence": "alta",
          "uncertainty": { "model": "relative", "percent": 2, "percentAbove": 3, "abovePct": 50 } },
        "ph": { "role": "verdict", "kind": "band", "unit": "adimensional", "confidence": "media",
          "optimal": [5.0, 5.5], "absoluteLower": 4.0, "absoluteUpper": 6.0,
          "uncertainty": { "model": "absolute", "value": 0.3 } },
        "nEstimated": { "role": "verdict", "kind": "increasing", "unit": "%", "confidence": "estimada",
          "lowMedium": 0.34, "mediumHigh": 0.58, "source": "tabla 9" },
        "p": { "role": "indicative", "kind": "band", "unit": "mg/kg", "confidence": "baja",
          "method": "Bray II", "lowMedium": 10, "mediumHigh": 20,
          "uncertainty": { "model": "absolute", "value": 40 } },
        "k": { "role": "indicative", "kind": "band", "unit": "mg/kg", "confidence": "baja",
          "method": "Acetato de amonio 1 N pH 7,0 (convertido con la tabla 6)", "lowMedium": 78, "mediumHigh": 156,
          "uncertainty": { "model": "absolute", "value": 40 } },
        "ec": { "role": "reference", "kind": "decreasing", "unit": "dS/m", "confidence": "media",
          "alertAbove": 1.1, "uncertainty": { "model": "relative", "percent": 3 } },
        "temperature": { "role": "reference", "kind": "none", "unit": "°C" },
        "organicMatter": { "role": "indicative", "kind": "band", "unit": "%", "confidence": "baja",
          "lowMedium": 8, "mediumHigh": 16, "source": "tabla 9" },
        "cic": { "role": "indicative", "kind": "band", "unit": "cmol/kg", "confidence": "baja",
          "lowMedium": 15, "mediumHigh": 25, "source": "tabla 9" }
      }
    }
  },
  "cartographicUnits": {
    "chinchina": { "label": "Chinchiná", "moPct": 14.33, "da": 0.72, "ccGravPct": 67.12,
      "pmpGravPct": 38.9, "caaVolPct": 19.49, "nTotalPct": 0.535, "nMineralizedKgHaYear": 115.5,
      "stressThresholdPct": { "cafe": 40.2, "platano": 41.2, "banano": 41.2, "aguacate": 34.1, "citricos": 38.2 } }
  },
  "sampling": { "depthCm": 20, "minSubsamples": 15, "maxSubsamples": 20, "pattern": "zigzag" },
  "alerts": []
}
```

Reglas del formato:

- `role` va en el dato: cambiar el rol de una variable es importar otra versión, no tocar el motor.
- Una variable sin banda publicada usa `kind: "none"` y no participa del mínimo.
- El umbral de humedad vive en `cartographicUnits.<unidad>.stressThresholdPct.<cultivo>` porque la
  fuente solo lo publica por unidad cartográfica y cultivo.
- El JSON se valida con Zod al cargar; un set inválido no se importa y la app sigue con el último
  set válido.

---

## 7. Configuración de sesión

```ts
type SessionConfig = {
  configId: number;
  plotId: string;
  cropPrimary: string;
  cropSecondary: string | null;
  depthCm: number;
  cartographicUnit: string;
  lastFertilizationDate: string | null;
  thresholdsVersion: string;
  createdAtUtc: string;
};
```

- `configId` es un entero creciente que asigna la app y el bastón devuelve en cada captura.
- La escritura al bastón es un método nuevo del puerto `StickGateway`: `writeConfig(config)`. En el
  corte 1 lo implementa el simulador; el BLE real llega en el corte 2.
- Una captura con `configId = 0` llega sin configuración: se guarda con `plotId` nulo y se puede
  asignar después.
- Cada diagnóstico guarda una copia del contexto (`context_snapshot_json`), de modo que un recálculo
  usa el contexto original.

---

## 8. Modo ensayo

- Ajuste `settings.trial_mode`.
- Activo: la app no escribe configuración al bastón y marca las capturas con la bandera b5.
- Un diagnóstico de una captura de ensayo se calcula igual y lleva la alerta `origen_ensayo`.
- Las capturas de ensayo se muestran con la marca «ensayo» y no cuentan en los contadores.

---

## 9. Pantallas

| Ruta | Qué hace |
| --- | --- |
| `app/farms.tsx` | Lista de fincas y sus lotes. |
| `app/farm-form.tsx` | Alta y edición de finca. |
| `app/plot-form.tsx` | Alta y edición de lote: cultivos, profundidad, unidad cartográfica, fecha de fertilización, altitud, drenaje, densidad, notas. |
| `app/session.tsx` | Configuración de sesión: lote, contexto, versión de umbrales; genera `configId` y escribe al bastón. |
| `app/diagnosis.tsx` | Resultado: clases posibles, factor limitante, variable por variable con rol, banda, intervalo y motivo, alertas y evidencia. |
| `app/settings.tsx` | Versión activa de umbrales y calibración, modo ensayo, aviso de privacidad. |
| `app/privacy.tsx` | Aviso de privacidad. |

`app/measure.tsx` muestra el resumen del diagnóstico junto a la última captura; `app/history.tsx`
marca las capturas de ensayo y abre el diagnóstico de cada una.

Reglas de UI: español de Colombia; hora local solo al mostrar; dato ausente como «sin dato» y nunca
`0`; zona táctil ≥ 48 dp; contraste ≥ 4,5:1; estados distinguibles sin depender solo del color;
el texto del diagnóstico en lenguaje sencillo con su evidencia y el motivo de cada limitación.

---

## 10. Aviso de privacidad

- Pantalla al primer arranque, antes de crear fincas, y sección permanente en Ajustes.
- Contenido: qué guarda la app (capturas, mediciones, diagnósticos, fincas y lotes), dónde quedan
  (solo en el teléfono), que no hay cuentas ni servidor, que nada sale sin una acción explícita
  (exportar y compartir), que se puede borrar todo desde la app y el contacto para consultas.
- La app funciona sin internet; el aviso no pide consentimientos que la app no necesita.
- Se guarda el estado en `settings` (`privacy_notice_ack`).

---

## 11. Criterios de aceptación

1. `npm test` en verde, con la cobertura del motor ≥ 90 % y estas pruebas obligatorias:
   - S1, S2, S3 y N en los límites exactos de la tabla 40;
   - intervalo que cruza clases → devuelve todas y no elige;
   - factor limitante por la ley del mínimo, con empates ordenados por aptitud;
   - altitud fuera de franja → sin veredicto;
   - fertilización dentro de 3–4 meses → sin veredicto;
   - CE sobre el umbral del cultivo → alerta, no veto;
   - N estimado por la ecuación 4 con los valores de la tabla 8 y las bandas de café;
   - N de la sonda → referencia con el motivo «fuera de rango y de fracción»;
   - P con intervalo que cruza → «no se puede elegir clase»;
   - K en mg/kg con el equivalente publicado de la tabla 9;
   - humedad con el umbral correcto de las 5 unidades × 5 cultivos, calculado por la ecuación 11 y
     contrastado con la tabla 15;
   - diagnóstico con las cuatro versiones y con evidencia de supuestos y vacíos.
2. Integración sobre SQLite real: crear finca, crear lote, iniciar sesión, capturar con el
   simulador, diagnosticar, guardar el diagnóstico, reabrir la app y ver lo mismo.
3. `node .harness/bin/harness.mjs verify` en verde y `npm run build` exportando el bundle.
4. `docs/context/map.md`, `docs/architecture/estructura.md` y `README.md` al día en el mismo commit.
5. `.harness/task.md` con la evidencia.

---

## 12. Vacíos que no bloquean el corte 1

Umbral de seguridad de CE para el enclavamiento; límites absolutos de pH de los otros cuatro
cultivos; profundidad efectiva mínima por cultivo; confirmación de la formulación del índice
paramétrico contra el original; factor de conversión entre cationes distinto de la tabla 6;
método de identificación de la unidad cartográfica por GPS (v1.0).

---

## 12 bis. Decisiones de construcción resueltas con la revisión del diseño

La revisión del diseño (12 preguntas) quedó resuelta así. El código y las pruebas siguen estas
decisiones.

| # | Pregunta | Decisión |
| --- | --- | --- |
| 1 | ¿Qué índice decide la clase? | La clase la decide el mínimo (ecuación 37). El índice paramétrico (ecuación 38) se calcula aparte, se devuelve en `index.parametric` y viaja con la advertencia de la fuente. El conjunto de clases es el de la variable más limitante; si su intervalo cruza clases, se devuelven todas. |
| 2 | ¿Cómo se codifican las formas que no son banda? | El set tiene cinco formas: `band`, `increasing`, `decreasing`, `critical` y `none`. P y K son crecientes; el K del plátano es `critical`; la MO del aguacate tiene solo `optimalFrom`; la MO y el CIC de los otros cultivos son bandas sin límites absolutos, así que no dan clase. |
| 3 | ¿Sin fecha de fertilización hay veredicto? | Sí, con aviso: la fecha es opcional y sin ella no se puede verificar la ventana. Con fecha, menos de 90 días bloquea (efecto residual); entre 90 y 120 días es la ventana recomendada; más de 120 días avisa. ElElapsed se mide contra `measuredAtUtc`. |
| 4 | ¿De dónde sale la altitud? | Del lote declarado (`plots.altitude_m`), no del GPS. Las franjas que no son un intervalo se guardan con una nota: el banano usa el material regional del Eje Cafetero, el aguacate el patrón mexicano o guatemalteco, y los cítricos llevan `blocking: false` porque su franja es un óptimo, no una restricción. |
| 5 | ¿Cómo se muestran el N estimado y el N de la sonda? | Son dos variables distintas: `n` (estimado, con la ecuación 4 y la confianza «estimada») y `nSensor` (lectura de la sonda, rol `reference`, motivo `fuera_de_rango_y_de_fraccion`). El agua disponible (ecuación 12) va en el texto de referencia de la humedad. |
| 6 | ¿El motor diagnostica mediciones inválidas? | Sí. `measurements.valid` es la integridad del dato del corte 0 y el motor tiene su propia validez. La bandera b5 no bloquea: deja el aviso `dato_simulado`. El modo ensayo congela el estado en la captura, porque la app escribe b5 al ingerir. |
| 7 | ¿Qué es `insufficient_data`? | El motor corrió, hay lecturas, pero ninguna variable con umbral comparable pudo compararse (por ejemplo, no hay unidad cartográfica y el cultivo no tiene pH con límites absolutos). Una captura sin sesión no se diagnostica: el caso de uso devuelve `null` y no escribe fila. |
| 8 | ¿Quién asigna el `config_id`? | La app, con un contador en `settings` (`next_config_id`), así que es único y sobrevive reinicios. La migración 2 declara `UNIQUE` en `sessions.config_id`. El bastón lo devuelve en cada captura. |
| 9 | ¿Cómo se asignan `status` y `band`? | `status` sale del resultado: `class` (una sola clase), `interval` (el intervalo cruza), `band` (comparación con una banda publicada), `alert` (dispara un umbral publicado) y `reference` (sin umbral comparable, sin dato o sin unidad). `band` trae el texto del resultado; `possibleBands` se llena solo cuando el intervalo cruza. |
| 10 | ¿El checksum es del archivo o del objeto? | De la serialización canónica del set ya validado (mismo JSON con las claves ordenadas), con una huella FNV-1a de 32 bits. Detecta corrupción del asset; no es una firma criptográfica. |
| 11 | ¿El diagnóstico se calcula al capturar o bajo demanda? | Bajo demanda: `diagnoseMeasurement` se llama desde la pantalla de medir y desde el historial, y lo que se guarda es inmutable. Recalcular crea una fila nueva con el contexto original. |
| 12 | ¿Cómo se guardan la densidad y el drenaje? | El drenaje es un vocabulario cerrado (`bien_drenado`, `moderado`, `deficiente`, `encharcado`) y la densidad de siembra es un número en plantas por hectárea (`plots.planting_density_ha`). |

---

## 13. Archivos del corte 1

```
app/farms.tsx                              lista de fincas y lotes
app/farm-form.tsx                          alta y edición de finca
app/plot-form.tsx                          alta y edición de lote
app/session.tsx                            configuración de sesión
app/diagnosis.tsx                          resultado del diagnóstico
app/settings.tsx                           ajustes mínimos
app/privacy.tsx                            aviso de privacidad
src/domain/farm/types.ts                   Finca, Lote, id de unidad cartográfica
src/domain/farm/validation.ts              validación de lote
src/domain/session/types.ts                SessionConfig
src/domain/diagnosis/types.ts              contrato del motor
src/domain/diagnosis/suitability.ts        funciones de aptitud (ec. 34 a 36)
src/domain/diagnosis/threshold-set.ts      tipos y esquema Zod del set de umbrales
src/domain/diagnosis/estimates.ts          ecuación 4 (N) y ecuación 5 (CIC)
src/domain/diagnosis/diagnose.ts           motor, fases 1 a 7
src/ports/clock.ts                         puerto de reloj
src/ports/stores/farm-store.ts
src/ports/stores/session-store.ts
src/ports/stores/diagnosis-store.ts
src/ports/stores/settings-store.ts
src/application/farm/save-farm.ts
src/application/farm/save-plot.ts
src/application/farm/list-plots.ts
src/application/session/start-session.ts
src/application/diagnosis/diagnose-measurement.ts
src/application/diagnosis/recompute-diagnosis.ts
src/application/settings/get-settings.ts
src/application/settings/set-trial-mode.ts
src/infrastructure/db/migrations.ts        migración 2
src/infrastructure/db/sqlite-stores.ts     almacenes nuevos
src/infrastructure/thresholds/load-threshold-set.ts
src/ui/components/diagnosis-card.tsx
src/ui/components/field.tsx
src/ui/components/plot-picker.tsx
assets/thresholds/2026.11-v1.json
tests/...                                   espejo exacto de src/ y app/
```

`src/domain/session/` es un área nueva: se crea en este corte y se documenta en
`docs/architecture/estructura.md` en el mismo commit.
