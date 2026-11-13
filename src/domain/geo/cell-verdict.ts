import type { AptitudeClass, DiagnosisResult, DiagnosisVariable } from '@/domain/diagnosis/types';

/**
 * Dictamen por celda de la malla.
 *
 * El estado de una celda sale únicamente de los diagnósticos ya guardados de
 * las mediciones que caen dentro de ella. Este módulo no calcula clases, no
 * promedia clases y no elige la peor: cuando los puntos no coinciden en su
 * conjunto de clases, la celda es `no_concluyente` y se listan los grupos con
 * su conteo para que la decisión la tome la persona.
 *
 * Módulo de TypeScript puro: sin React Native, Expo ni SQLite.
 */

/** Estado del dictamen de una celda. */
export type CellState = 'sin_dato' | 'un_punto' | 'resumen' | 'no_concluyente';

/** Medición de la celda con su último diagnóstico guardado, si existe. */
export interface CellDiagnosisInput {
  measurementId: string;
  valid: boolean;
  diagnosis: DiagnosisResult | null;
}

/** Conjunto de clases posibles que comparten varios puntos, con su conteo. */
export interface ClassGroup {
  classes: readonly AptitudeClass[];
  count: number;
}

/** Dictamen de una celda de la malla. */
export interface CellVerdict {
  state: CellState;
  classes: readonly AptitudeClass[];
  groups: readonly ClassGroup[];
  validPoints: number;
  invalidPoints: number;
  reason: string | null;
}

/** Mediana y mínimo–máximo de una variable sobre los puntos que la midieron. */
export interface VariableSummary {
  variable: DiagnosisVariable;
  unit: string;
  median: number;
  min: number;
  max: number;
  points: number;
}

/**
 * Orden de las clases de la tabla 40.
 *
 * Es el mismo orden del dominio de diagnóstico y se repite acá porque aquel no
 * lo exporta. Sirve para que el conjunto de clases de un dictamen tenga siempre
 * el mismo orden: dos puntos con el mismo conjunto se comparan y se muestran
 * iguales aunque sus diagnósticos listen las clases en distinto orden.
 */
const ORDEN_CLASES: readonly AptitudeClass[] = ['S1', 'S2', 'S3', 'N'];

/** Orden de las variables del dominio, usado para ordenar el resumen. */
const ORDEN_VARIABLES: readonly DiagnosisVariable[] = [
  'humidity',
  'ph',
  'ec',
  'n',
  'nSensor',
  'p',
  'k',
  'temperature',
  'organicMatter',
  'cic',
];

/**
 * Motivos de un dictamen no concluyente.
 *
 * Si una celda tiene varios problemas a la vez se informa el primero de esta
 * lista, que va de la falta más básica a la discrepancia entre diagnósticos:
 * `sin_diagnostico`, `diagnostico_bloqueado`, `datos_insuficientes` y
 * `clases_distintas`. Los grupos de clases se devuelven igual, así que la
 * pantalla puede mostrar lo que sí se sabe además del motivo.
 */
const MOTIVO_SIN_DIAGNOSTICO = 'sin_diagnostico';
const MOTIVO_DIAGNOSTICO_BLOQUEADO = 'diagnostico_bloqueado';
const MOTIVO_DATOS_INSUFICIENTES = 'datos_insuficientes';
const MOTIVO_CLASES_DISTINTAS = 'clases_distintas';

/** Conteos internos que deciden el estado y el motivo de la celda. */
interface ConteoDictamen {
  sinDiagnostico: number;
  bloqueados: number;
  insuficientes: number;
  sinClases: number;
  grupos: readonly ClassGroup[];
}

/**
 * Dictamina una celda a partir de sus mediciones.
 *
 * - `sin_dato`: no hay ninguna medición válida. Las inválidas se cuentan en
 *   `invalidPoints`, no se descartan.
 * - `un_punto`: una sola medición válida y con diagnóstico utilizable. Se
 *   conservan todas sus clases posibles, sin colapsarlas a una.
 * - `resumen`: dos o más mediciones válidas con el mismo conjunto de clases
 *   (incluido el mismo par “entre S1 y S2”). Los grupos llevan el conteo.
 * - `no_concluyente`: hay mediciones válidas pero falta un diagnóstico, está
 *   bloqueado, tiene datos insuficientes o los conjuntos de clases difieren.
 *   Nunca se promedia ni se elige la peor clase.
 */
