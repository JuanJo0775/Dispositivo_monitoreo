import {
  availableWaterPct,
  cmolKgToMgKg,
  compensateEc,
  CONVERSION_FACTORS,
  estimateCicCmolKg,
  estimateNitrogenTotalPct,
  fieldCapacityFromDensity,
  volumetricCapacityField,
} from '@/domain/diagnosis/estimates';

describe('estimateNitrogenTotalPct', () => {
  it('reproduce los valores de la tabla 8', () => {
    expect(estimateNitrogenTotalPct(14.33)).toBeCloseTo(0.535, 3);
    expect(estimateNitrogenTotalPct(11.42)).toBeCloseTo(0.451, 3);
    expect(estimateNitrogenTotalPct(6.25)).toBeCloseTo(0.275, 3);
    expect(estimateNitrogenTotalPct(6.16)).toBeCloseTo(0.271, 3);
    expect(estimateNitrogenTotalPct(5.54)).toBeCloseTo(0.248, 3);
  });

  it('satura con materia orgánica alta', () => {
    expect(estimateNitrogenTotalPct(19.28)).toBeCloseTo(0.653, 3);
  });
});

describe('estimateCicCmolKg', () => {
  it('suma la base mineral más el aporte de la materia orgánica', () => {
    expect(estimateCicCmolKg(14.33)).toBeCloseTo(28.17, 2);
    expect(estimateCicCmolKg(0)).toBeCloseTo(10.26, 2);
  });
});

describe('volumetricCapacityField', () => {
  it('reproduce la capacidad de campo volumétrica de la tabla 15', () => {
    expect(volumetricCapacityField(67.12, 0.72)).toBeCloseTo(48.3, 1);
    expect(volumetricCapacityField(42.64, 0.82)).toBeCloseTo(35, 1);
    expect(volumetricCapacityField(26.14, 1.07)).toBeCloseTo(28, 1);
    expect(volumetricCapacityField(32.65, 1.19)).toBeCloseTo(38.9, 1);
    expect(volumetricCapacityField(32.24, 1.29)).toBeCloseTo(41.6, 1);
  });
});

describe('fieldCapacityFromDensity', () => {
  it('decrece con la densidad aparente', () => {
    const baja = fieldCapacityFromDensity(0.72);
    const alta = fieldCapacityFromDensity(1.29);

    expect(baja).toBeGreaterThan(alta);
    expect(baja).toBeGreaterThan(40);
    expect(baja).toBeLessThan(90);
  });
});

describe('availableWaterPct', () => {
  it('vale 0 en el punto de marchitez y 100 en la capacidad de campo', () => {
    expect(availableWaterPct(28, 48.3, 28)).toBe(0);
    expect(availableWaterPct(48.3, 48.3, 28)).toBeCloseTo(100, 6);
  });

  it('es la mitad en la mitad del agua disponible', () => {
    expect(availableWaterPct(38.15, 48.3, 28)).toBeCloseTo(50, 6);
  });
});

describe('compensateEc', () => {
  it('no cambia la CE a 25 °C', () => {
    expect(compensateEc(1100, 25)).toBeCloseTo(1.1, 6);
  });

  it('compensa la CE medida más caliente', () => {
    expect(compensateEc(1100, 30)).toBeCloseTo(1, 6);
  });

  it('convierte de µS/cm a dS/m con el factor de la tabla 6', () => {
    expect(CONVERSION_FACTORS.usCmPerDsM).toBe(1000);
    expect(compensateEc(500, 25)).toBeCloseTo(0.5, 6);
  });
});

describe('cmolKgToMgKg', () => {
  it('reproduce los equivalentes de la tabla 13', () => {
    expect(cmolKgToMgKg(0.29, CONVERSION_FACTORS.kMgKgPerCmolKg)).toBeCloseTo(113.4, 1);
    expect(cmolKgToMgKg(0.35, CONVERSION_FACTORS.kMgKgPerCmolKg)).toBeCloseTo(136.8, 1);
    expect(cmolKgToMgKg(0.2, CONVERSION_FACTORS.kMgKgPerCmolKg)).toBeCloseTo(78.2, 1);
    expect(cmolKgToMgKg(0.5, CONVERSION_FACTORS.kMgKgPerCmolKg)).toBeCloseTo(195.5, 1);
  });
});
