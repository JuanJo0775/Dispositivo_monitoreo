# Paquetes de mapa

Aquí viven los archivos `.pmtiles` que la app abre sin internet.

## `prueba.pmtiles` (temporal)

- **Qué es:** imágenes de los Alpes centrales en formato PMTiles v3 (23,5 MB), bajadas de
  `https://demotiles.maplibre.org/pmtiles/raster/imagery.pmtiles`.
- **Para qué sirve:** es el archivo de prueba del pincho (tarea 0 del corte 3). La pantalla
  `app/map-spike.tsx` lo abre de dos maneras: como `pmtiles://asset://prueba.pmtiles` (empaquetado
  en el APK) y como `pmtiles://file://<ruta>` (copiado al almacenamiento privado de la app).
- **No se versiona:** pesa 23,5 MB y es un archivo de prueba. Está en `.gitignore`, y `.easignore`
  lo vuelve a incluir para que el build de EAS lo lleve al APK.
- **Cobertura:** longitud 9 a 15, latitud 46 a 49, zoom 0 a 11, teselas PNG.

## Paquete base real

La tarea 15 del corte 3 reemplaza este archivo de prueba por el paquete base que sí va incluido en
la app (Colombia, zoom bajo). Ese sí se versiona, porque la app lo necesita para funcionar sin
internet.
