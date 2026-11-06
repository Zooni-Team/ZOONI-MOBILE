import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores } from '../../theme';

export default function FilterChip({ label, icon, selected, onPress, accessibilityLabel }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? `${label}, ${selected ? 'seleccionado' : 'no seleccionado'}`}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colores.blanco : colores.texto} style={styles.icon} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: colores.blanco, borderWidth: 1.5, borderColor: colores.gris500,
    marginRight: 8, marginBottom: 8,
  },
  chipSelected: { backgroundColor: colores.verde, borderColor: colores.verde },
  icon: { marginRight: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colores.texto },
  labelSelected: { color: colores.blanco },
});
