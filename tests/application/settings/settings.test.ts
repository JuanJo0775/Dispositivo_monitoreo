import { getSettings, PRIVACY_NOTICE_KEY } from '@/application/settings/get-settings';
import { setTrialMode } from '@/application/settings/set-trial-mode';

import { makeInMemorySettingsStore } from '../../helpers/in-memory-diagnosis-stores';

describe('ajustes de la app', () => {
  it('devuelve los valores por defecto cuando no hay nada guardado', async () => {
    const { settings } = makeInMemorySettingsStore();

    const result = await getSettings({ settings });

    expect(result).toEqual({ trialMode: false, privacyNoticeAck: false });
  });

  it('guarda y lee el modo ensayo', async () => {
    const { settings } = makeInMemorySettingsStore();

    await setTrialMode(true, { settings });
    const activo = await getSettings({ settings });

    expect(activo.trialMode).toBe(true);

    await setTrialMode(false, { settings });
    const inactivo = await getSettings({ settings });

    expect(inactivo.trialMode).toBe(false);
  });

  it('guarda que la persona ya vio el aviso de privacidad', async () => {
    const { settings, settingRows } = makeInMemorySettingsStore();

    await settings.set(PRIVACY_NOTICE_KEY, '1');
    const result = await getSettings({ settings });

    expect(result.privacyNoticeAck).toBe(true);
    expect(settingRows[PRIVACY_NOTICE_KEY]).toBe('1');
  });
});
