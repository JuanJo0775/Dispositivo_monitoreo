# Monitoreo de suelo — app móvil

Aplicación Android **offline first** para el bastón inteligente de monitoreo de suelos. El bastón
captura; la app interpreta, diagnostica y exporta. Sin cuentas, sin servidor y sin internet en el
camino crítico.

- Requisitos y ciencia: Notion «Dispositivo de monitoreo del suelo» y
  `docs/requirements/objetivo-1-umbrales-ecuaciones-motor.md`.
- Diseño técnico: `docs/superpowers/specs/2026-11-12-app-movil-arquitectura-design.md`.
- Plan del corte 0 (cerrado): `docs/superpowers/plans/2026-11-12-corte-0-esqueleto.md`.

## Estructura del repositorio

```
app/                     Rutas de expo-router. Una pantalla por archivo, sin lógica de negocio.
src/
  shared/                Utilidades sin dependencias (metadatos de la app).
  domain/                TypeScript puro: capture/, measurement/, diagnosis/, farm/, protocol/, geo/.
  application/           Casos de uso por área: capture/, export/, diagnosis/, sync/, map/.
  ports/                 Interfaces de salida: stick-gateway.ts, ble-transport.ts, map-package-files.ts y stores/.
  infrastructure/        Adaptadores: ble/, crypto/, db/, files/, maps/.
  ui/                    components/ (incluye map/), hooks/, stores/.
scripts/map/             Herramientas de construcción: generan paquetes .pmtiles.
assets/                  Íconos, splash, umbrales y paquetes de mapa (maps/).
tests/                   Espejo de src/: domain/, application/, infrastructure/, ui/, helpers/.
docs/
  architecture/          Estructura, reglas de dependencia y la malla del mapa.
  context/               soul, glossary, map (contexto para agentes y personas).
  adr/                   Decisiones de implementación del repositorio.
  requirements/          Ciencia de origen copiada al repo.
  superpowers/           Diseño y planes de implementación.
.harness/                Arnés de ingeniería (no editar a mano).
```

El detalle, las reglas de dependencia y dónde va cada cosa nueva están en
[`docs/architecture/estructura.md`](docs/architecture/estructura.md). Resumen: `app/` y `src/ui/`
dependen de `src/application/`; `src/application/` de `src/domain/` y `src/ports/`;
`src/infrastructure/` implementa `src/ports/`. `src/domain/` no importa React Native, SQLite ni BLE.

## Requisitos

- Node 22 o superior y npm.
- Un teléfono Android. **No hace falta instalar Android SDK ni JDK**: el APK se compila en la nube
  con EAS Build (cuenta gratuita de Expo).
- El bastón es **simulado** hasta que exista el prototipo; no se necesita hardware para probar el
  BLE, la configuración de sesión ni la sincronización por microSD.

El mapa usa MapLibre con teselas PMTiles, así que **Expo Go no sirve**: hay que instalar el APK de
EAS o un development build. Ver `docs/adr/0003-mapa-offline-pmtiles.md`.

## Paquetes de mapa

La app trae `assets/maps/base.pmtiles` (Colombia, zoom 0–6, ~1,2 MB) y funciona sin descargar nada.
Para una zona con detalle se genera un paquete y se importa desde la pantalla «Paquetes de mapa» del
teléfono:

```powershell
node scripts/map/extract-pmtiles.mjs `
  --source=https://build.protomaps.com/20261115.pmtiles `
  --bbox=-75.75,4.45,-75.60,4.60 --maxzoom=15 --out=assets/maps/quindio.pmtiles
