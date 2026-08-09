/**
 * NotificationsPanel — Mini pestaña desplegable en Home (debajo del header).
 */
import React, { useEffect, useState, useRef } from 'react';
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
import { chatDeMatchPorMascota } from '../services/matchApi';
import { resolveMascotaVisual } from '../constants/petImages';

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

  // Home pasa onMarcarTodasLeidas como arrow inline (cambia en cada render):
  // si el efecto dependiera de ella, el panel se recargaba solo a los pocos
  // segundos (marcar leídas → re-render de Home → callback nueva → efecto
  // re-disparado → spinner). Con el ref, el efecto depende SOLO de `visible`.
  const onMarcarTodasRef = useRef(onMarcarTodasLeidas);
  onMarcarTodasRef.current = onMarcarTodasLeidas;

  useEffect(() => {
    if (!visible) return;
    let cancelado = false;

    // Solo NO leídas: las que ya se marcaron leídas (con "Marcar todas" o al
    // tocarlas) no vuelven a aparecer al reabrir el panel. Sin auto-marcado al
    // abrir: las notificaciones persisten hasta que el usuario las marque.
    (async () => {
      setLoading(true);
      try {
        const data = await Promise.race([
          fetchNotificaciones(1, 20, true),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
        ]);
        if (!cancelado) setNotificaciones(data.notificaciones ?? []);
      } catch {
        if (!cancelado) setNotificaciones([]);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => { cancelado = true; };
  }, [visible]);

  const handleMarkAll = async () => {
    // Marcar todas como leídas = el panel queda vacío. Optimista: la lista
    // se limpia al toque aunque el backend tarde o falle.
    setNotificaciones([]);
    onMarcarTodasRef.current?.();
    try { await marcarTodasLeidas(); } catch { /* sin backend */ }
  };

  const handleTap = async (item) => {
    if (!item.leida) {
      try { await marcarNotificacionLeida(item.id); } catch { /* sin backend */ }
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, leida: true } : n)),
      );
    }
    // Con chatId va directo a la conversación (ej: el chat del match)
    if (item.dataExtra?.chatId) {
      onClose();
      onNavigate({
        screen: 'Chat',
        params: {
          chatId: item.dataExtra.chatId,
          nombre: item.dataExtra.nombre ?? 'Chat',
          fotoPerfilUrl: item.dataExtra.fotoPerfilUrl ?? null,
        },
      });
      return;
    }

    // Match sin DataExtra (notificación vieja): buscar el chat en el momento
    if (item.tipo === 'match' && item.mascota?.id) {
      try {
        const chat = await chatDeMatchPorMascota(item.mascota.id);
        if (chat) {
          onClose();
          onNavigate({ screen: 'Chat', params: chat });
          return;
        }
      } catch { /* cae a la pantalla genérica */ }
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
      {/* Mini imagen de la mascota a la que pertenece la notificación */}
      <View style={styles.avatarWrap}>
        {item.mascota ? (
          <Image source={resolveMascotaVisual(item.mascota)} style={styles.avatar} />
        ) : item.fotoUrl ? (
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
        {item.mascota && (
          <Text style={styles.mascotaNombre} numberOfLines={1}>🐾 {item.mascota.nombre}</Text>
        )}
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
  mascotaNombre: { fontSize: 11, fontWeight: '700', color: '#177046', marginTop: 2 },
  rightWrap: { alignItems: 'flex-end', gap: 4 },
  tiempo: { fontSize: 10, color: '#AAAAAA' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2DBD72' },
});
