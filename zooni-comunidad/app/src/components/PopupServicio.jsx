import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Linking } from 'react-native';

export default function PopupServicio({ servicio, onClose }) {
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60 }).start();
    Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);

  const abrirGoogleMaps = () => {
    const url = servicio.google_maps_url ||
      `https://www.google.com/maps/search/?api=1&query=${servicio.lat},${servicio.lng}`;
    Linking.openURL(url);
  };

  return (
    <Animated.View style={[styles.popup, { transform: [{ translateY }], opacity }]}>
      <View style={styles.header}>
        <Text style={styles.nombre}>{servicio.nombre}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar popup">
          <Text style={styles.cerrar}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.tipo}>{servicio.tipo?.charAt(0).toUpperCase() + servicio.tipo?.slice(1)}</Text>
      {servicio.direccion && <Text style={styles.info}>📍 {servicio.direccion}</Text>}
      {servicio.telefono  && <Text style={styles.info}>📞 {servicio.telefono}</Text>}
      {servicio.descripcion && <Text style={styles.info}>🔬 {servicio.descripcion}</Text>}
      <TouchableOpacity style={styles.btnMaps} onPress={abrirGoogleMaps} accessibilityRole="button">
        <Text style={styles.btnMapsText}>Ver en Google Maps</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: 'absolute',
    bottom: 220,
    left: '10%',
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nombre: { fontSize: 16, fontWeight: 'bold', color: '#2C2C2C', flex: 1 },
  cerrar: { fontSize: 18, color: '#6B6B6B', paddingLeft: 8 },
  tipo:   { fontSize: 12, color: '#2DBD72', fontWeight: '600', marginBottom: 8 },
  info:   { fontSize: 13, color: '#6B6B6B', marginBottom: 4 },
  btnMaps: {
    backgroundColor: '#2DBD72',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  btnMapsText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
