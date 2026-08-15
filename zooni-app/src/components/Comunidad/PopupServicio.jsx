import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function PopupServicio({ servicio, onClose }) {
  const navigation = useNavigation();
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60 }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  // Un local traído del proveedor de mapas (OpenStreetMap o Google) existe en
  // el mundo real pero no tiene usuario en Zooni: el chat no iría a ninguna
  // parte. Solo los servicios cargados en la tabla `servicios` son chateables.
  const esExterno = servicio.origen === 'osm' || servicio.origen === 'google';

  const abrirMaps = () => {
    const url = servicio.google_maps_url ||
      `https://www.google.com/maps/search/?api=1&query=${servicio.lat},${servicio.lng}`;
    Linking.openURL(url);
  };

  const enviarMensaje = () => {
    onClose();
    navigation.navigate('Chat', {
      servicioId: servicio.id,
      nombre: servicio.nombre,
      tipoServicio: servicio.tipo?.charAt(0).toUpperCase() + servicio.tipo?.slice(1),
    });
  };

  return (
    <Animated.View style={[styles.popup, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.header}>
        <Text style={styles.nombre}>{servicio.nombre}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={18} color="#6B6B6B" />
        </TouchableOpacity>
      </View>
      <Text style={styles.tipo}>{servicio.tipo?.charAt(0).toUpperCase() + servicio.tipo?.slice(1)}</Text>
      {servicio.direccion && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={13} color="#6B6B6B" />
          <Text style={styles.info}>{servicio.direccion}</Text>
        </View>
      )}
      {servicio.telefono && (
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={13} color="#6B6B6B" />
          <Text style={styles.info}>{servicio.telefono}</Text>
        </View>
      )}
      {servicio.descripcion && (
        <View style={styles.infoRow}>
          <Ionicons name="document-text-outline" size={13} color="#6B6B6B" />
          <Text style={styles.info}>{servicio.descripcion}</Text>
        </View>
      )}
      {(servicio.rating != null || servicio.abiertoAhora != null) && (
        <View style={styles.infoRow}>
          {servicio.rating != null && (
            <>
              <Ionicons name="star" size={13} color="#F5A623" />
              <Text style={styles.info}>
                {servicio.rating.toFixed(1)}
                {servicio.ratingCount ? ` · ${servicio.ratingCount} reseñas` : ''}
              </Text>
            </>
          )}
          {servicio.abiertoAhora != null && (
            <Text style={[styles.info, { color: servicio.abiertoAhora ? '#2DBD72' : '#E63946', fontWeight: '600' }]}>
              {servicio.abiertoAhora ? 'Abierto ahora' : 'Cerrado'}
            </Text>
          )}
        </View>
      )}
      {/* OpenStreetMap no dice si está abierto ahora, pero sí publica el horario
          en texto ("Mo-Fr 09:00-19:00"), que es lo que hace falta saber. */}
      {servicio.horario && (
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={13} color="#6B6B6B" />
          <Text style={styles.info}>{servicio.horario}</Text>
        </View>
      )}
      <View style={styles.btnsRow}>
        {/* En los externos se ofrece llamar en lugar de chatear. */}
        {esExterno ? (
          servicio.telefono && (
            <TouchableOpacity
              style={[styles.btnMaps, styles.btnMensaje]}
              onPress={() => Linking.openURL(`tel:${servicio.telefono.replace(/[^+\d]/g, '')}`)}
            >
              <Ionicons name="call-outline" size={15} color="#2DBD72" />
              <Text style={[styles.btnMapsText, styles.btnMensajeText]}>Llamar</Text>
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity style={[styles.btnMaps, styles.btnMensaje]} onPress={enviarMensaje}>
            <Ionicons name="chatbubble-outline" size={15} color="#2DBD72" />
            <Text style={[styles.btnMapsText, styles.btnMensajeText]}>Enviar mensaje</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btnMaps} onPress={abrirMaps}>
          <Text style={styles.btnMapsText}>Ver en Google Maps</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: 'absolute', bottom: 230, alignSelf: 'center', width: '82%',
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, zIndex: 200,
  },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nombre:  { fontSize: 15, fontWeight: '700', color: '#2C2C2C', flex: 1 },
  tipo:    { fontSize: 12, fontWeight: '600', color: '#2DBD72', marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  info:    { fontSize: 13, color: '#6B6B6B' },
  btnsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnMaps: { flex: 1, backgroundColor: '#2DBD72', borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  btnMapsText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnMensaje: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F0FFF6', borderWidth: 1.5, borderColor: '#2DBD72',
  },
  btnMensajeText: { color: '#2DBD72' },
});
