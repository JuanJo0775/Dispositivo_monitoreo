import { StyleSheet, Text, View } from 'react-native';

import { MISSING_VALUE_TEXT } from '@/shared/format';

export interface FieldProps {
  /** Qué es el dato que se muestra. */
  label: string;
  /** Valor a mostrar. Si falta, se muestra «sin dato». */
  value?: string | number | null;
}

/**
 * Campo de solo lectura: una etiqueta y su valor.
 *
 * Un dato ausente se muestra como «sin dato», nunca como cero ni como hueco:
 * el cero es un dato válido y no debe confundirse con lo que no se sabe.
 */
export function Field({ label, value }: FieldProps) {
  const texto = value === null || value === undefined ? MISSING_VALUE_TEXT : String(value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5A5A5A',
  },
  value: {
    fontSize: 16,
    color: '#1F1F1F',
  },
});
