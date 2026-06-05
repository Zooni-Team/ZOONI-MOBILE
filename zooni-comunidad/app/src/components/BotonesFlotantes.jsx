import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function BotonesFlotantes({ onMiUbicacion, onAgregarAmigo, onCrearCartel, modoCartel }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.btn}
        onPress={onMiUbicacion}
        accessibilityLabel="Centrar mapa en mi ubicación"
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>📍 Mi Ubicación</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btn}
        onPress={onAgregarAmigo}
        accessibilityLabel="Agregar amigo"
        accessibilityRole="button"
      >
        <Text style={styles.btnText}>➕ Agregar Amigo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnRojo, modoCartel && styles.btnActivo]}
        onPress={onCrearCartel}
        accessibilityLabel="Crear cartel comunitario"
        accessibilityRole="button"
      >
        <Text style={[styles.btnText, styles.btnTextoBlanco]}>🚨 Crear Cartel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 12,
    gap: 8,
  },
  btn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  btnRojo: {
    backgroundColor: '#E63946',
  },
  btnActivo: {
    backgroundColor: '#2DBD72',
  },
  btnText: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#2C2C2C',
  },
  btnTextoBlanco: {
    color: '#fff',
  },
});
