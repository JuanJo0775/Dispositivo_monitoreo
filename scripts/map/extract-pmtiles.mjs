#!/usr/bin/env node
/**
 * Genera un paquete `.pmtiles` que después se importa al teléfono.
 *
 * Es una herramienta de construcción, no de la app: usa internet una vez y
 * escribe un archivo local. La app nunca descarga nada.
 *
 * Ejemplo (Colombia entera a zoom bajo, el paquete incluido):
 *
 *   node scripts/map/extract-pmtiles.mjs \
 *     --source https://build.protomaps.com/20261114.pmtiles \
 *     --bbox -82,-5,-66,14 --maxzoom 6 --out assets/maps/base.pmtiles
 *
 * Ejemplo (una zona para medir, con detalle):
 *
 *   node scripts/map/extract-pmtiles.mjs \
 *     --source https://build.protomaps.com/20261114.pmtiles \
 *     --bbox -75.75,4.45,-75.60,4.60 --maxzoom 15 --out assets/maps/quindio.pmtiles
 *
 * La fuente es un build diario de Protomaps (los archivos del planeta pesan
 * ~100 GB, pero el extractor solo pide al servidor los rangos que necesita).
 * El binario oficial de `pmtiles` se descarga una vez a `scripts/map/.bin/`:
 * no se instala nada en el sistema.
 */

import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, open, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** Raíz del repositorio, calculada desde este archivo. */
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CACHE_DIR = fileURLToPath(new URL('.bin/', import.meta.url));
const DEFAULT_OUT = path.join(REPO_ROOT, 'assets', 'maps', 'detalle.pmtiles');

/** Zoom máximo del build de Protomaps (el planeta llega hasta z15). */
const MAX_ALLOWED_ZOOM = 15;
/** Límite de latitud del Web Mercator: fuera de ahí no hay teselas. */
const MAX_LAT = 85.05112878;
/** Cabecera de un PMTiles v3. */
const MAGIC = 'PMTiles';

function printHelp() {
  console.log(`Uso:
  node scripts/map/extract-pmtiles.mjs --source URL --bbox OESTE,SUR,ESTE,NORTE --maxzoom N [--out ARCHIVO] [--force]

Opciones:
  --source   URL del build de Protomaps (o ruta a un .pmtiles local).
  --bbox     Caja en grados, separada por comas: oeste,sur,este,norte.
  --maxzoom  Zoom máximo a incluir (0 a ${MAX_ALLOWED_ZOOM}).
  --out      Archivo de salida; por defecto assets/maps/detalle.pmtiles.
  --force    Sobrescribe el archivo de salida si ya existe.
  --help     Muestra esta ayuda.

El resultado se importa desde la pantalla «Paquetes de mapa» del teléfono.
`);
}

function fail(message) {
  throw new Error(message);
}

/** Lee y valida la caja: cuatro números finitos, ordenados y dentro del mundo. */
function parseBbox(value) {
  const parts = value.split(',').map((part) => Number(part.trim()));

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    fail(`--bbox necesita cuatro números (oeste,sur,este,norte); llegó «${value}».`);
  }

  const [west, south, east, north] = parts;

  if (west < -180 || east > 180 || south < -MAX_LAT || north > MAX_LAT) {
    fail(
      `--bbox sale del mundo dibujable: oeste y este entre -180 y 180, sur y norte entre -${MAX_LAT} y ${MAX_LAT}.`,
    );
  }

  if (west >= east) {
    fail('--bbox necesita oeste menor que este; una caja que cruza el meridiano no se admite.');
  }

  if (south >= north) {
    fail('--bbox necesita sur menor que norte.');
  }

  return { west, south, east, north };
}

/** Lee y valida el zoom: entero entre 0 y el máximo del build. */
function parseMaxZoom(value) {
  const zoom = Number(value);

  if (!Number.isInteger(zoom) || zoom < 0 || zoom > MAX_ALLOWED_ZOOM) {
    fail(`--maxzoom necesita un entero entre 0 y ${MAX_ALLOWED_ZOOM}; llegó «${value}».`);
  }

  return zoom;
}

