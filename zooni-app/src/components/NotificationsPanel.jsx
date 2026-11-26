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
import { fetchServiciosPorId } from '../services/comunidadApi';
import { resolveMascotaVisual } from '../constants/petImages';
import { colores } from '../theme';

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

  const onMarcarTodasRef = useRef(onMarcarTodasLeidas);
  onMarcarTodasRef.current = onMarcarTodasLeidas;

  useEffect(() => {
    if (!visible) return;
    let cancelado = false;

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
    setNotificaciones([]);
    onMarcarTodasRef.current?.();
    try { await marcarTodasLeidas(); } catch {  }
  };

  const handleTap = async (item) => {
    if (!item.leida) {
      try { await marcarNotificacionLeida(item.id); } catch {  }
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, leida: true } : n)),
      );
    }
    if (item.dataExtra?.chatId) {
      onClose();
      let chat = { chatId: item.dataExtra.chatId, nombre: 'Chat', fotoPerfilUrl: null };
      if (item.mascota?.id) {
        try {
          chat = (await chatDeMatchPorMascota(item.mascota.id)) ?? chat;
        } catch {  }
      }
      onNavigate({ screen: 'Chat', params: chat });
      return;
    }

    if (item.dataExtra?.servicioId) {
      onClose();
      const [servicio] = await fetchServiciosPorId([item.dataExtra.servicioId]).catch(() => []);
      onNavigate({
        screen: 'Chat',
        params: {
          servicioId: item.dataExtra.servicioId,
          nombre: servicio?.nombre ?? 'Chat',
          tipoServicio: servicio?.tipo ?? null,
        },
      });
      return;
    }

    if (item.tipo === 'turno' || item.tipo === 'pedido') {
      onClose();
      onNavigate({ screen: 'MisTurnos', params: { tab: item.tipo === 'pedido' ? 'pedidos' : 'turnos' } });
      return;
    }
    if (item.tipo === 'paseo' && !item.dataExtra?.destino) {
      onClose();
      onNavigate({ screen: 'MisPaseos' });
      return;
    }

    if (item.tipo === 'match' && item.mascota?.id) {
      try {
        const chat = await chatDeMatchPorMascota(item.mascota.id);
        if (chat) {
          onClose();
          onNavigate({ screen: 'Chat', params: chat });
          return;
        }
      } catch {  }
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
        {item.mascota ? (
          <Image source={resolveMascotaVisual(item.mascota)} style={styles.avatar} />
        ) : item.fotoUrl ? (
          <Image source={{ uri: item.fotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="paw" size={18} color={colores.verde} />
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
            <ActivityIndicator size="small" color={colores.verde} style={styles.loader} />
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
    shadowColor: colores.negro,
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
    backgroundColor: colores.blanco,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.texto,
  },
  dropdownBody: {
    backgroundColor: colores.blanco,
    minHeight: 72,
    maxHeight: 240,
    justifyContent: 'center',
  },
  loader: { paddingVertical: 24 },
  emptyText: {
    fontSize: 14,
    color: colores.textoGris,
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
    borderBottomColor: colores.gris100,
  },
  itemUnread: { backgroundColor: 'rgba(45, 189, 114, 0.08)' },
  avatarWrap: { marginRight: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    backgroundColor: colores.menta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, marginRight: 6 },
  titulo: { fontSize: 13, fontWeight: '700', color: colores.texto },
  cuerpo: { fontSize: 12, color: colores.textoSecundario, marginTop: 2 },
  mascotaNombre: { fontSize: 11, fontWeight: '700', color: colores.verdeOscuro, marginTop: 2 },
  rightWrap: { alignItems: 'flex-end', gap: 4 },
  tiempo: { fontSize: 10, color: colores.textoTenue },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colores.verde },
});
