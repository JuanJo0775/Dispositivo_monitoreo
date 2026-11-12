import { render } from '@testing-library/react-native';

import type { DiagnosisResult, VariableResult } from '@/domain/diagnosis/types';
import { DiagnosisCard } from '@/ui/components/diagnosis-card';

function makeVariable(overrides: Partial<VariableResult>): VariableResult {
  return {
    variable: 'humidity',
    role: 'verdict',
    status: 'class',
    value: 38,
    unit: '% v/v',
    uncertainty: 1,
    class: 'S1',
    possibleClasses: ['S1'],
    band: 'en banda sin estrés',
    possibleBands: [],
    suitability: 1,
    suitabilityInterval: { lower: 1, upper: 1 },
    confidence: 'alta',
    reference: 'Banda sin estrés',
    method: 'Ecuación 11',
    reason: null,
    ...overrides,
  };
}

function makeResult(overrides: Partial<DiagnosisResult> = {}): DiagnosisResult {
  return {
    validity: 'valid',
    classes: ['S1'],
    index: { minimum: 1, parametric: null },
    perVariable: [
      makeVariable({}),
      makeVariable({
        variable: 'p',
        role: 'indicative',
        status: 'interval',
        value: 18,
        unit: 'mg/kg',
        class: null,
        possibleClasses: [],
        band: 'medio',
        possibleBands: ['medio', 'alto'],
        suitability: null,
        suitabilityInterval: null,
        reason: 'no_se_puede_elegir_clase',
      }),
      makeVariable({
        variable: 'ec',
        role: 'reference',
        status: 'reference',
        value: null,
        unit: 'µS/cm',
        class: null,
        possibleClasses: [],
        band: null,
        suitability: null,
        suitabilityInterval: null,
        reference: null,
        reason: 'sin_dato',
      }),
    ],
    limitingFactors: [{ variable: 'humidity', suitability: 1, class: 'S1' }],
    alerts: [],
    evidence: {
      thresholdsVersion: '2026.11-v1',
      crop: 'cafe',
      cartographicUnit: 'chinchina',
      rules: ['aptitud_por_variable'],
      assumptions: ['humedad_limites_fisicos'],
      missing: ['umbrales de temperatura del suelo por cultivo'],
      sources: ['Documento de Objetivo 1'],
    },
    versions: {
      engine: 'engine-v1',
      thresholds: '2026.11-v1',
      calibration: 'factory-v1',
      firmware: '0.1.0',
    },
    explanation: 'El suelo es apto para café.',
    ...overrides,
  };
}

describe('DiagnosisCard', () => {
  it('muestra la clase única cuando la hay', async () => {
    const { getByText, getAllByText } = await render(<DiagnosisCard result={makeResult()} />);

    expect(getByText('Apto')).toBeTruthy();
    expect(getByText('S1')).toBeTruthy();
    expect(getAllByText('Humedad').length).toBeGreaterThan(0);
  });

  it('muestra todas las clases posibles y avisa que no se puede elegir una sola', async () => {
    const { getByText } = await render(
      <DiagnosisCard result={makeResult({ classes: ['S1', 'S2'] })} />,
    );

    expect(getByText('Apto')).toBeTruthy();
    expect(getByText('Moderadamente apto')).toBeTruthy();
    expect(
      getByText('Con la incertidumbre del instrumento no se puede elegir una sola clase'),
    ).toBeTruthy();
  });

  it('muestra el rol de cada variable en texto', async () => {
    const { getByText } = await render(<DiagnosisCard result={makeResult()} />);

    expect(getByText('entra en el veredicto')).toBeTruthy();
    expect(getByText('informativo')).toBeTruthy();
    expect(getByText('solo referencia')).toBeTruthy();
  });

  it('avisa cuando una variable no permite elegir clase', async () => {
    const { getByText } = await render(<DiagnosisCard result={makeResult()} />);

    expect(getByText('Con la incertidumbre del instrumento no se puede elegir clase')).toBeTruthy();
  });

  it('con un valor nulo muestra «sin dato», no un cero', async () => {
    const { getByText } = await render(<DiagnosisCard result={makeResult()} />);

    expect(getByText('sin dato')).toBeTruthy();
  });

  it('muestra el factor limitante con su valor', async () => {
    const { getByText, getAllByText } = await render(<DiagnosisCard result={makeResult()} />);

    expect(getByText('Factor limitante')).toBeTruthy();
    // Una vez en el factor limitante y otra en la fila de la variable.
    expect(getAllByText('38 % v/v')).toHaveLength(2);
  });

  it('muestra la versión de umbrales, la del motor y la de calibración', async () => {
    const { getByText } = await render(<DiagnosisCard result={makeResult()} />);

    expect(getByText('2026.11-v1')).toBeTruthy();
    expect(getByText('engine-v1')).toBeTruthy();
    expect(getByText('factory-v1')).toBeTruthy();
  });

  it('muestra las alertas con su mensaje', async () => {
    const { getByText } = await render(
      <DiagnosisCard
        result={makeResult({
          alerts: [
            {
              code: 'ce_sobre_umbral',
              severity: 'warning',
              message: 'La conductividad supera el umbral de este cultivo.',
            },
          ],
        })}
      />,
    );

    expect(getByText('advertencia')).toBeTruthy();
    expect(getByText('La conductividad supera el umbral de este cultivo.')).toBeTruthy();
  });

  it('sin clases explica que no hay veredicto', async () => {
    const { getByText } = await render(
      <DiagnosisCard result={makeResult({ validity: 'blocked', classes: [] })} />,
    );

    expect(
      getByText('No se emite veredicto: hay una restricción activa sobre esta medición.'),
    ).toBeTruthy();
  });
});