```

Los detalles y la atribución están en `assets/maps/README.md`.

## Comandos

| Comando                | Qué hace                                           |
| ---------------------- | -------------------------------------------------- |
| `npm install`          | Instala dependencias.                              |
| `npm start`            | Metro + Expo.                                      |
| `npm run android`      | Abre la app en el dispositivo o emulador.          |
| `npm run build`        | Exporta el bundle de Android (sin instalar).       |
| `npm run clean`        | Borra la carpeta `dist/` de la última exportación. |
| `npm test`             | Pruebas con Jest y jest-expo.                      |
| `npm run typecheck`    | TypeScript estricto, sin emitir.                   |
| `npm run lint`         | ESLint.                                            |
| `npm run format`       | Verifica el formato con Prettier.                  |
| `npm run format:write` | Aplica el formato.                                 |
| `npm run check`        | Formato, lint, tipos y pruebas, en ese orden.      |
| `npm run verify`       | Verificación del arnés de ingeniería.              |

## La raíz del repositorio

La raíz tiene **solo configuración**. Cada archivo está donde su herramienta lo busca, y nada de
código fuente vive aquí:

| Entrada                                                                | Qué es y por qué está aquí                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `app/`                                                                 | Rutas de `expo-router`: una pantalla por archivo.               |
| `src/`                                                                 | Código de la app, organizado por capas.                         |
| `tests/`                                                               | Espejo exacto de `src/` y `app/`.                               |
| `assets/`                                                              | Íconos, splash y los sets de umbrales versionados.              |
| `docs/`                                                                | Contexto, arquitectura, requisitos, ADR y planes.               |
| `package.json`, `package-lock.json`                                    | Dependencias y scripts; npm los busca en la raíz.               |
| `app.json`                                                             | Configuración de Expo; Expo la busca en la raíz.                |
| `tsconfig.json`                                                        | Configuración de TypeScript; el compilador la busca en la raíz. |
| `eslint.config.js`, `jest.config.js`, `.prettierrc`, `.prettierignore` | Configuración de las herramientas de calidad.                   |
| `.gitignore`, `.gitattributes`                                         | Qué se versiona y cómo se normalizan los fines de línea.        |
| `README.md`                                                            | Esta guía.                                                      |

Lo que no se versiona: `node_modules/`, `.expo/`, `dist/`, `coverage/`, archivos `.env` y
`secrets/`. Ver `.gitignore`.

El arnés de ingeniería (`.harness/`, `.claude/`, `.opencode/`, `AGENTS.md`, `CLAUDE.md`) es
**infraestructura aparte**: se instala en cada máquina como paso de setup y no forma parte del
proyecto, así que no se publica. Para trabajar con él, instálalo en el repositorio antes de
empezar.

## Convenciones

- Español de Colombia en la UI; UTC en almacenamiento y UTC−5 al mostrar.
- Un dato ausente es `null` y se exporta como celda vacía; nunca `0`.
- Coordenadas `0,0` no son una posición real.
- Identidad de una captura: `deviceId + sequence`. Un duplicado se ignora.
- Orden obligatorio: guardar (commit) → confirmar al bastón → actualizar la UI.
- Commits pequeños en español con prefijo `feat:`, `test:`, `fix:` o `chore:`.

## Estado

| Corte | Alcance                                       | Estado    |
| ----- | --------------------------------------------- | --------- |
| 0     | Esqueleto: simulador, SQLite, historial, CSV  | listo     |
| 1     | Recorrido de campo mínimo con diagnóstico     | listo     |
| 2     | BLE real y sincronización por microSD         | listo     |
| 3     | Mapa offline con malla y dictamen por espacio | listo     |
| 4     | v1.0: calibración individual, PDF, análisis   | pendiente |
| 5     | v2.0: dosis y exportación geoespacial         | pendiente |

En el corte 1 la app ya diagnostica de verdad: los umbrales vienen de las tablas publicadas en
`docs/requirements/objetivo-1-umbrales-ecuaciones-motor.md` y están en
`assets/thresholds/2026.11-v1.json`, el motor es TypeScript puro en `src/domain/diagnosis/` y cada
diagnóstico guarda su versión de umbrales, calibración, motor y firmware, con la evidencia de qué
supuestos usó y qué datos la ciencia no publica.

En el corte 3 el mapa documenta lo medido: la malla se calcula con las coordenadas del GPS del
bastón, cada celda dictamina con los diagnósticos de sus puntos y nunca se promedia una clase ni se
colorea una celda vacía. La app no es una guía de muestreo: no cuenta puntos ni dice dónde medir.
Queda pendiente confirmar en un teléfono si el paquete incluido se abre desde el APK o si hay que
copiarlo al almacenamiento privado; el resto del corte está cubierto por pruebas.
