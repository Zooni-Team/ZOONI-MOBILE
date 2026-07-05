/**
 * NotificationsPanel — Mini pestaña desplegable en Home (debajo del header).
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DROPDOWN_TOP = 56;

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

export default function NotificationsPanel({ visible, onClose, onNavigate, onMarcarTodasLeidas }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Timeout de 2 segundos para notificaciones
      const dataPromise = Promise.race([
        fetchNotificaciones(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 2000)
        )
      ]);

      const data = await dataPromise;
      setNotificaciones(data.notificaciones ?? []);
    } catch (error) {
      // demo / sin backend / timeout
      console.log('Notificaciones: sin backend o timeout');
      setNotificaciones([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      load();
      // Marcar como leídas después de 1.5s (tiempo de lectura). Esto también
      // tiene que apagar el circulito de la campana en Home al instante, no
      // recién la próxima vez que se recargue Home desde cero.
      const timer = setTimeout(() => {
        marcarTodasLeidas().then(() => onMarcarTodasLeidas?.()).catch(() => {/* sin backend */});
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [visible, load, onMarcarTodasLeidas]);

  const handleMarkAll = async () => {
    await marcarTodasLeidas();
    onMarcarTodasLeidas?.();
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  const handleTap = async (item) => {
    if (!item.leida) {
      await marcarNotificacionLeida(item.id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, leida: true } : n)),
      );
    }
    const ruta = item.redirigea ?? item.redirige_a;
    if (ruta) {
      onClose();
      onNavigate(ruta);
    }
  };

  if (!visible) return null;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.item, !item.leida && styles.itemUnread]}
      onPress={() => handleTap(item)}
    >
      <View style={styles.avatarWrap}>
        {item.fotoUrl ? (
          <Image source={{ uri: item.fotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="paw" size={18} color="#2DBD72" />
          </View>
        )}
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.titulo} numberOfLines={1}>{item.titulo}</Text>
        <Text style={styles.cuerpo} numberOfLines={2}>{item.cuerpo}</Text>
      </View>
      <View style={styles.rightWrap}>
        <Text style={styles.tiempo}>{timeAgo(item.createdAt)}</Text>
        {!item.leida && <View style={styles.dot} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar notificaciones" />

      <View style={styles.dropdown}>
        <View style={styles.dropdownHeader}>
          <Text style={styles.dropdownTitle}>Notificaciones</Text>
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAll}>
            <Text style={styles.markAllBtnText}>Marcar todas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dropdownBody}>
          {loading ? (
            <ActivityIndicator size="small" color="#2DBD72" style={styles.loader} />
          ) : notificaciones.length === 0 ? (
            <Text style={styles.emptyText}>No tenés notificaciones</Text>
          ) : (
            <FlatList
              data={notificaciones}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              style={styles.list}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  dropdown: {
    position: 'absolute',
    top: DROPDOWN_TOP,
    right: 14,
    width: Math.min(SCREEN_WIDTH - 28, 380),
    maxWidth: 380,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#8ED4AA',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropdownTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  markAllBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2C2C',
  },
  dropdownBody: {
    backgroundColor: '#FFFFFF',
    minHeight: 72,
    maxHeight: 240,
    justifyContent: 'center',
  },
  loader: { paddingVertical: 24 },
  emptyText: {
    fontSize: 14,
    color: '#9A9A9A',
    textAlign: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  list: { maxHeight: 240 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemUnread: { backgroundColor: 'rgba(45, 189, 114, 0.08)' },
  avatarWrap: { marginRight: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    backgroundColor: '#C8F0D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, marginRight: 6 },
  titulo: { fontSize: 13, fontWeight: '700', color: '#2C2C2C' },
  cuerpo: { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  rightWrap: { alignItems: 'flex-end', gap: 4 },
  tiempo: { fontSize: 10, color: '#AAAAAA' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2DBD72' },
});
