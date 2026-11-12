# Map of the project

Un área por fila. El agente lee esta tabla, elige el área que toca su tarea y abre solo esa fila.
Sub-áreas se escriben `padre/hijo`.

La columna Code apunta a las carpetas que ya existen. Se actualiza en el mismo cambio que crea cada
carpeta; una fila sin código todavía queda en `-` a propósito.

| Area | Code | ADR | Requirements |
| --- | --- | --- | --- |
| conexion-ble | src/infrastructure/ble/, src/ports/stick-gateway.ts | ADR-APP-012, ADR-APP-017 | RF-APP-001 a RF-APP-006, RF-APP-064; Notion `collection://77d39c4a-833b-82e4-8810-870de4b8d062` |
| medicion | src/domain/validation.ts, src/application/ingest-capture.ts | ADR-APP-005, ADR-APP-012 | RF-APP-007 a RF-APP-012; contrato ESP32-App |
| contexto-lote | - | ADR-APP-015 | RF-APP-013 a RF-APP-020, RF-APP-048 a RF-APP-051, RF-APP-064 |
| diagnostico | src/domain/ | ADR-APP-002, ADR-APP-006, ADR-APP-007, ADR-APP-008 | RF-APP-021 a RF-APP-033, RF-APP-065 |
| historial | app/history.tsx, src/application/list-measurements.ts | ADR-APP-004 | RF-APP-034 a RF-APP-038 |
| sincronizacion-sd | - | ADR-APP-013 | RF-APP-039 a RF-APP-043 |
| mapas | - | ADR-APP-009 | RF-APP-044 a RF-APP-047 |
| calibracion | - | ADR-APP-005 | RF-APP-052 a RF-APP-054 |
| exportacion | src/application/export-csv.ts, src/infrastructure/files/ | ADR-APP-014 | RF-APP-055 a RF-APP-057 |
| estado-baston | - | ADR-APP-012 | RF-APP-058, RF-APP-059 |
| ajustes | - | ADR-APP-010, ADR-APP-011, ADR-APP-016 | RF-APP-060 a RF-APP-063 |
| accesibilidad-localizacion | src/ui/ | ADR-APP-011 | RNF-APP-007, RNF-APP-016, RNF-APP-020 |
| datos-privacidad | src/infrastructure/db/ | ADR-APP-004, ADR-APP-010 | RNF-APP-004, RNF-APP-006, RNF-APP-011, RNF-APP-012, RNF-APP-014 |
| contexto-proyecto | docs/context/ | ADR-APP-001 | Notion página raíz `40439c4a833b80ab9be5e708777b1497` |
| decisiones | docs/adr/ | - | ADR-APP-001 a ADR-APP-017 en Notion `collection://dfe39c4a-833b-8315-88ec-07f76cfec317` |
| diseno | docs/superpowers/specs/ | - | Mapa de pantallas `40439c4a833b819291dfefd7dc545b88` |
| ciencia-origen | docs/requirements/ | - | Objetivo 1 v2: umbrales, ecuaciones y motor de decisión |

## Reglas

- Varias rutas en una celda se separan con comas.
- Los globs (`**`, `*`) están permitidos; no se comprueban.
- Las rutas planas empiezan en la raíz del repositorio. Un enlace Markdown empieza en la carpeta de
  este archivo. Un número de ADR suelto no se comprueba.
- `harness doctor` reporta cada ruta literal de la columna Code o ADR que no exista.
- El índice de ADR tiene una columna Area con estos mismos nombres.