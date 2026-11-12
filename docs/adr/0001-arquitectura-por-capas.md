# 0001. Arquitectura por capas con puertos y bastón simulado

- **Status:** accepted
- **Date:** 2026-11-12
- **Area:** diseno

## Context

La app debe funcionar sin internet, hablar con un bastón por BLE cuyo hardware aún no está
disponible, y mantener un motor de diagnóstico científico auditable. Notion ya fijó el stack
(React Native + Expo, SQLite, motor en la app: ADR-APP-001/002/003/004) y el contrato BLE v0.1, pero
no existe una decisión de implementación sobre cómo separar dominio, IO y UI.

Sin esa separación, el motor termina acoplado a React Native y a SQLite, no se puede probar sin
emulador y el hardware bloquea todo el desarrollo.

## Decision

Organizar la app en cuatro capas con dependencias hacia adentro: `domain` (puro), `application`
(casos de uso), `ports` (interfaces) e `infrastructure`/`ui` (adaptadores). El acceso al bastón se
hace por un puerto `StickGateway` con dos implementaciones intercambiables: BLE real y simulador.
El motor de diagnóstico es una función pura que recibe valores calibrados, contexto y un set de
umbrales versionado.

## Alternatives

- **Todo en pantallas y servicios acoplados:** menos archivos al inicio; imposible probar el motor
  sin emulador y el hardware bloquea el desarrollo.
- **Monorepo con paquete de dominio aparte:** aislamiento más fuerte; costo de tooling y publicación
  innecesario para un solo APK.
- **Motor en el bastón o en un servicio:** contradice ADR-APP-002 y el modo offline.

## Consequences

- El dominio y los casos de uso se prueban con Vitest sin Android ni bastón.
- El simulador se convierte en fixture de integración y permite cerrar los cortes 0 y 1 sin hardware.
- Hay que mantener interfaces y adaptadores; más archivos que una app de pantallas.
- El contrato BLE queda aislado en un solo adaptador, de modo que un cambio de firmware se absorbe
  ahí.

## Reversibility

Media. Cambiar de capas a un diseño más simple es un refactor grande; cambiar la implementación BLE
o SQLite detrás de un puerto es barato. El costo de revertir crece cuando existan diagnósticos
guardados que dependan de los contratos del dominio.

## Links

- Diseño: `docs/superpowers/specs/2026-11-12-app-movil-arquitectura-design.md`
- ADR-APP-001 (offline first), ADR-APP-002 (motor en la app), ADR-APP-012 (BLE GATT),
  ADR-APP-013 (sincronización por secuencia).