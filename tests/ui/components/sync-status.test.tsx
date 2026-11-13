import { render } from '@testing-library/react-native';

import type { SyncSummary } from '@/application/sync/sync-from-stick';
import { SyncStatus } from '@/ui/components/sync-status';

function makeSummary(overrides: Partial<SyncSummary> = {}): SyncSummary {
  return {
    received: 12,
    imported: 9,
    duplicates: 2,
    conflicts: 1,
    errors: 0,
    lastConfirmedSequence: 20,
    ...overrides,
  };
}

describe('SyncStatus', () => {
  it('muestra los números del resumen en texto', async () => {
    const { getByText, queryByText } = await render(
      <SyncStatus summary={makeSummary()} lastConfirmedSequence={20} status="idle" />,
    );

    expect(getByText('Recibidos del bastón')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
    expect(getByText('Guardados')).toBeTruthy();
    expect(getByText('9')).toBeTruthy();
    expect(getByText('Ya estaban guardados')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('Con conflicto')).toBeTruthy();
    expect(getByText('Con error')).toBeTruthy();
    expect(getByText('20')).toBeTruthy();
    expect(queryByText('ninguno todavía')).toBeNull();
  });

  it('avisa cuando hay conflictos y dice que se conservó el primero', async () => {
    const { getByText } = await render(
      <SyncStatus summary={makeSummary({ conflicts: 1 })} lastConfirmedSequence={12} />,
    );

    expect(
      getByText(/Hay 1 registro con el mismo identificador y contenido distinto/),
    ).toBeTruthy();
    expect(getByText(/se conservó el primero/)).toBeTruthy();
  });

  it('avisa cuando no hay nada sincronizado todavía', async () => {
    const { getByText } = await render(<SyncStatus summary={null} lastConfirmedSequence={null} />);

    expect(getByText('ninguno todavía')).toBeTruthy();
    expect(getByText(/Todavía no se ha sincronizado ningún registro/)).toBeTruthy();
  });

  it('cuenta los errores y aclara que quedan pendientes en el bastón', async () => {
    const { getByText } = await render(
      <SyncStatus summary={makeSummary({ errors: 2 })} lastConfirmedSequence={12} />,
    );

    expect(getByText(/2 registros no se pudo guardar/)).toBeTruthy();
    expect(getByText(/Queda pendiente en el bastón/)).toBeTruthy();
  });

  it('muestra el estado de sincronización en texto', async () => {
    const { getByText } = await render(
      <SyncStatus summary={null} lastConfirmedSequence={4} status="syncing" />,
    );

    expect(getByText(/Sincronizando con el bastón/)).toBeTruthy();
    expect(getByText('4')).toBeTruthy();
  });
});
