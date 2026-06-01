import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function FilterChip({ label, icon, selected, onPress, accessibilityLabel }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? `${label}, ${selected ? 'seleccionado' : 'no seleccionado'}`}
    >
      {icon ? <Text style={styles.icon}>{icon} </Text> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#DDDDDD',
    marginRight: 8, marginBottom: 8,
  },
  chipSelected: { backgroundColor: '#2DBD72', borderColor: '#2DBD72' },
  icon: { fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600', color: '#2C2C2C' },
  labelSelected: { color: '#FFFFFF' },
});
