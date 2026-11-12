# Estructura del repositorio

Este documento es la referencia para decidir dónde vive cada cosa. Si una carpeta no está aquí, se
propone y se aprueba antes de crearla.

## Regla de oro

El repositorio se organiza **por capa en la raíz de `src/` y por área de dominio dentro de cada
capa**. Una capa no conoce a la de afuera:

```
app/  ──▶  src/ui  ──▶  src/application  ──▶  src/domain
                              │
                              ▼
                          src/ports  ◀──  src/infrastructure
```

- `src/domain/` no importa React Native, Expo, SQLite, BLE ni `fetch`. Solo TypeScript.
- `src/application/` orquesta dominio y puertos; no conoce implementaciones concretas.
- `src/ports/` son interfaces puras (tipos), sin código.
- `src/infrastructure/` implementa los puertos. Único lugar con SDKs del sistema.
- `app/` y `src/ui/` solo presentan y llaman casos de uso.
- `src/shared/` contiene utilidades sin dependencias (metadatos, unidades, fechas).

Una violación de esta regla se corrige moviendo código, no agregando excepciones.

## Árbol

```
app/                              Rutas de expo-router. Una pantalla por archivo.
  _layout.tsx
  index.tsx
  connect.tsx                     (corte 0)
  measure.tsx                     (corte 0)
  history.tsx                     (corte 0)
  farms.tsx                       Fincas y lotes. (corte 1)
  farm-form.tsx                   Alta y edición de finca. (corte 1)
  plot-form.tsx                   Alta y edición de lote. (corte 1)
  session.tsx                     Configuración de sesión. (corte 1)
  diagnosis.tsx                   Resultado del diagnóstico. (corte 1)
  settings.tsx                    Ajustes mínimos. (corte 1)
  privacy.tsx                     Aviso de privacidad. (corte 1)

assets/thresholds/                Sets de umbrales versionados (datos, no código).

src/
  shared/                         Sin dependencias externas.
    app-info.ts
    format.ts                     Números, unidades y hora local.
    versions.ts                   Versión de calibración, de umbrales y del motor.

  domain/                         Puro, testeable sin emulador.
    capture/                      Captura cruda del bastón.
      types.ts
      validation.ts
    measurement/                  Medición derivada.
      types.ts
    diagnosis/                    Motor de decisión.
      types.ts                    Contrato del motor.
      threshold-set.ts            Tipos y esquema Zod del set de umbrales.
      suitability.ts              Funciones de aptitud y clases.
      estimates.ts                Ecuaciones y conversiones de unidades.
      diagnose.ts                 Motor, fases 1 a 7.
    farm/                         Fincas, lotes y contexto.
      types.ts
      validation.ts
    session/                      Bloque de configuración de sesión.
      types.ts
    protocol/                     Contrato BLE v0.1. (corte 2)
      ble-profile.ts              UUIDs congelados y características.
      frame.ts                    Tramas, CRC-16 y opcodes.
      record-codec.ts             Códec del registro (línea CSV).
      encryption.ts               Sobre XChaCha20-Poly1305.
    calibration/                  Calibración individual. (corte 4)

  application/                    Casos de uso, uno por intención.
    capture/
      ingest-capture.ts
      list-measurements.ts
    export/
      export-csv.ts
      csv-file-name.ts            Nombre del archivo, en UTC.
    farm/
      save-farm.ts
      save-plot.ts
      list-farms.ts
    session/
      start-session.ts
    diagnosis/
      diagnose-measurement.ts
      recompute-diagnosis.ts
    settings/
      get-settings.ts
      set-trial-mode.ts
    sync/                         (corte 2)
      sync-from-stick.ts
      import-csv.ts
      ingest-synced-records.ts

  ports/                          Interfaces de salida.
    stick-gateway.ts
    ble-transport.ts              Puerto de transporte BLE. (corte 2)
    clock.ts
    random-bytes.ts               Bytes aleatorios para el cifrado. (corte 2)
    stores/
      capture-store.ts
      measurement-store.ts
      unit-of-work.ts
      farm-store.ts
      session-store.ts
      diagnosis-store.ts
      settings-store.ts
      sync-state-store.ts          (corte 2)

  infrastructure/                 Adaptadores concretos.
    ble/
      simulated-stick-gateway.ts
      simulated-stick-device.ts    Bastón fiel al contrato. (corte 2)
      fake-ble-transport.ts       (corte 2)
      ble-plx-transport.ts        BLE real (react-native-ble-plx). (corte 2)
      ble-stick-gateway.ts        Gateway sobre el transporte. (corte 2)
    db/
      sql-database.ts             Contrato mínimo que consumen los almacenes.
      migrations.ts
      sqlite-stores.ts
      database.ts                 Apertura, WAL y migraciones.
    thresholds/
      load-threshold-set.ts       Carga desde los assets y validación con Zod.
      import-threshold-set.ts     Importación a la tabla `threshold_sets`.
    files/
      csv-share.ts
    maps/                         (corte 3)

  ui/                             Componentes, hooks, proveedores y tiendas.
    components/
      history-list.tsx
      primary-button.tsx
      diagnosis-card.tsx           Resultado de un diagnóstico.
      field.tsx                    Campo de formulario con etiqueta.
      plot-picker.tsx              Selector de lote.
    hooks/
      use-stick-status.ts         Suscripción al bastón sin renders en cascada.
    providers/
      app-context.ts
      app-provider.tsx            Punto de composición: abre la base y cablea puertos.
    stores/

assets/                           Íconos, splash y teselas.
  thresholds/                     Sets de umbrales versionados.

tests/                            Espejo exacto de src/ y app/.
  domain/capture/
  domain/diagnosis/
  domain/farm/
  application/capture/
  application/export/
  application/farm/
  application/session/
  application/diagnosis/
  application/settings/
  infrastructure/ble/
  infrastructure/db/
  infrastructure/thresholds/
  integration/                    Flujos de punta a punta: simulador → base → CSV.
  ui/
  helpers/                        Factories compartidas (captures, measurements, almacenes).

docs/
  architecture/estructura.md      Este documento.
  context/                        soul, glossary, map.
  adr/                            Decisiones de implementación.
  requirements/                   Ciencia de origen.
  superpowers/specs/              Diseño de arquitectura.
  superpowers/plans/              Planes por corte.

.harness/                         Arnés de ingeniería. No editar a mano.
```

