import {
  hasCompleteBandData,
  parseThresholdSet,
  type ThresholdSet,
} from '@/domain/diagnosis/threshold-set';

import rawSet from '../../../assets/thresholds/2026.11-v1.json';

describe('set de umbrales 2026.11-v1', () => {
  const set = parseThresholdSet(rawSet) as ThresholdSet;

  it('valida contra el esquema', () => {
    expect(set.version).toBe('2026.11-v1');
    expect(set.schemaVersion).toBe(1);
    expect(set.source).toContain('Objetivo 1 v2');
  });

  it('trae los cinco cultivos de la tabla 17', () => {
    expect(Object.keys(set.crops).sort()).toEqual([
      'aguacate',
      'banano',
      'cafe',
      'citricos',
      'platano',
    ]);
    expect(set.crops.cafe?.label).toBe('Café');
    expect(set.crops.platano?.label).toBe('Plátano');
  });

  it('trae las cinco unidades cartográficas del Quindío con su MO de la tabla 3', () => {
    expect(Object.keys(set.cartographicUnits).sort()).toEqual([
      'buenavista',
      'chinchina',
      'genova',
      'montenegro',
      'quindio',
    ]);

    expect(set.cartographicUnits.chinchina?.moPct).toBe(14.33);
    expect(set.cartographicUnits.quindio?.moPct).toBe(11.42);
    expect(set.cartographicUnits.montenegro?.moPct).toBe(6.25);
    expect(set.cartographicUnits.genova?.moPct).toBe(6.16);
    expect(set.cartographicUnits.buenavista?.moPct).toBe(5.54);
  });

  it('trae el N estimado de la tabla 8 para cada unidad', () => {
    expect(set.cartographicUnits.chinchina?.nTotalPct).toBe(0.535);
    expect(set.cartographicUnits.quindio?.nTotalPct).toBe(0.451);
    expect(set.cartographicUnits.montenegro?.nTotalPct).toBe(0.275);
    expect(set.cartographicUnits.genova?.nTotalPct).toBe(0.271);
    expect(set.cartographicUnits.buenavista?.nTotalPct).toBe(0.248);
  });

  it('trae el umbral de humedad de la tabla 15 para cada unidad y cultivo', () => {
    expect(set.cartographicUnits.chinchina?.stressThresholdPct.cafe).toBe(40.2);
    expect(set.cartographicUnits.chinchina?.stressThresholdPct.platano).toBe(41.2);
    expect(set.cartographicUnits.chinchina?.stressThresholdPct.aguacate).toBe(34.1);
    expect(set.cartographicUnits.buenavista?.stressThresholdPct.citricos).toBe(30.5);
  });

  it('trae la banda de pH de café con sus límites absolutos', () => {
    const ph = set.crops.cafe?.variables.ph;

    expect(ph?.kind).toBe('band');
    expect(ph?.kind === 'band' ? ph.optimal : null).toEqual([5, 5.5]);
    expect(ph?.kind === 'band' ? ph.absoluteUpper : null).toBe(6);
    expect(hasCompleteBandData(ph as never)).toBe(true);
  });

  it('deja el pH de los otros cultivos sin límites absolutos', () => {
    const ph = set.crops.platano?.variables.ph;

    expect(ph?.kind === 'band' ? ph.optimal : null).toEqual([5.5, 7]);
    expect(ph?.kind === 'band' ? ph.absoluteLower : null).toBeUndefined();
  });

  it('deja el N de la sonda fuera del veredicto y el N estimado dentro del de café', () => {
    expect(set.crops.cafe?.variables.nEstimated?.role).toBe('verdict');
    expect(set.crops.platano?.variables.nEstimated?.kind).toBe('none');
  });

  it('deja el P y el K como indicativos en todos los cultivos', () => {
    for (const crop of Object.values(set.crops)) {
      expect(crop.variables.p?.role).toBe('indicative');
      expect(crop.variables.k?.role).toBe('indicative');
    }
  });

  it('deja la CE como referencia con su umbral agronómico', () => {
    expect(
      set.crops.cafe?.variables.ec?.kind === 'decreasing'
        ? set.crops.cafe?.variables.ec?.alertAbove
        : null,
    ).toBe(1.1);
    expect(
      set.crops.platano?.variables.ec?.kind === 'decreasing'
        ? set.crops.platano?.variables.ec?.alertAbove
        : null,
    ).toBe(2);
  });

  it('rechaza un set con una variable sin unidad', () => {
    const invalid = {
      ...(rawSet as Record<string, unknown>),
      crops: {
        cafe: {
          ...(rawSet as { crops: { cafe: Record<string, unknown> } }).crops.cafe,
          variables: {
            humidity: { kind: 'band', role: 'verdict' },
          },
        },
      },
    };

    expect(() => parseThresholdSet(invalid)).toThrow();
  });

  it('rechaza un set que no declara versión', () => {
    const { version: _version, ...sinVersion } = rawSet as Record<string, unknown>;

    expect(() => parseThresholdSet(sinVersion)).toThrow();
  });
});
