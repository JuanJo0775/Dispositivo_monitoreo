import { Component, type ReactNode } from 'react';

export interface MapErrorBoundaryProps {
  /** Lo que se dibuja si MapLibre falla al montar o al pintar. */
  fallback: ReactNode;
  children: ReactNode;
}

interface MapErrorBoundaryState {
  failed: boolean;
}

/**
 * Frontera de error del mapa.
 *
 * Si el módulo nativo de MapLibre revienta al montar (por ejemplo, porque el
 * APK no trae la arquitectura del teléfono), la pantalla no se cae: muestra el
 * croquis con celdas y puntos. El diseño §11.4 pide explícitamente que un fallo
 * del módulo nativo no deje sin dibujo el área medida.
 */
export class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  override state: MapErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