/** Valida la fuente antes de tocar la red: URL `.pmtiles` o archivo local. */
function resolveSource(value) {
  if (/^https?:\/\//i.test(value)) {
    let url;

    try {
      url = new URL(value);
    } catch {
      fail(`--source no es una URL válida: «${value}».`);
    }

    if (!url.pathname.toLowerCase().endsWith('.pmtiles')) {
      fail('--source debe apuntar a un archivo .pmtiles.');
    }

    return value;
  }

  const local = path.resolve(value);

  if (!local.toLowerCase().endsWith('.pmtiles')) {
    fail('--source debe ser una URL http(s) o un archivo .pmtiles local.');
  }

  if (!existsSync(local)) {
    fail(`No existe el archivo de origen: ${local}`);
  }

  return local;
}

function parseArgs(argv) {
  const args = { source: null, bbox: null, maxzoom: null, out: DEFAULT_OUT, force: false };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    const equals = raw.indexOf('=');
    const flag = equals === -1 ? raw : raw.slice(0, equals);
    const inlineValue = equals === -1 ? undefined : raw.slice(equals + 1);

    if (flag === '--help' || flag === '-h') {
      printHelp();
      process.exit(0);
    }

    if (flag === '--force') {
      if (inlineValue !== undefined) {
        fail('--force no lleva valor.');
      }

      args.force = true;
      continue;
    }

    const value = inlineValue ?? argv[index + 1];

    if (value === undefined) {
      fail(`Falta el valor de ${flag}.`);
    }

    if (flag === '--source') {
      args.source = value;
    } else if (flag === '--bbox') {
      args.bbox = parseBbox(value);
    } else if (flag === '--maxzoom') {
      args.maxzoom = parseMaxZoom(value);
    } else if (flag === '--out') {
      args.out = path.resolve(value);
    } else {
      fail(`Argumento desconocido: ${flag}. Usa --help para ver las opciones.`);
    }

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  if (args.source === null) {
    fail('Falta --source. Usa --help para ver un ejemplo.');
  }

  if (args.bbox === null) {
    fail('Falta --bbox. Usa --help para ver un ejemplo.');
  }

  if (args.maxzoom === null) {
    fail('Falta --maxzoom. Usa --help para ver un ejemplo.');
  }

  return args;
}

/** Nombre del asset del binario de `pmtiles` para este sistema. */
function assetNameFor(platform, arch) {
  if (platform === 'win32' && arch === 'x64') {
    return { match: '_Windows_x86_64.zip', zip: true };
  }

  if (platform === 'win32' && arch === 'arm64') {
    return { match: '_Windows_arm64.zip', zip: true };
  }

  if (platform === 'darwin' && arch === 'arm64') {
    return { match: '_Darwin_arm64.zip', zip: true };
  }

  if (platform === 'darwin' && arch === 'x64') {
    return { match: '_Darwin_x86_64.zip', zip: true };
  }

  if (platform === 'linux' && arch === 'x64') {
    return { match: '_Linux_x86_64.tar.gz', zip: false };
  }

  if (platform === 'linux' && arch === 'arm64') {
    return { match: '_Linux_arm64.tar.gz', zip: false };
  }

  fail(
    `No hay binario de pmtiles para ${platform}/${arch}. Descárgalo a mano y pasa PMTILES_BIN=/ruta/pmtiles.`,
  );
}

/** Ejecuta un proceso y espera a que termine; falla si el código no es 0. */
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });

    child.on('error', (error) =>
      reject(new Error(`No se pudo ejecutar ${command}: ${error.message}`)),
    );
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} terminó con código ${code}.`));
    });
  });
}

/** Descarga un archivo con el `fetch` de Node. */
async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });

  if (!response.ok) {
    fail(`La descarga falló con HTTP ${response.status}: ${url}`);
  }

  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

/** Descomprime con la herramienta que ya trae el sistema; no instala nada. */
async function decompress(file, destination, isZip) {
  if (process.platform === 'win32') {
    // Windows 10/11 trae tar.exe (libarchive), que abre .zip y .tar.gz.
    try {
      await run('tar', ['-xf', file, '-C', destination]);
      return;
    } catch {
      // Respaldo para equipos sin tar: el módulo de archivos de PowerShell.
      const escapedFile = file.replace(/'/g, "''");
      const escapedDestination = destination.replace(/'/g, "''");

      await run('powershell', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${escapedFile}' -DestinationPath '${escapedDestination}' -Force`,
      ]);
      return;
    }
  }

  if (isZip) {
    await run('unzip', ['-o', file, '-d', destination]);
    return;
  }

  await run('tar', ['-xzf', file, '-C', destination]);
}

