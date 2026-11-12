import type { SettingsStore } from '@/ports/stores/settings-store';

/** Clave del ajuste que activa o desactiva el modo ensayo. */
export const TRIAL_MODE_KEY = 'trial_mode';

/** Clave del ajuste que guarda que la persona ya vio el aviso de privacidad. */
export const PRIVACY_NOTICE_KEY = 'privacy_notice_ack';

/** Ajustes de la app que la capa de aplicación necesita. */
export interface AppSettings {
  /** Modo ensayo: las capturas no son productivas. */
  readonly trialMode: boolean;
  /** La persona ya vio y aceptó el aviso de privacidad. */
  readonly privacyNoticeAck: boolean;
}

export interface GetSettingsDeps {
  readonly settings: SettingsStore;
}

/** Lee los ajustes de la app. Si no hay nada guardado, devuelve los valores por defecto. */
export async function getSettings(deps: GetSettingsDeps): Promise<AppSettings> {
  const [trialMode, privacyNoticeAck] = await Promise.all([
    deps.settings.get(TRIAL_MODE_KEY),
    deps.settings.get(PRIVACY_NOTICE_KEY),
  ]);

  return {
    trialMode: trialMode === '1',
    privacyNoticeAck: privacyNoticeAck === '1',
  };
}
