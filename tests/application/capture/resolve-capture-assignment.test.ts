import { resolveCaptureAssignment } from '@/application/capture/resolve-capture-assignment';

import { makePlot, makeSession } from '../../helpers/farm-fixtures';
import { makeInMemoryFarmStore } from '../../helpers/in-memory-farm-store';
import { makeInMemorySessionStore } from '../../helpers/in-memory-session-store';

describe('resolveCaptureAssignment', () => {
  it('resuelve el lote por el código que trae el bastón cuando ese lote existe', async () => {
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'lote-3' })] });
    const sessions = makeInMemorySessionStore([]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: 'lote-3', configId: 0 },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion).toEqual({ plotId: 'lote-3', sessionId: null });
  });

  it('resuelve lote y sesión por configId cuando el código de lote no viene', async () => {
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'plot-1' })] });
    const sessions = makeInMemorySessionStore([makeSession({ id: 'sesion-9', configId: 9 })]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: null, configId: 9 },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion).toEqual({ plotId: 'plot-1', sessionId: 'sesion-9' });
  });

  it('deja lote y sesión en null cuando no hay ninguna coincidencia', async () => {
    const farms = makeInMemoryFarmStore({ plots: [] });
    const sessions = makeInMemorySessionStore([]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: 'lote-fantasma', configId: 42 },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion).toEqual({ plotId: null, sessionId: null });
  });

  it('cae a la sesión cuando el código de lote no corresponde a ningún lote', async () => {
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'plot-1' })] });
    const sessions = makeInMemorySessionStore([makeSession({ id: 'sesion-9', configId: 9 })]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: 'codigo-viejo', configId: 9 },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion).toEqual({ plotId: 'plot-1', sessionId: 'sesion-9' });
  });

  it('no inventa el lote de una sesión cuyo lote ya no existe, pero conserva la sesión', async () => {
    const farms = makeInMemoryFarmStore({ plots: [] });
    const sessions = makeInMemorySessionStore([makeSession({ id: 'sesion-9', configId: 9 })]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: null, configId: 9 },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion).toEqual({ plotId: null, sessionId: 'sesion-9' });
  });

  it('prefiere el código de lote sobre el lote de la sesión', async () => {
    const farms = makeInMemoryFarmStore({
      plots: [makePlot({ id: 'lote-codigo' }), makePlot({ id: 'lote-sesion' })],
    });
    const sessions = makeInMemorySessionStore([
      makeSession({ id: 'sesion-9', configId: 9, plotId: 'lote-sesion' }),
    ]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: 'lote-codigo', configId: 9 },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion).toEqual({ plotId: 'lote-codigo', sessionId: 'sesion-9' });
  });

  it('usa el lote de respaldo solo cuando ninguna regla encontró lote', async () => {
    const farms = makeInMemoryFarmStore({ plots: [] });
    const sessions = makeInMemorySessionStore([]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: null, configId: 0, fallbackPlotId: 'lote-actual' },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion).toEqual({ plotId: 'lote-actual', sessionId: null });
  });

  it('no usa el respaldo si el código de lote ya resolvió un lote', async () => {
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'lote-3' })] });
    const sessions = makeInMemorySessionStore([]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: 'lote-3', configId: 0, fallbackPlotId: 'lote-actual' },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion.plotId).toBe('lote-3');
  });

  it('ignora un código de lote vacío y busca la sesión', async () => {
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'plot-1' })] });
    const sessions = makeInMemorySessionStore([makeSession({ id: 'sesion-9', configId: 9 })]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: '   ', configId: 9 },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion).toEqual({ plotId: 'plot-1', sessionId: 'sesion-9' });
  });

  it('no busca sesión cuando el configId todavía es cero', async () => {
    const farms = makeInMemoryFarmStore({ plots: [makePlot({ id: 'plot-1' })] });
    const sessions = makeInMemorySessionStore([makeSession({ id: 'sesion-0', configId: 0 })]);

    const asignacion = await resolveCaptureAssignment(
      { plotCode: null, configId: 0 },
      { farms: farms.farms, sessions: sessions.sessions },
    );

    expect(asignacion).toEqual({ plotId: null, sessionId: null });
  });
});
