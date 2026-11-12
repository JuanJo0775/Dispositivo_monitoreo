import { StyleSheet, Text, View } from 'react-native';

import type {
  AptitudeClass,
  DiagnosisAlert,
  DiagnosisResult,
  DiagnosisVariable,
  VariableRole,
} from '@/domain/diagnosis/types';
import { MISSING_VALUE_TEXT, formatNumber } from '@/shared/format';

/**
 * Tarjeta de diagnóstico: clases, factor limitante, variables, alertas y evidencia.
 *
 * Solo presenta: no calcula ni decide. Todo el texto está en español de Colombia, un dato
 * ausente se muestra como «sin dato» (nunca como cero) y los estados se distinguen con texto,
 * no solo con color.
 */

/** Nombre de cada clase de aptitud en español. */
export const CLASS_LABELS: Record<AptitudeClass, string> = {
  S1: 'Apto',
  S2: 'Moderadamente apto',
  S3: 'Marginalmente apto',
  N: 'No apto',
};

/** Nombre de cada variable en español. */
export const VARIABLE_LABELS: Record<DiagnosisVariable, string> = {
  humidity: 'Humedad',
  ph: 'pH',
  ec: 'Conductividad',
  n: 'Nitrógeno',
  nSensor: 'Nitrógeno de la sonda',
  p: 'Fósforo',
  k: 'Potasio',
  temperature: 'Temperatura',
  organicMatter: 'Materia orgánica',
  cic: 'Capacidad de intercambio',
};

/** Papel de la variable en el veredicto, en texto. */
export const ROLE_LABELS: Record<VariableRole, string> = {
  verdict: 'entra en el veredicto',
  indicative: 'informativo',
  reference: 'solo referencia',
};

/** Qué tan fuerte es una alerta, en texto. */
const SEVERITY_LABELS: Record<DiagnosisAlert['severity'], string> = {
  blocking: 'bloquea el veredicto',
  warning: 'advertencia',
  info: 'aviso',
};

/** Bandas publicadas por la ciencia, en español. */
const BAND_LABELS: Record<string, string> = {
  optimo: 'en la banda óptima',
  por_debajo: 'por debajo de la banda óptima',
  por_encima: 'por encima de la banda óptima',
  cumple_minimo: 'cumple el mínimo',
  bajo: 'bajo',
  medio: 'medio',
  alto: 'alto',
  'en banda sin estrés': 'en banda sin estrés',
  'por debajo del umbral sin estrés': 'por debajo del umbral sin estrés',
  saturado: 'saturado',
  'por debajo del nivel crítico': 'por debajo del nivel crítico',
  'por encima del nivel crítico': 'por encima del nivel crítico',
  'por encima del umbral del cultivo': 'por encima del umbral del cultivo',
  'por debajo del umbral del cultivo': 'por debajo del umbral del cultivo',
};

/** Motivos que deja el motor, en español. */
const REASON_LABELS: Record<string, string> = {
  sin_dato: 'La sonda no entregó este dato',
  sin_umbral: 'No hay umbral publicado para esta variable',
  sin_unidad_cartografica: 'El lote no tiene unidad cartográfica',
  sin_temperatura_para_compensar: 'Falta la temperatura para compensar la conductividad',
  no_se_puede_elegir_clase: 'Con la incertidumbre del instrumento no se puede elegir clase',
  sin_limites_absolutos_publicados: 'La fuente no publica límites absolutos',
  comparado_con_otro_metodo_analitico: 'Comparado con otro método analítico',
  bajo_el_nivel_critico: 'Está bajo el nivel crítico',
  uso_relativo_hasta_calibracion: 'De uso relativo hasta la calibración',
  no_diagnostica: 'No diagnostica: es una variable de control',
  estimado_por_unidad_cartografica: 'Estimado por la unidad cartográfica',
  fuera_de_rango_y_de_fraccion: 'Fuera de rango y de fracción: no alimenta el diagnóstico',
};

/** Supuestos del motor, en español. */
const ASSUMPTION_LABELS: Record<string, string> = {
  humedad_limites_fisicos:
    'La humedad se compara con los límites físicos de la unidad cartográfica',
  ph_cafe_limite_inferior: 'Para el café se usa el límite inferior de pH publicado',
  ph_cafe_limite_superior: 'Para el café se usa el límite superior de pH publicado',
  creciente_desde_cero:
    'En las variables que suben con el contenido, la aptitud baja de forma lineal hasta el contenido cero',
  indice_parametrico_advertencia:
    'El índice paramétrico solo apoya: la clase la fija la variable más limitante',
};