/** Nombre del ejecutable en la caché local. */
function binaryName() {
  return process.platform === 'win32' ? 'pmtiles.exe' : 'pmtiles';
}

/**
 * Deja el binario de `pmtiles` en `scripts/map/.bin/`.
 *
 * Se acepta `PMTILES_BIN` para usar uno ya instalado y se descarga el oficial
 * solo la primera vez; queda en una carpeta ignorada por git.
 */
async function ensurePmtilesBinary() {
  if (process.env.PMTILES_BIN !== undefined && process.env.PMTILES_BIN !== '') {
    return process.env.PMTILES_BIN;
  }

  const binary = path.join(CACHE_DIR, binaryName());

  if (existsSync(binary)) {
    return binary;
  }

  await mkdir(CACHE_DIR, { recursive: true });

  const releaseResponse = await fetch(
    'https://api.github.com/repos/protomaps/go-pmtiles/releases/latest',
    { headers: { Accept: 'application/vnd.github+json' } },
  );

  if (!releaseResponse.ok) {
    fail(`No se pudo consultar la versión de pmtiles (HTTP ${releaseResponse.status}).`);
  }

  const release = await releaseResponse.json();
  const wanted = assetNameFor(process.platform, process.arch);
  const asset = release.assets?.find((item) => item.name.endsWith(wanted.match));

  if (asset === undefined) {
    fail(`La versión ${release.tag_name} de pmtiles no trae ${wanted.match}.`);
  }

  console.log(`Descargando el binario de pmtiles ${release.tag_name} (una sola vez)…`);

  const compressed = path.join(
    tmpdir(),
    `pmtiles-${release.tag_name}${wanted.zip ? '.zip' : '.tar.gz'}`,
  );

  await download(asset.browser_download_url, compressed);
  await decompress(compressed, CACHE_DIR, wanted.zip);
  await rm(compressed, { force: true });

  if (!existsSync(binary)) {
    fail('El paquete descargado no traía el ejecutable de pmtiles.');
  }

  return binary;
}

/** Comprueba que el resultado sea un PMTiles de verdad y no un archivo vacío. */
async function assertPmtiles(file) {
  const info = await stat(file);

  if (info.size === 0) {
    fail(`El archivo generado quedó vacío: ${file}`);
  }

  const handle = await open(file, 'r');
  const header = Buffer.alloc(MAGIC.length);

  try {
    await handle.read(header, 0, MAGIC.length, 0);
  } finally {
    await handle.close();
  }

  if (header.toString('utf8') !== MAGIC) {
    fail(`El archivo generado no es un PMTiles (falta la firma «${MAGIC}»): ${file}`);
  }

  return info.size;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = resolveSource(args.source);
  const { west, south, east, north } = args.bbox;

  if (!args.force && existsSync(args.out)) {
    fail(`Ya existe ${args.out}. Usa --out con otro nombre o --force para reemplazarlo.`);
  }

  await mkdir(path.dirname(args.out), { recursive: true });

  console.log(`Fuente: ${source}`);
  console.log(`Caja: oeste ${west}, sur ${south}, este ${east}, norte ${north}`);
  console.log(`Zoom máximo: ${args.maxzoom}`);
  console.log(`Salida: ${args.out}`);

  const binary = await ensurePmtilesBinary();

  try {
    await run(binary, [
      'extract',
      source,
      args.out,
      `--bbox=${west},${south},${east},${north}`,
      `--maxzoom=${args.maxzoom}`,
    ]);

    const size = await assertPmtiles(args.out);

    console.log(`Listo: ${args.out} (${formatMb(size)}).`);
    console.log('Cópialo al teléfono e impórtalo desde «Paquetes de mapa».');
  } catch (error) {
    // Un archivo a medio escribir no debe quedar como si fuera válido.
    await rm(args.out, { force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