export function verdictForCell(inputs: readonly CellDiagnosisInput[]): CellVerdict {
  let validPoints = 0;
  let invalidPoints = 0;
  let sinDiagnostico = 0;
  let bloqueados = 0;
  let insuficientes = 0;
  let sinClases = 0;
  const diagnosticos: DiagnosisResult[] = [];

  for (const entrada of inputs) {
    if (!entrada.valid) {
      invalidPoints += 1;
      continue;
    }

    validPoints += 1;

    const { diagnosis } = entrada;

    if (diagnosis === null) {
      sinDiagnostico += 1;
    } else if (diagnosis.validity === 'blocked') {
      bloqueados += 1;
    } else if (diagnosis.validity === 'insufficient_data') {
      insuficientes += 1;
    } else if (diagnosis.classes.length === 0) {
      // Un diagnóstico válido sin clases no puede sostener un dictamen; se
      // trata como dato insuficiente en vez de inventarle una clase.
      sinClases += 1;
    } else {
      diagnosticos.push(diagnosis);
    }
  }

  if (validPoints === 0) {
    return {
      state: 'sin_dato',
      classes: [],
      groups: [],
      validPoints,
      invalidPoints,
      reason: null,
    };
  }

  const groups = agruparClases(diagnosticos);
  const reason = motivoNoConcluyente({
    sinDiagnostico,
    bloqueados,
    insuficientes,
    sinClases,
    grupos: groups,
  });

  if (reason !== null) {
    return {
      state: 'no_concluyente',
      classes: [],
      groups,
      validPoints,
      invalidPoints,
      reason,
    };
  }

  const primero = diagnosticos[0];

  if (primero === undefined) {
    // Inalcanzable: sin diagnósticos utilizables habría un motivo arriba.
    return {
      state: 'no_concluyente',
      classes: [],
      groups,
      validPoints,
      invalidPoints,
      reason: MOTIVO_DATOS_INSUFICIENTES,
    };
  }

  const resumen = diagnosticos.length > 1;

  return {
    state: resumen ? 'resumen' : 'un_punto',
    classes: ordenarClases(primero.classes),
    // Con un solo punto no hay nada que agrupar; los grupos existen para
    // mostrar cómo se reparten varios puntos.
    groups: resumen ? groups : [],
    validPoints,
    invalidPoints,
    reason: null,
  };
}

/**
 * Resume variables con mediana y mínimo–máximo, nunca con un promedio.
 *
 * Solo entran los diagnósticos con `validity: 'valid'`: uno bloqueado o con
 * datos insuficientes no aporta a la mediana. Cada variable se resume sobre los
 * puntos que traen un valor numérico para ella (`points`), y las variables sin
 * ningún valor no aparecen. El orden del resultado sigue el orden del dominio.
 * Si una misma variable llegara con unidades distintas se conserva la unidad
 * del primer punto; el motor no produce ese caso.
 */
export function summarizeVariables(
  diagnoses: readonly DiagnosisResult[],
): readonly VariableSummary[] {
  const porVariable = new Map<DiagnosisVariable, { unit: string; values: number[] }>();

  for (const diagnosis of diagnoses) {
    if (diagnosis.validity !== 'valid') {
      continue;
    }

    for (const resultado of diagnosis.perVariable) {
      if (resultado.value === null) {
        continue;
      }

      const acumulado = porVariable.get(resultado.variable);

      if (acumulado === undefined) {
        porVariable.set(resultado.variable, {
          unit: resultado.unit,
          values: [resultado.value],
        });
      } else {
        acumulado.values.push(resultado.value);
      }
    }
  }

  const resumen: VariableSummary[] = [];

  for (const [variable, datos] of porVariable) {
    const ordenados = [...datos.values].sort((a, b) => a - b);
    const minimo = ordenados[0];
    const maximo = ordenados[ordenados.length - 1];

    if (minimo === undefined || maximo === undefined) {
      continue;
    }

    resumen.push({
      variable,
      unit: datos.unit,
      median: mediana(ordenados),
      min: minimo,
      max: maximo,
      points: ordenados.length,
    });
  }

  return resumen.sort((a, b) => rangoVariable(a.variable) - rangoVariable(b.variable));
}

