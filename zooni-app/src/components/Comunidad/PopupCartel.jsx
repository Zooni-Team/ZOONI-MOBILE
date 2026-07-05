import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, Image, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { eliminarCartel } from '../../api/comunidad';

const LABELS = {
  perdida: 'Mascota Perdida', encontrada: 'Mascota Encontrada',
  adopcion: 'En Adopción', aviso_general: 'Aviso General',
};

export default function PopupCartel({ cartel, userId, onClose, onEliminado }) {
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const [verMas, setVerMas] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60 }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const desc  = cartel.descripcion || '';
  const corta = desc.length > 120 ? desc.slice(0, 120) + '…' : desc;
  const fecha = cartel.created_at
    ? new Date(cartel.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
    : '';
  const color = cartel.tipo === 'perdida' ? '#E63946' : '#6B6B6B';

  const confirmarEliminar = async () => {
    try { await eliminarCartel(cartel.id); onEliminado(cartel.id); onClose(); }
    catch {
      if (Platform.OS === 'web') window.alert('No se pudo eliminar');
      else Alert.alert('Error', 'No se pudo eliminar');
    }
  };

  const handleEliminar = () => {
    // Alert.alert con botones no hace nada en web (react-native-web no lo
    // implementa: Alert.alert es un no-op ahí), por eso hace falta este
    // fallback a window.confirm para que "Eliminar Cartel" funcione en el navegador.
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar este cartel? Esta acción no se puede deshacer.')) confirmarEliminar();
      return;
    }
    Alert.alert(
      'Eliminar cartel',
      '¿Eliminar este cartel? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: confirmarEliminar },
      ]
    );
  };

  return (
    <Animated.View style={[styles.popup, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.header}>
        <View style={styles.tipoRow}>
          <View style={[styles.badge, { backgroundColor: color }]} />
          <Text style={styles.tipoText}>{LABELS[cartel.tipo] || cartel.tipo}</Text>
        </View>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={18} color="#6B6B6B" /></TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {cartel.foto_url && (
          <Image source={{ uri: cartel.foto_url }} style={styles.foto} resizeMode="contain" />
        )}
        {cartel.mascota_nombre && (
          <View style={styles.infoRow}>
            <Ionicons name="paw-outline" size={13} color="#2C2C2C" />
            <Text style={styles.mascota}>{cartel.mascota_nombre}</Text>
          </View>
        )}
        {cartel.mascota_especie && (
          <Text style={styles.info}>{cartel.mascota_especie}{cartel.mascota_raza ? ` — ${cartel.mascota_raza}` : ''}</Text>
        )}
        {desc.length > 0 && (
          <>
            <Text style={styles.info}>{verMas ? desc : corta}</Text>
            {desc.length > 120 && (
              <TouchableOpacity onPress={() => setVerMas(v => !v)}>
                <Text style={styles.verMas}>{verMas ? 'Ver menos' : 'Ver más'}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {cartel.telefono_contacto && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={13} color="#6B6B6B" />
            <Text style={styles.info}>{cartel.telefono_contacto}</Text>
          </View>
        )}
        <Text style={styles.meta}>Publicado por: {cartel.publicado_por} · {fecha}</Text>
        {parseInt(cartel.usuario_id) === userId && (
          <TouchableOpacity style={styles.btnElim} onPress={handleEliminar}>
            <Ionicons name="trash-outline" size={16} color="#FFF" />
            <Text style={styles.btnElimText}>Eliminar Cartel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: 'absolute', bottom: 160, alignSelf: 'center', width: '82%', maxHeight: 380,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, zIndex: 200,
  },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tipoRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge:    { width: 10, height: 10, borderRadius: 5 },
  tipoText: { fontWeight: '700', fontSize: 14, color: '#2C2C2C' },
  foto:     { width: '100%', height: 140, borderRadius: 12, marginBottom: 10, backgroundColor: '#EFEFEF' },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  mascota:  { fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
  info:     { fontSize: 13, color: '#6B6B6B' },
  verMas:   { fontSize: 12, color: '#2DBD72', fontWeight: '600', marginBottom: 4 },
  meta:     { fontSize: 11, color: '#AAAAAA', marginTop: 6 },
  btnElim:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#E63946', borderRadius: 20, paddingVertical: 10, marginTop: 12 },
  btnElimText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
