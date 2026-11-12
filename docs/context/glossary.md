# Glossary

Un término por entrada de dominio. Usar estas palabras en código, documentos y conversación.

## Bastón

Dispositivo físico con ESP32, GPS NEO-6M, pantalla OLED, sonda RS-485 y microSD. Captura la
medición y se conecta a la app por BLE.
Evitar: dispositivo, sensor, equipo.

## Captura

Un registro tomado por el bastón al pulsar el gatillo: valores de la sonda, posición GPS, fecha y
hora UTC, banderas y contexto de sesión. Es la unidad que viaja por BLE y por la microSD.
Evitar: muestra (esa es una submuestra del protocolo), lectura, dato.

## Medición

Captura recibida y guardada por la app, asociada a un lote y a un punto de muestreo.
Evitar: registro (se usa para la fila cruda del bastón), muestra.

## Sonda

Sensor insertado en el suelo que mide pH, humedad, temperatura, CE, N, P y K. Cada sonda se calibra
individualmente y se identifica por `device_id` derivado de su MAC.
Evitar: sensor, electrodo.

## Finca

Unidad administrativa que agrupa lotes.

## Lote

Porción de terreno de una finca donde se muestrea. Tiene cultivo principal, cultivo asociado
opcional, fecha de última fertilización, profundidad y unidad cartográfica.

## Unidad cartográfica

Subdivisión del lote con características homogéneas de suelo; se elige manualmente en el MVP y por
GPS en v1.0.

## Protocolo de muestreo

Regla de campo: 0–20 cm de profundidad, patrón en zigzag y entre 15 y 20 submuestras por lote, con
contador de puntos.

## Umbral

Valor de referencia agronómico que clasifica una variable. Vive en tablas versionadas, no en el
código, y cada diagnóstico registra la versión usada.

## Clase S1 / S2 / S3 / N

Aptitud del suelo: S1 apto, S2 moderadamente apto, S3 marginalmente apto, N no apto.

## CE (conductividad eléctrica)

Medida en µS/cm. En este proyecto actúa como enclavamiento de seguridad: por encima del umbral,
N, P y K no son confiables y la app lo informa.

## Inferencia de nitrógeno

Estimación de N a partir de materia orgánica. Se muestra siempre como estimado, nunca como medido.

## Configuración de sesión

Bloque que la app escribe al bastón antes de medir: `config_id`, cultivo, `lote_id`, profundidad,
fecha de fertilización opcional, hora UTC y versión de umbrales.

## Banderas

Bits del registro que indican validez: b0 posición válida, b1 fix reciente, b2 sonda OK, b3 CE
sobre umbral, b4 hora válida, b5 dato simulado.

## Modo ensayo

Modo de laboratorio cuyos datos no son productivos y quedan marcados como simulados.

## Diagnóstico

Resultado del motor: clase o intervalo, factor limitante, alertas, evidencia y versiones usadas.
Evitar: resultado, veredicto.