# Sistema de diseño

La app tiene que leerse al sol, con guantes y con prisa. El sistema busca eso: fondos cálidos, verde
profundo para lo principal y acentos de verde campo, vino y terracota para lo que pide atención.

## Marca

La marca del producto es **Agrovia**: una «A» que es a la vez montaña y surco, con el wordmark en una
sans geométrica de remates redondeados. Todo el material de marca vive en
`F:\uni\Z- Semillero baston\identidad de marca` y se copia al repositorio ya procesado:

| Archivo | Versión | Cuándo |
| --- | --- | --- |
| `assets/brand/agrovia-logo-color.png` | A color sobre transparente (la principal) | Fondos claros |
| `assets/brand/agrovia-logo-blanco.png` | Blanca sobre transparente | Fondos verde profundo (el hero del inicio) |
| `assets/brand/agrovia-simbolo-color.png` | Solo la «A» a color | Icono, splash, marcas de agua |
| `assets/brand/agrovia-simbolo-monocromo.png` | Solo la «A» en blanco | Icono monocromo de Android |

`scripts/brand/build-brand-assets.ps1` recorta los originales, quita el fondo y compone
`assets/icon.png`, el icono adaptativo y el del splash. Si la marca cambia, se reemplazan los
originales y se vuelve a correr; no se redibuja a mano.

Los colores salen del original a color: verde profundo `#015439` y verde campo `#2D963B`. El crema de
la marca es `#F9FAF5`; el fondo de las pantallas es un beige cálido distinto a propósito, para que las
tarjetas blancas no se confundan con el papel.

## De dónde sale la paleta

De la identidad de Agrovia (verdes) y de la guía de marca que el equipo tomó de Cofinet (vinos,
terracotas y beiges de pradera). No se copiaron los componentes ni la lógica de esa app; se tomó el
criterio de agrupar la información en tarjetas.

La traducción a tokens vive en `src/ui/theme.ts`. Ninguna pantalla nueva debe escribir un hex: pide
`colors.primary`, `spacing.md` o `typography.title`.

## Tokens

### Colores

| Token | Valor | Uso |
| --- | --- | --- |
| `colors.background` | `#F7F1E8` | Fondo de todas las pantallas |
| `colors.surface` | `#FFFFFF` | Tarjetas, campos, hojas |
| `colors.surfaceMuted` | `#F3ECE2` | Bloques secundarios |
| `colors.border` | `#E1D6C7` | Bordes de tarjetas y campos |
| `colors.text` | `#2D3733` | Texto principal |
| `colors.textMuted` | `#4E5D59` | Texto de apoyo |
| `colors.textSoft` | `#6B7671` | Pie de tarjeta, notas |
| `colors.primary` | `#015439` | Acción principal, encabezado de la app |
| `colors.primarySoft` | `#E2F0E3` | Presionado y fondos de énfasis suave |
| `colors.accent` | `#2D963B` | Enlaces, «Abrir», datos activos |
| `colors.wine` | `#671741` | Secciones de historial y contexto |
| `colors.terracotta` | `#8D321D` | Advertencias y acciones destructivas suaves |
| `colors.danger` | `#601E18` | Borrar datos y errores |

Los colores de **aptitud del suelo** no están acá: viven en
`src/ui/components/map/map-colors.ts` porque significan algo (S1, S2, S3, N, sin dato, no
concluyente). Cambiar la marca no puede cambiar lo que dice el mapa.

### Espacio, radio y tipografía

- `spacing`: `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 24, `xxl` 32.
- `radius`: `sm` 8, `md` 12, `lg` 16, `xl` 22, `pill` 999.
- `typography`: `display` 30, `title` 21, `subtitle` 16, `body` 16, `label` 15, `caption` 13.
- `elevation.card`: sombra suave, solo en tarjetas blancas.

## Componentes reutilizables

| Componente | Archivo | Cuándo |
| --- | --- | --- |
| `Card` | `src/ui/components/ui/card.tsx` | Agrupar información; la franja de color distingue la sección |
| `ActionCard` | `src/ui/components/ui/action-card.tsx` | Abrir otra pantalla desde el inicio |
| `Badge` | `src/ui/components/ui/badge.tsx` | Estado corto junto a un título («En uso», «Pendiente») |
| `SectionHeader` | `src/ui/components/ui/section-header.tsx` | Título de sección con una línea de apoyo |
| `PrimaryButton` | `src/ui/components/primary-button.tsx` | Acción principal, secundaria, fantasma o destructiva |
| `Field` | `src/ui/components/field.tsx` | Campo de formulario con etiqueta y error |

## Reglas

1. **El color nunca va solo.** Todo estado lleva texto: la leyenda del mapa, el distintivo y el
   detalle de la celda dicen qué significa el color.
2. **Zona táctil mínima 48 dp.** Los botones y las tarjetas de acción la cumplen.
3. **Contraste.** Texto principal sobre fondo beige y texto blanco sobre verde profundo; no se usa
   texto gris claro sobre blanco.
4. **Una acción principal por pantalla.** El resto son tarjetas o botones secundarios.
5. **Nada de hex suelto en pantallas nuevas.** Si falta un color, se agrega al tema con un nombre de
   uso, no de tono.

## Cómo crece

Los componentes se portan de a uno, con prueba propia, y se aplican a una pantalla por cambio. La
primera tanda es el inicio (`app/index.tsx`); las siguientes son el mapa del lote y ajustes. El
código de Cofinet se usa como referencia de comportamiento —qué hace una tarjeta, cómo se agrupa un
formulario—, nunca como fuente de lógica de negocio.
