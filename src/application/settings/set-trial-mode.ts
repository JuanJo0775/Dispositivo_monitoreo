import type { SettingsStore } from '@/ports/stores/settings-store';

import { TRIAL_MODE_KEY } from './get-settings';

export interface SetTrialModeDeps {
  readonly settings: SettingsStore;
}

/**
 * Activa o desactiva el modo ensayo.
 *
 * En modo ensayo la app no escribe configuración al bastón y marca las capturas como de ensayo:
 * sus datos no son productivos.
 */
export async function setTrialMode(enabled: boolean, deps: SetTrialModeDeps): Promise<void> {
  await deps.settings.set(TRIAL_MODE_KEY, enabled ? '1' : '0');
}