/** Etiqueta de una clase de aptitud. */
export function classLabel(value: AptitudeClass): string {
  return CLASS_LABELS[value];
}

/** Lista de clases en texto, para el resumen de una pantalla. */
export function classesToText(classes: readonly AptitudeClass[]): string {
  if (classes.length === 0) {
    return 'Sin veredicto';
  }

  return classes.map((value) => `${classLabel(value)} (${value})`).join(' o ');
}

/** Valor con su unidad, o «sin dato» cuando no hay dato. */
function formatValue(value: number | null, unit: string): string {
  if (value === null) {
    return MISSING_VALUE_TEXT;
  }

  const number = formatNumber(value);

  return unit.length > 0 ? `${number} ${unit}` : number;
}

function bandLabel(band: string): string {
  return BAND_LABELS[band] ?? band;
}

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

function assumptionLabel(assumption: string): string {
  return ASSUMPTION_LABELS[assumption] ?? assumption;
}

function Verdict({ result }: { result: DiagnosisResult }) {
  const single = result.classes.length === 1 ? result.classes[0] : undefined;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Clase de aptitud</Text>

      {single !== undefined ? (
        <View style={styles.classRow}>
          <Text style={styles.classLabel}>{classLabel(single)}</Text>
          <Text style={styles.classCode}>{single}</Text>
        </View>
      ) : null}

      {result.classes.length > 1 ? (
        <>
          <View style={styles.classRow}>
            {result.classes.map((value) => (
              <View key={value} style={styles.classChip}>
                <Text style={styles.classLabel}>{classLabel(value)}</Text>
                <Text style={styles.classCode}>{value}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>
            Con la incertidumbre del instrumento no se puede elegir una sola clase
          </Text>
        </>
      ) : null}

      {result.classes.length === 0 ? (
        <Text style={styles.none}>
          {result.validity === 'blocked'
            ? 'No se emite veredicto: hay una restricción activa sobre esta medición.'
            : 'No hay veredicto de aptitud con estos datos.'}
        </Text>
      ) : null}
    </View>
  );
}

function LimitingFactor({ result }: { result: DiagnosisResult }) {
  const factor = result.limitingFactors[0];

  if (factor === undefined) {
    return null;
  }

  const variable = result.perVariable.find((item) => item.variable === factor.variable);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Factor limitante</Text>
      <Text style={styles.factorName}>{VARIABLE_LABELS[factor.variable]}</Text>
      <Text style={styles.factorValue}>
        {formatValue(variable?.value ?? null, variable?.unit ?? '')}
      </Text>
      <Text style={styles.note}>
        Es la variable más limitante: por la ley del mínimo, ella fija la clase del suelo.
      </Text>
    </View>
  );
}

function VariableRow({ variable }: { variable: DiagnosisResult['perVariable'][number] }) {
  const showReason =
    variable.reason !== null &&
    !(variable.status === 'interval' && variable.reason === 'no_se_puede_elegir_clase');

  return (
    <View style={styles.variableRow}>
      <View style={styles.variableHeader}>
        <Text style={styles.variableName}>{VARIABLE_LABELS[variable.variable]}</Text>
        <Text style={styles.variableRole}>{ROLE_LABELS[variable.role]}</Text>
      </View>

      <Text style={styles.variableValue}>{formatValue(variable.value, variable.unit)}</Text>

      {variable.band !== null ? (
        <Text style={styles.variableBand}>Banda: {bandLabel(variable.band)}</Text>
      ) : null}

      {variable.possibleBands.length > 1 ? (
        <Text style={styles.variableBand}>
          Bandas posibles: {variable.possibleBands.map((band) => bandLabel(band)).join(' o ')}
        </Text>
      ) : null}

      {variable.status === 'interval' ? (
        <Text style={styles.variableNote}>
          Con la incertidumbre del instrumento no se puede elegir clase
        </Text>
      ) : null}

      {showReason ? (
        <Text style={styles.variableNote}>{reasonLabel(variable.reason ?? '')}</Text>
      ) : null}
    </View>
  );
}

function Variables({ result }: { result: DiagnosisResult }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Variables</Text>
      {result.perVariable.map((variable) => (
        <VariableRow key={variable.variable} variable={variable} />
      ))}
    </View>
  );
}

