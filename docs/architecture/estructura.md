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

src/
  shared/                         Sin dependencias externas.
    app-info.ts
    format.ts                     Números, unidades y hora local.
    versions.ts                   Versión de calibración y de umbrales activos.

  domain/                         Puro, testeable sin emulador.
    capture/                      Captura cruda del bastón.
      types.ts
      validation.ts
    measurement/                  Medición derivada.
      types.ts
    diagnosis/                    Motor de decisión. (corte 1)
    farm/                         Fincas, lotes y contexto. (corte 1)
    calibration/                  Calibración individual. (corte 4)

  application/                    Casos de uso, uno por intención.
    capture/
      ingest-capture.ts
      list-measurements.ts
    export/
      export-csv.ts
      csv-file-name.ts            Nombre del archivo, en UTC.
    diagnosis/                    (corte 1)
    sync/                         (corte 2)

  ports/                          Interfaces de salida.
    stick-gateway.ts
    stores/
      capture-store.ts
      measurement-store.ts
      unit-of-work.ts
    clock.ts                      (corte 1)

  infrastructure/                 Adaptadores concretos.
    ble/
      simulated-stick-gateway.ts
      ble-stick-gateway.ts        (corte 2)
    db/
      sql-database.ts             Contrato mínimo que consumen los almacenes.
      migrations.ts               (corte 0)
      sqlite-stores.ts            (corte 0)
      database.ts                 Apertura, WAL y migraciones.
    files/
      csv-share.ts                (corte 0)
    maps/                         (corte 3)

  ui/                             Componentes, hooks, proveedores y tiendas.
    components/
      history-list.tsx
      primary-button.tsx
    hooks/
      use-stick-status.ts         Suscripción al bastón sin renders en cascada.
    providers/
      app-context.ts
      app-provider.tsx            Punto de composición: abre la base y cablea puertos.
    stores/

assets/                           Íconos, splash, umbrales y teselas.
tests/                            Espejo exacto de src/ y app/.
  domain/capture/
  application/capture/
  infrastructure/ble/
  integration/                    Flujos de punta a punta: simulador → base → CSV.
  ui/
  helpers/                        Factories compartidas (captures, measurements).

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