import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { eliminarCartel } from '../api/comunidad';

export default function PopupCartel({ cartel, userId, onClose, onEliminado }) {
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const [verMas, setVerMas] = useState(false);

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60 }).start();
    Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, []);

  const confirmarEliminar = () => {
    Alert.alert(
      'Eliminar cartel',
      '¿Eliminar este cartel? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarCartel(cartel.id);
              onEliminado(cartel.id);
              onClose();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el cartel');
            }
          },
        },
      ]
    );
  };

  const fecha = cartel.created_at
    ? new Date(cartel.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
    : '';

  const desc = cartel.descripcion || '';
  const descCorta = desc.length > 120 ? desc.slice(0, 120) + '…' : desc;

  return (
    <Animated.View style={[styles.popup, { transform: [{ translateY }], opacity }]}>
      <View style={styles.header}>
        <View style={styles.tipoRow}>
          <View style={[styles.tipoBadge, { backgroundColor: cartel.tipo === 'perdida' ? '#E63946' : '#6B6B6B' }]} />
          <Text style={styles.tipoText}>
            {cartel.tipo === 'perdida'     ? 'Mascota Perdida'   :
             cartel.tipo === 'encontrada'  ? 'Mascota Encontrada':
             cartel.tipo === 'adopcion'    ? 'En Adopción'       : 'Aviso General'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar popup">
          <Text style={styles.cerrar}>✕</Text>
        </TouchableOpacity>
      </View>

      {cartel.mascota_nombre && (
        <Text style={styles.mascotaNombre}>🐾 {cartel.mascota_nombre}</Text>
      )}
      {cartel.mascota_especie && (
        <Text style={styles.raza}>{cartel.mascota_especie} {cartel.mascota_raza ? `- ${cartel.mascota_raza}` : ''}</Text>
      )}
      {desc.length > 0 && (
        <View>
          <Text style={styles.info}>{verMas ? desc : descCorta}</Text>
          {desc.length > 120 && (
            <TouchableOpacity onPress={() => setVerMas(!verMas)}>
              <Text style={styles.verMas}>{verMas ? 'Ver menos' : 'Ver más'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {cartel.telefono_contacto && (
        <Text style={styles.info}>📞 Contacto: {cartel.telefono_contacto}</Text>
      )}
      <Text style={styles.meta}>
        Publicado por: {cartel.publicado_por}  ·  {fecha}
      </Text>

      {parseInt(cartel.usuario_id) === userId && (
        <TouchableOpacity
          style={styles.btnEliminar}
          onPress={confirmarEliminar}
          accessibilityRole="button"
          accessibilityLabel="Eliminar este cartel"
        >
          <Text style={styles.btnEliminarText}>🗑️ Eliminar Cartel</Text>
        </TouchableOpacity>
      )}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tipoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipoBadge: { width: 10, height: 10, borderRadius: 5 },
  tipoText: { fontWeight: 'bold', fontSize: 14, color: '#2C2C2C' },
  cerrar: { fontSize: 18, color: '#6B6B6B' },
  mascotaNombre: { fontSize: 16, fontWeight: 'bold', color: '#2C2C2C', marginBottom: 2 },
  raza:   { fontSize: 13, color: '#6B6B6B', marginBottom: 6 },
  info:   { fontSize: 13, color: '#6B6B6B', marginBottom: 4 },
  verMas: { fontSize: 12, color: '#2DBD72', fontWeight: '600', marginBottom: 4 },
  meta:   { fontSize: 11, color: '#AAAAAA', marginTop: 6 },
  btnEliminar: {
    backgroundColor: '#E63946',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  btnEliminarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