/** Motivo del dictamen no concluyente, según la prioridad documentada. */
function motivoNoConcluyente(conteo: ConteoDictamen): string | null {
  if (conteo.sinDiagnostico > 0) {
    return MOTIVO_SIN_DIAGNOSTICO;
  }

  if (conteo.bloqueados > 0) {
    return MOTIVO_DIAGNOSTICO_BLOQUEADO;
  }

  if (conteo.insuficientes > 0 || conteo.sinClases > 0) {
    return MOTIVO_DATOS_INSUFICIENTES;
  }

  if (conteo.grupos.length > 1) {
    return MOTIVO_CLASES_DISTINTAS;
  }

  return null;
}

/** Agrupa los diagnósticos por conjunto de clases y ordena los grupos. */
function agruparClases(diagnosticos: readonly DiagnosisResult[]): readonly ClassGroup[] {
  const porConjunto = new Map<string, ClassGroup>();

  for (const diagnosis of diagnosticos) {
    const classes = ordenarClases(diagnosis.classes);
    const clave = classes.join('|');
    const grupo = porConjunto.get(clave);

    if (grupo === undefined) {
      porConjunto.set(clave, { classes, count: 1 });
    } else {
      grupo.count += 1;
    }
  }

  return [...porConjunto.values()].sort(compararGrupos);
}

/**
 * Ordena y deduplica las clases posibles.
 *
 * El orden es el de la tabla 40 para que un mismo conjunto siempre se vea y se
 * compare igual, sin importar cómo lo haya escrito el diagnóstico.
 */
function ordenarClases(classes: readonly AptitudeClass[]): readonly AptitudeClass[] {
  return [...new Set(classes)].sort((a, b) => rangoClase(a) - rangoClase(b));
}

/** Posición de una clase en la tabla 40; las desconocidas van al final. */
function rangoClase(clase: AptitudeClass): number {
  const posicion = ORDEN_CLASES.indexOf(clase);

  return posicion === -1 ? ORDEN_CLASES.length : posicion;
}

/** Posición de una variable en el dominio; las desconocidas van al final. */
function rangoVariable(variable: DiagnosisVariable): number {
  const posicion = ORDEN_VARIABLES.indexOf(variable);

  return posicion === -1 ? ORDEN_VARIABLES.length : posicion;
}

/**
 * Orden de los grupos: primero el de más puntos y, a igual conteo, el conjunto
 * que aparece primero en el orden de clases.
 */
function compararGrupos(a: ClassGroup, b: ClassGroup): number {
  if (a.count !== b.count) {
    return b.count - a.count;
  }

  return compararConjuntos(a.classes, b.classes);
}

/** Compara dos conjuntos de clases ya ordenados. */
function compararConjuntos(a: readonly AptitudeClass[], b: readonly AptitudeClass[]): number {
  for (let indice = 0; indice < a.length; indice += 1) {
    const claseA = a[indice];
    const claseB = b[indice];

    if (claseA === undefined) {
      return -1;
    }

    if (claseB === undefined) {
      return 1;
    }

    const orden = rangoClase(claseA) - rangoClase(claseB);

    if (orden !== 0) {
      return orden;
    }
  }

  return a.length - b.length;
}

/**
 * Mediana de una lista ya ordenada y no vacía.
 *
 * Con una cantidad par promedia los dos valores centrales; es la única suma
 * que hace este módulo y no es un promedio de clases.
 */
function mediana(ordenados: readonly number[]): number {
  const medio = Math.floor(ordenados.length / 2);
  const superior = ordenados[medio];

  if (superior === undefined) {
    return Number.NaN;
  }

  if (ordenados.length % 2 === 1) {
    return superior;
  }

  const inferior = ordenados[medio - 1];

  return inferior === undefined ? superior : (inferior + superior) / 2;
}
