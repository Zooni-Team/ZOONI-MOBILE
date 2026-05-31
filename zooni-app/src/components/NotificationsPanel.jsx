/**
 * NotificationsPanel.jsx — Panel de notificaciones del usuario
 *
 * Se abre al tocar la campana 🔔 del header.
 * Muestra la lista de notificaciones ordenadas de más reciente a más antigua.
 * Al abrir el panel, marca todas como leídas automáticamente en el backend.
 * Al tocar una notificación individual → navega a la sección correspondiente.
 *
 * Props:
 *   visible    → boolean que controla si el panel está abierto
 *   onClose    → función para cerrar el panel
 *   onNavigate → función que recibe la ruta y navega a esa pantalla
 *
 * Estados:
 *   notificaciones → array de notificaciones cargadas desde la API
 *   loading        → true mientras se cargan las notificaciones
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Modal, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from '../services/api';

/**
 * timeAgo — Convierte una fecha ISO a texto relativo
 * Ejemplos: "ahora", "hace 5 min", "hace 2 h", "ayer", "hace 3 días"
 */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

export default function NotificationsPanel({ visible, onClose, onNavigate }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(false);

  // Carga las notificaciones desde la API y las marca todas como leídas
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotificaciones();
      setNotificaciones(data.notificaciones);
      await marcarTodasLeidas(); // Marca todas como leídas al abrir el panel
    } catch {
      // Si falla la API, muestra lo que haya en el estado (puede estar vacío)
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga las notificaciones cada vez que el panel se abre
  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  /**
   * handleTap — Al tocar una notificación:
   * 1. La marca como leída en el backend (si no lo estaba)
   * 2. Actualiza el estado local para quitar el punto verde
   * 3. Cierra el panel y navega a la ruta indicada
   */
  const handleTap = async (item) => {
    if (!item.leida) {
      await marcarNotificacionLeida(item.id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, leida: true } : n))
      );
    }
    if (item.redirigea) {
      onClose();
      onNavigate(item.redirigea);
    }
  };

  // Renderiza cada ítem de la lista de notificaciones
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.item, !item.leida && styles.itemUnread]} // Fondo verde suave si no leída
      onPress={() => handleTap(item)}
    >
      {/* Avatar: foto del usuario/mascota o ícono de pata como fallback */}
      <View style={styles.avatarWrap}>
        {item.fotoUrl ? (
          <Image source={{ uri: item.fotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="paw" size={18} color="#2DBD72" />
          </View>
        )}
      </View>

      {/* Título y cuerpo de la notificación */}
      <View style={styles.textWrap}>
        <Text style={styles.titulo} numberOfLines={1}>{item.titulo}</Text>
        <Text style={styles.cuerpo} numberOfLines={2}>{item.cuerpo}</Text>
      </View>

      {/* Tiempo relativo + punto verde si no leída */}
      <View style={styles.rightWrap}>
        <Text style={styles.tiempo}>{timeAgo(item.createdAt)}</Text>
        {!item.leida && <View style={styles.dot} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header del panel */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          {/* Botón para marcar todas como leídas manualmente */}
          <TouchableOpacity onPress={async () => {
            await marcarTodasLeidas();
            setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
          }}>
            <Text style={styles.markAll}>Marcar todas</Text>
          </TouchableOpacity>
        </View>

        {/* Contenido: spinner / lista / estado vacío */}
        {loading ? (
          <ActivityIndicator size="large" color="#2DBD72" style={{ marginTop: 40 }} />
        ) : notificaciones.length === 0 ? (
          // Estado vacío: sin notificaciones
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={64} color="#AAAAAA" />
            <Text style={styles.emptyText}>No tenés notificaciones por ahora</Text>
          </View>
        ) : (
          // Lista de notificaciones
          <FlatList
            data={notificaciones}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#2C2C2C' },
  markAll: { fontSize: 13, color: '#2DBD72', fontWeight: '600' },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  itemUnread: { backgroundColor: 'rgba(45, 189, 114, 0.08)' }, // Verde suave para no leídas
  avatarWrap: { marginRight: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: '#C8F0D8', alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1, marginRight: 8 },
  titulo: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },
  cuerpo: { fontSize: 13, color: '#6B6B6B', marginTop: 2 },
  rightWrap: { alignItems: 'flex-end', gap: 6 },
  tiempo: { fontSize: 11, color: '#AAAAAA' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2DBD72' }, // Punto verde = no leída
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#AAAAAA', textAlign: 'center' },
});
