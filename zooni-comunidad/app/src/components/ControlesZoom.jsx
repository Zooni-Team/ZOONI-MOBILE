import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function ControlesZoom({ onZoomIn, onZoomOut }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.btn}
        onPress={onZoomIn}
        accessibilityLabel="Acercar mapa"
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.btn}
        onPress={onZoomOut}
        accessibilityLabel="Alejar mapa"
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>−</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 260,
    right: 12,
    gap: 2,
  },
  btn: {
    width: 36,
    height: 36,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  btnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
  },
});