## Convenciones de nombre

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Archivos | `kebab-case` | `ingest-capture.ts` |
| Componentes React | `PascalCase` en el archivo | `HistoryList` en `history-list.tsx` |
| Tipos e interfaces | `PascalCase` | `RawCapture` |
| Funciones y variables | `camelCase` | `validateCapture` |
| Casos de uso | verbo + objeto | `ingestCapture`, `exportCsv` |
| Pruebas | `<archivo>.test.ts` junto al espejo | `tests/domain/capture/validation.test.ts` |
| Motivos de invalidez | `snake_case` | `humidity_out_of_range` |

## Dónde va el código nuevo

1. ¿Es una regla del negocio o de la ciencia? → `src/domain/<área>/`.
2. ¿Coordina pasos y puertos? → `src/application/<área>/`.
3. ¿Habla con el bastón, la base, archivos o mapas? → `src/infrastructure/<tecnología>/`.
4. ¿Es una interfaz que otro implementa? → `src/ports/`.
5. ¿Es una pantalla o un componente? → `app/` o `src/ui/`.
6. ¿No tiene dependencias y lo usan varias capas? → `src/shared/`.

## Pruebas

- Cada archivo de `src/` con lógica tiene su prueba en la misma ruta bajo `tests/`.
- Los helpers viven en `tests/helpers/` y no importan nada de `src/infrastructure/`.
- El dominio se prueba sin emulador y sin bastón.
- Un cambio de estructura actualiza este documento en el mismo commit.

## Configuración en la raíz

Solo lo que las herramientas exigen en la raíz: `package.json`, `app.json`, `tsconfig.json`,
`eslint.config.js`, `jest.config.js`, `.prettierrc`, `.prettierignore`, `.gitignore`, `README.md`.
Nada de código fuente suelto en la raíz.