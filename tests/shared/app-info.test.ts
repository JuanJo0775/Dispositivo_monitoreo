import { APP_NAME } from '@/shared/app-info';

describe('metadatos de la app', () => {
  it('expone el nombre visible', () => {
    expect(APP_NAME).toBe('Monitoreo de suelo');
  });
});
