/**
 * CantidadPerros.jsx — Cuántos perros saca el paseador por paseo
 *
 * Botones − / + y el número en el medio se puede escribir directo (sin tope:
 * antes no dejaba pasar de 6). Mínimo 1. Mientras se escribe puede quedar
 * vacío: en ese caso onCambio recibe null y la pantalla lo marca como error.
 *
 * Props: valor (número | null) · onCambio(número | null) · error (bool)
 */

import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from './PaseadorUI';
import { sanitizarDigitos } from '../../utils/sanitizar';

export default function CantidadPerros({ valor, onCambio, error }) {
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onCambio(Math.max(1, (valor ?? 1) - 1))}
        accessibilityLabel="Un perro menos">
        <Ionicons name="remove" size={22} color={C.teal} />
      </TouchableOpacity>
      <TextInput
        style={[s.valor, error && s.valorError]}
        value={valor == null ? '' : String(valor)}
        onChangeText={(v) => {
          const d = sanitizarDigitos(v, 3);
          onCambio(d === '' ? null : Number(d));
        }}
        keyboardType="number-pad"
        selectTextOnFocus
        accessibilityLabel="Perros por paseo"
      />
      <TouchableOpacity style={s.stepBtn} onPress={() => onCambio((valor ?? 0) + 1)}
        accessibilityLabel="Un perro más">
        <Ionicons name="add" size={22} color={C.teal} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  valor: {
    minWidth: 64, height: 44, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12, paddingHorizontal: 8,
    fontSize: 24, fontWeight: '900', color: C.texto, textAlign: 'center', backgroundColor: '#FFFFFF',
  },
  valorError: { borderColor: C.rojo },
});
