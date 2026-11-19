import { createContext, useContext } from 'react';

/** De dónde salen los datos del bastón. */
export type StickMode = 'real' | 'simulated';

/**
 * Elección del bastón activo.
 *
 * La app arranca en `real`: busca por Bluetooth el bastón del contrato. El
 * modo `simulated` existe para mostrar la app sin hardware —ferias, pruebas de
 * interfaz, el equipo de diseño— y todo lo que produce viaja marcado como dato
 * simulado. Nunca se mezcla en silencio con una captura de campo.
 */
export interface StickSettings {
  readonly mode: StickMode;
  setMode(mode: StickMode): void;
}

/** Valor por defecto: real y sin forma de cambiar; las pantallas aisladas lo usan. */
const DEFAULT_SETTINGS: StickSettings = {
  mode: 'real',
  setMode: () => {},
};

export const StickSettingsContext = createContext<StickSettings>(DEFAULT_SETTINGS);

/** Lee el modo de bastón activo. */
export function useStickSettings(): StickSettings {
  return useContext(StickSettingsContext);
}
