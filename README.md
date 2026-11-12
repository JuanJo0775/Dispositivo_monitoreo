# Monitoreo de suelo — app móvil

Aplicación Android **offline first** para el bastón inteligente de monitoreo de suelos. El bastón
captura; la app interpreta, diagnostica y exporta. Sin cuentas, sin servidor y sin internet en el
camino crítico.

- Requisitos y ciencia: Notion «Dispositivo de monitoreo del suelo» y
  `docs/requirements/objetivo-1-umbrales-ecuaciones-motor.md`.
- Diseño técnico: `docs/superpowers/specs/2026-11-12-app-movil-arquitectura-design.md`.
- Plan en curso: `docs/superpowers/plans/2026-11-12-corte-0-esqueleto.md`.

## Estructura del repositorio

```
app/                     Rutas de expo-router. Una pantalla por archivo, sin lógica de negocio.
src/
  shared/                Utilidades sin dependencias (metadatos de la app).
  domain/                TypeScript puro: capture/, measurement/, diagnosis/, farm/, calibration/.
  application/           Casos de uso por área: capture/, export/, diagnosis/, sync/.
  ports/                 Interfaces de salida: stick-gateway.ts y stores/.
  infrastructure/        Adaptadores: ble/, db/, files/, maps/.
  ui/                    components/, hooks/, stores/.
assets/                  Íconos, splash y, más adelante, umbrales y teselas.
tests/                   Espejo de src/: domain/, application/, infrastructure/, ui/, helpers/.
docs/
  architecture/          Estructura y reglas de dependencia.
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
- Android SDK y un teléfono o emulador para la app.
- El bastón es **simulado** hasta el corte 2; no se necesita hardware.

## Comandos

| Comando                                | Qué hace                                                      |
| -------------------------------------- | ------------------------------------------------------------- |
| `npm install`                          | Instala dependencias.                                         |
| `npm start`                            | Metro + Expo.                                                 |
| `npm run android`                      | Abre la app en el dispositivo o emulador.                     |
| `npm test`                             | Pruebas con Jest y jest-expo.                                 |
| `npm run typecheck`                    | TypeScript estricto, sin emitir.                              |
| `npm run lint`                         | ESLint.                                                       |
| `npm run format`                       | Verifica el formato con Prettier.                             |
| `npm run format:write`                 | Aplica el formato.                                            |
| `node .harness/bin/harness.mjs verify` | Formato, lint y tipos. Obligatorio antes de cerrar una tarea. |

## Convenciones

- Español de Colombia en la UI; UTC en almacenamiento y UTC−5 al mostrar.
- Un dato ausente es `null` y se exporta como celda vacía; nunca `0`.
- Coordenadas `0,0` no son una posición real.
- Identidad de una captura: `deviceId + sequence`. Un duplicado se ignora.
- Orden obligatorio: guardar (commit) → confirmar al bastón → actualizar la UI.
- Commits pequeños en español con prefijo `feat:`, `test:`, `fix:` o `chore:`.

## Estado

| Corte | Alcance                                      | Estado    |
| ----- | -------------------------------------------- | --------- |
| 0     | Esqueleto: simulador, SQLite, historial, CSV | en curso  |
| 1     | Recorrido de campo mínimo con diagnóstico    | pendiente |
| 2     | BLE real y sincronización por microSD        | pendiente |
| 3     | Mapa con teselas offline y guía de muestreo  | pendiente |
| 4     | v1.0: calibración individual, PDF, análisis  | pendiente |
| 5     | v2.0: dosis y exportación geoespacial        | pendiente |
