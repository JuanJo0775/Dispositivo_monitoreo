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

- **APK en un teléfono real**: el primer APK `preview` (`da367f3f`, `e261b56`) mostró que
  `pmtiles://asset://` no dibuja: el archivo viajaba comprimido dentro del APK. El de ahora
  (`50474068`, `2596039`) ya trae el mapa extraído a un archivo real con `expo-asset`, la marca
  Agrovia, el BLE real y `expo-updates`; falta instalarlo y confirmar mapa, conexión y recepción de
  una actualización.
- **Bastón físico**: el BLE real ya está cableado (`BlePlxTransport` + `BleStickGateway`, permisos de
  Android y pantalla de escaneo), pero falta probarlo con el bastón del semillero. El firmware todavía
  tiene que implementar los UUID del contrato y el intercambio de sal del emparejamiento; hasta
  entonces la app conecta, descubre y avisa con un mensaje claro cuando el servicio no aparece.
- **Campo**: capturar, sincronizar, importar CSV y revisar un lote con mediciones reales.
- **Agronomía**: las pruebas demuestran que el motor aplica el set `2026.11-v1` de forma consistente;
  no demuestran que cada umbral sea correcto para cada cultivo y unidad cartográfica. Falta revisión
  de un agrónomo y muestras reales.
- **Rendimiento**: el mapa consulta por medición y el arranque lee todas las capturas; funciona con
  miles de filas, no está medido con decenas de miles.
- **Publicación**: cuenta de Google Play, ficha de la app y correo de privacidad real.

## Pendientes inmediatos

1. Compilar el APK `preview` con mapa, marca, BLE y actualizaciones, instalarlo y confirmar mapa +
   conexión.
2. Revisar los umbrales con criterio agronómico antes de llamar «v1.0» al producto.
3. Completar el correo de contacto del aviso de privacidad antes de publicar.
4. Terminar el sistema de diseño: componentes reutilizables aplicados a todas las pantallas.

## Conectar el bastón

1. Encender el bastón y dejarlo cerca del teléfono.
2. En la app: «Conectar» → «Buscar bastones». Android pide permiso de Bluetooth la primera vez; sin
   ese permiso el escaneo no devuelve nada.
3. La lista muestra **todos** los aparatos que hay cerca. Los que anuncian el servicio del contrato
   llevan la insignia «Del contrato»; los demás aparecen como «Otro aparato» para que se vea qué hay
   en el ambiente cuando el bastón no está.
4. Tocar el bastón de la lista conecta con ese identificador. Si el servicio no aparece al descubrir,
   la app lo dice: el problema está en el firmware, no en el teléfono.
5. «Emparejar» pide el PIN de seis dígitos. Hoy falla con un mensaje honesto («Falta la sal de
   emparejamiento») porque el firmware todavía no implementa ese intercambio; **conectar y descubrir
   no dependen de eso**.

El bastón de prueba está al final de la pantalla, detrás de un toque explícito. Sus capturas quedan
marcadas como simuladas y no sirven como dato de campo.

## Compilar (EAS)

La release se compila desde `main`. El corte 3 ya está integrado: el PR #5 se fusionó en
`2df470f`. El APK se compila en la nube; no hace falta Android SDK ni JDK local.

**Lo normal es no compilar.** Un build solo hace falta cuando cambia algo nativo: SDK, permisos,
librerías con código nativo, icono, splash o versión. Todo lo demás (pantallas, estilos, assets, el
`.pmtiles`) viaja por EAS Update sin gastar cuota. El plan gratuito da unas 15 compilaciones Android
al mes.

Compilar a mano desde GitHub:

```powershell
gh workflow run eas-build.yml -f profile=preview
gh run list --workflow=eas-build.yml
```

O en la web: Actions → «Compilar APK» → Run workflow. El flujo corre `npm run check`, compila con
EAS, espera y deja el APK enlazado en el run.

En la web de EAS, para este repositorio:

- **Base directory:** vacío (el proyecto está en la raíz).
- **Git ref:** `main`.
- **Expo Build profile:** `preview` (produce un **APK** instalable).
- **Environment:** `Default`; no hay variables de entorno configuradas.
- **Expo Submit:** desactivado; todavía no hay cuenta de tienda ni perfil de envío.

El perfil `production` produce un **AAB** para Google Play, con incremento automático de versión; no se
instala directamente en el teléfono.

Credenciales: el keystore de Android ya está generado y guardado en EAS (alias `monitoreo`). La copia
local y la contraseña están fuera del repositorio, en `monitoreo-credenciales`. Si se pierde, no se
pueden publicar actualizaciones que instalen encima de la app existente.

## Actualizaciones (EAS Update)

`expo-updates` está configurado con `runtimeVersion` por `appVersion`: una actualización solo se aplica
a la misma versión nativa de la app.

- Mientras el producto está en desarrollo, `main` publica al canal **`preview`**, que es el que escucha
  el APK de prueba. Cuando salga la versión, el push a `main` pasa a `production` cambiando una línea
  del flujo; los dos canales no se mezclan.
- GitHub Actions (`.github/workflows/eas-update.yml`) corre `npm run check` y publica con
  `eas update --channel … --auto`. El secreto `EXPO_TOKEN` ya está cargado en el repositorio.
- Publicar a mano: `npx eas-cli update --channel preview --auto` (solo Node; no hace falta Android SDK).
  En el equipo local el token va en `.env`; en CI va como secreto.
- Viaja JavaScript y assets (imágenes, el `.pmtiles` incluido). Lo nativo —SDK, permisos, MapLibre,
  BLE— sigue exigiendo un build de EAS.
- Si el teléfono no tiene internet, arranca con la versión que ya tiene: la actualización nunca
  bloquea el trabajo de campo.

## Publicación del código

El corte 3 se fusionó en `main` con el PR #5 (`2df470f`). El arnés de ingeniería (`.harness/`,
`.claude/`, `.opencode/`, `AGENTS.md`, `CLAUDE.md`, `opencode.json`) no se publica.