function Alerts({ result }: { result: DiagnosisResult }) {
  if (result.alerts.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Alertas</Text>
      {result.alerts.map((alert) => (
        <View key={`${alert.code}-${alert.severity}`} style={styles.alertRow}>
          <Text style={alert.severity === 'info' ? styles.alertSeverityInfo : styles.alertSeverity}>
            {SEVERITY_LABELS[alert.severity]}
          </Text>
          <Text style={styles.alertMessage}>{alert.message}</Text>
        </View>
      ))}
    </View>
  );
}

function Evidence({ result }: { result: DiagnosisResult }) {
  const { evidence, versions } = result;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Evidencia</Text>

      <Text style={styles.evidenceLabel}>Versión de umbrales</Text>
      <Text style={styles.evidenceValue}>{evidence.thresholdsVersion}</Text>

      <Text style={styles.evidenceLabel}>Versión del motor</Text>
      <Text style={styles.evidenceValue}>{versions.engine}</Text>

      <Text style={styles.evidenceLabel}>Versión de calibración</Text>
      <Text style={styles.evidenceValue}>{versions.calibration}</Text>

      <Text style={styles.evidenceLabel}>Versión de firmware</Text>
      <Text style={styles.evidenceValue}>{versions.firmware ?? MISSING_VALUE_TEXT}</Text>

      <Text style={styles.evidenceLabel}>Supuestos</Text>
      {evidence.assumptions.length === 0 ? (
        <Text style={styles.evidenceItem}>{MISSING_VALUE_TEXT}</Text>
      ) : (
        evidence.assumptions.map((assumption) => (
          <Text key={assumption} style={styles.evidenceItem}>
            {assumptionLabel(assumption)}
          </Text>
        ))
      )}

      <Text style={styles.evidenceLabel}>Vacíos</Text>
      {evidence.missing.length === 0 ? (
        <Text style={styles.evidenceItem}>{MISSING_VALUE_TEXT}</Text>
      ) : (
        evidence.missing.map((missing) => (
          <Text key={missing} style={styles.evidenceItem}>
            {missing}
          </Text>
        ))
      )}
    </View>
  );
}

export interface DiagnosisCardProps {
  readonly result: DiagnosisResult;
}

/** Presenta un diagnóstico completo: clase, factor limitante, variables, alertas y evidencia. */
export function DiagnosisCard({ result }: DiagnosisCardProps) {
  return (
    <View style={styles.card}>
      <Verdict result={result} />
      <LimitingFactor result={result} />
      <Variables result={result} />
      <Alerts result={result} />
      <Evidence result={result} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3DA',
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5A5A5A',
  },
  classRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  classChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  classLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1B4332',
  },
  classCode: {
    fontSize: 14,
    color: '#5A5A5A',
  },
  none: {
    fontSize: 16,
    color: '#8A3B12',
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  factorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B4332',
  },
  factorValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  variableRow: {
    borderTopWidth: 1,
    borderTopColor: '#EEF1EA',
    paddingTop: 10,
    gap: 4,
  },
  variableHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  variableName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B4332',
  },
  variableRole: {
    fontSize: 13,
    color: '#4A4A4A',
  },
  variableValue: {
    fontSize: 18,
    color: '#1F1F1F',
  },
  variableBand: {
    fontSize: 14,
    color: '#3F3F3F',
  },
  variableNote: {
    fontSize: 13,
    color: '#8A3B12',
  },
  alertRow: {
    gap: 2,
  },
  alertSeverity: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A3B12',
  },
  alertSeverityInfo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A4A4A',
  },
  alertMessage: {
    fontSize: 15,
    color: '#1F1F1F',
  },
  evidenceLabel: {
    fontSize: 13,
    color: '#5A5A5A',
    marginTop: 6,
  },
  evidenceValue: {
    fontSize: 16,
    color: '#1F1F1F',
  },
  evidenceItem: {
    fontSize: 14,
    color: '#3F3F3F',
  },
});
