import { APP_NAME } from '@/domain/types';

describe('dominio: identidad de la app', () => {
  it('expone el nombre visible de la app', () => {
    expect(APP_NAME).toBe('Monitoreo de suelo');
  });
});
