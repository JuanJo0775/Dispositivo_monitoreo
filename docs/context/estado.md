# Estado del proyecto

Actualizado: 2026-11-17.

## Dónde va

La app móvil es el alcance del proyecto: Android, React Native + Expo, **offline first**, sin cuentas,
sin servidor y sin internet en el camino crítico (ADR-APP-003). El bastón captura; la app interpreta,
diagnostica, documenta y exporta. La meta es terminar el producto durante 2027.

## Cortes

| Corte | Alcance | Estado |
| --- | --- | --- |
| 0 | Esqueleto: simulador, SQLite, historial, CSV | cerrado |
| 1 | Recorrido de campo mínimo con diagnóstico | cerrado |
| 2 | BLE real y sincronización por microSD | cerrado |
| 3 | Mapa offline con malla y dictamen por espacio | implementado, en verificación en teléfono |
| 4 | v1.0: calibración individual, PDF, análisis | pendiente |
| 5 | v2.0: dosis y exportación geoespacial | pendiente |

## Qué quedó en el corte 3

- Mapa offline con MapLibre y PMTiles, sin red ni claves (ADR 0003).
- Paquete base incluido (`assets/maps/base.pmtiles`, Colombia z0–6) y paquetes detallados que la
  persona importa desde el teléfono.
- Malla automática de celdas de ~0,4 ha sobre el área medida, con tope de 400 celdas y aviso cuando
  se ajusta.
- Dictamen por celda: `sin_dato`, `un_punto`, `resumen` o `no_concluyente`; nunca se promedian
  clases ni se colorea una celda vacía.
- Posición solo del GPS del bastón (`positionValid`, `hdop`, `satellites`); sin GPS del teléfono ni
  posición manual.
- Respaldo sin teselas: si el paquete no abre o el módulo nativo falla, se dibuja el croquis con
  celdas y puntos y se avisa.
- Importación de paquetes validada por firma `PMTiles`, tamaño y espacio libre.
- Historial con lote por medición y asignación cuando llegó sin lote.
- Borrado de todos los datos personales desde Ajustes, en una transacción.
- Sistema de diseño: paleta cálida, tema en `src/ui/theme.ts` y componentes reutilizables
  (`Card`, `ActionCard`, `Badge`, `SectionHeader`). Ver `docs/design/sistema-de-diseno.md`.

## Verificación

- `npm run check`: formato, lint, tipos y pruebas en verde (ver la última corrida en el commit).
- `npx expo export --platform android`: bundle de Android sin errores.
- `tests/integration/map-flow.test.ts`: flujo completo sobre SQLite real.
- `node .harness/bin/harness.mjs verify`: comprobaciones del arnés en verde.

## Lo que todavía no está verificado

- **APK en un teléfono real**: el APK `preview` `da367f3f` se compiló desde `main` (`e261b56`) y se
  instaló. El pincho de mapa mostró que `pmtiles://asset://` no dibuja: el archivo viajaba
  comprimido dentro del APK. El mapa incluido ahora se extrae a un archivo real con `expo-asset` y se
  abre con `pmtiles://file://…`; falta confirmarlo en el próximo APK, que exige rebuild porque suma
  `expo-asset` y `expo-updates`.
- **Bastón físico**: el BLE, la sincronización y el GPS real se probaron con el bastón simulado.
- **Campo**: capturar, sincronizar, importar CSV y revisar un lote con mediciones reales.
- **Agronomía**: las pruebas demuestran que el motor aplica el set `2026.11-v1` de forma consistente;
  no demuestran que cada umbral sea correcto para cada cultivo y unidad cartográfica. Falta revisión
  de un agrónomo y muestras reales.
- **Rendimiento**: el mapa consulta por medición y el arranque lee todas las capturas; funciona con
  miles de filas, no está medido con decenas de miles.
- **Publicación**: cuenta de Google Play, ficha de la app y correo de privacidad real.

## Pendientes inmediatos

1. Publicar el APK `preview` con el mapa incluido corregido y confirmar en el teléfono que dibuja.
2. Crear el token de Expo y guardarlo como secreto `EXPO_TOKEN` del repositorio para que el flujo de
   GitHub publique actualizaciones (`.github/workflows/eas-update.yml`).
3. Revisar los umbrales con criterio agronómico antes de llamar «v1.0» al producto.
4. Completar el correo de contacto del aviso de privacidad antes de publicar.
5. Terminar el sistema de diseño: paleta y componentes reutilizables aplicados a todas las pantallas.

## Compilar (EAS)

La release se compila desde `main`. El corte 3 ya está integrado: el PR #5 se fusionó en
`2df470f`. El APK se compila en la nube; no hace falta Android SDK ni JDK local.

En la web de EAS, para este repositorio:

- **Base directory:** vacío (el proyecto está en la raíz).
- **Git ref:** `main`.
- **Expo Build profile:** `preview` (produce un **APK** instalable).
- **Environment:** `Default`; no hay variables de entorno configuradas.
- **Expo Submit:** desactivado; todavía no hay cuenta de tienda ni perfil de envío.

El perfil `production` produce un **AAB** para Google Play, con incremento automático de versión; no se
instala directamente en el teléfono y no debe usarse mientras siga el pincho del mapa.

Credenciales: en **Credentials → Android** hay que generar un keystore («Generate new keystore»). EAS
lo guarda; si se pierde, no se pueden publicar actualizaciones que instalen encima de la app existente.

## Publicación del código

El corte 3 se fusionó en `main` con el PR #5 (`2df470f`). El arnés de ingeniería (`.harness/`,
`.claude/`, `.opencode/`, `AGENTS.md`, `CLAUDE.md`, `opencode.json`) no se publica.
