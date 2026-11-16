# 0003. Mapa offline con MapLibre, PMTiles y EAS Build

- **Status:** accepted
- **Date:** 2026-11-15
- **Area:** mapas

## Context

El corte 3 pide dibujar el lote medido —malla, celdas y puntos— sobre un mapa que funcione sin
internet, sin cuentas y sin servidor (RF-APP-044 a RF-APP-047, RNF-APP-004 y RNF-APP-014). El
teléfono es Android y la app está hecha con React Native + Expo (ADR-APP-003).

El mapa no puede depender de teselas remotas (Google, Mapbox, Protomaps en línea): en el cafetal no
hay señal y la app no debe pedir claves ni cuentas. Tampoco puede requerir instalar Android SDK ni
JDK en el equipo de desarrollo: el APK se compila en la nube.

Las teselas vectoriales necesitan un motor nativo que sepa leer un archivo local. Las opciones
disponibles en React Native no son equivalentes:

| Opción | Problema |
| --- | --- |
| `react-native-maps` | Usa Google Maps o Apple Maps: requiere clave, conexión o SDK de Google Play Services |
| Raster MBTiles propio | Archivos mucho más pesados y sin reestilizado |
| WebView con `maplibre-gl` | Sin gestos nativos, memoria doble y una capa web más que mantener |
| Teselas propias en un servidor | Rompe el requisito de funcionar sin internet |
| MapLibre + PMTiles | Motor nativo, archivo único, lectura por rangos, sin red |

Al revisar la versión concreta, `@maplibre/maplibre-react-native@11.5.1` trae MapLibre Native
Android **13.6.1**, que soporta PMTiles en local (`pmtiles://`). Eso permite un archivo `.pmtiles`
como única fuente de teselas.

La consecuencia de elegir un motor nativo es que **Expo Go ya no sirve**: la app necesita un build
propio (development client o APK). Como el equipo no tiene Android SDK instalado, el build se hace
en la nube con EAS Build, que es gratuito para este uso.

## Decision

1. **MapLibre React Native** como motor de mapa y **PMTiles** como formato de teselas.
2. El estilo se arma con `@protomaps/basemaps` (`layers(fuente, namedFlavor('light'))`). En el corte 3
   **no hay etiquetas de lugares**: los glifos pesarían varios MB y las capas `symbol` no entran
   todavía. Quedan solo `background`, `fill` y `line`.
3. **Dos fuentes, nunca una descarga:** el paquete **incluido** (`assets/maps/base.pmtiles`, Colombia
   a zoom 0–6, ~1,2 MB, versionado) siempre está; el paquete **detallado** que la persona importa se
   dibuja encima. Sin paquete detallado el mapa igual abre, con menos detalle.
4. La app **no descarga nada**: el paquete detallado lo elige la persona desde el selector de
   archivos del sistema, se copia al almacenamiento privado y se abre con
   `pmtiles://file://…`. El incluido se abre con `pmtiles://asset://…`.
5. Los paquetes se generan con `scripts/map/extract-pmtiles.mjs` a partir de un build diario de
   Protomaps; el binario oficial de `pmtiles` se descarga a `scripts/map/.bin/` (ignorado por git) y
   no se instala en el sistema. La caja y el zoom se validan **antes** de pedir un byte al servidor.
6. El APK se compila con **EAS Build** (`eas.json`), no en la máquina. Ningún paso de la app ni del
   build exige Android SDK o JDK local.
7. Atribución visible en la pantalla del mapa: «Teselas © OpenStreetMap · Protomaps».

## Alternatives

- **`react-native-maps` con caché de teselas:** la caché de Google no es persistente ni garantizada
  offline, y pide clave y servicios de Google.
- **MBTiles en vez de PMTiles:** MapLibre lo soporta, pero el archivo tiene que copiarse entero para
  abrirlo y no se puede leer por rangos; PMTiles es el formato que el propio motor recomienda para
  archivos locales. MBTiles queda como contingencia: solo cambiarían `pmtiles-archive-store.ts` y
  `map-style.ts`.
- **Empaquetar glifos y activar etiquetas:** habría que sumar MB de fuentes y resolver la
  localización de nombres; el corte 3 no lo necesita para dictaminar el suelo.
- **Build local con Android SDK:** es el camino clásico, pero instala JDK, Gradle y SDK (~10 GB) en
  una máquina que solo necesita compilar el APK. EAS Build evita eso.

## Consequences

- **Expo Go deja de servir** para probar la app: hace falta un development build o un APK de EAS.
  Los cortes siguientes también lo necesitan.
- El APK crece por el paquete incluido (~1,2 MB) y por los paquetes detallados que la persona
  importe en su teléfono (no viajan en el APK).
- Los datos del mapa incluido quedan congelados a la fecha del build de Protomaps; para
  actualizarlos se regenera `base.pmtiles` con el script y se commitea.
- La lectura del archivo empaquetado con `pmtiles://asset://` está pendiente de confirmar en un
  teléfono real (pincho de la tarea 0). Si no funciona, la app copia el paquete incluido al
  almacenamiento privado la primera vez y usa `file://`; el resto no cambia.
- Los paquetes detallados no se versionan: se generan por zona y se importan desde el teléfono.

## Reversibility

Media. El motor está aislado en `app/map.tsx`, `src/ui/components/map/` y
`src/infrastructure/maps/`; cambiar a MBTiles o a otro motor toca esos archivos y el estilo, no el
dominio ni la base de datos. Lo que no se puede revertir sin costo es la decisión de no usar Expo Go:
una vez que el equipo y los probadores usan builds de EAS, volver a Expo Go obligaría a quitar el
módulo nativo.

## Links

- Diseño: `docs/superpowers/specs/2026-11-12-corte-3-mapa-malla-design.md` (§11).
- Plan: `docs/superpowers/plans/2026-11-13-corte-3-mapa-malla.md` (tareas 0, 11 a 15).
- Malla y dictamen: `docs/architecture/mapa-y-malla.md`.
- Paquetes incluidos: `assets/maps/README.md`.
- ADR-APP-009 (mapa offline), ADR-APP-003 (React Native + Expo).
