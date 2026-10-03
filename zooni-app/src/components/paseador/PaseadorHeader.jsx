/**
 * PaseadorHeader.jsx — AppBar de Zooni Paseadores
 *
 * Hamburguesa a la izquierda (igual que la app de dueños), y después lo único
 * que cambia: alineado a la izquierda (avatar + nombre o sección + estado de
 * trabajo) en vez de un título centrado. La
 * campana con badge ámbar queda a la derecha, igual que en Zooni.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Avatar, C, Chip, sombra } from './PaseadorUI';
import {
  contarNoLeidosPaseo, destinoNotificacionPaseador, fetchNotificacionesPaseador,
  marcarNotificacionesLeidas, marcarNotificacionPaseadorLeida,
} from '../../services/paseadorApi';
import { tiempoRelativoCorto } from '../../utils/tiempoRelativo';

export default function PaseadorHeader({
  perfil, subtitulo, mostrarEstado = true, titulo, onMenu, onChatsSinLeer, onIrASeccion,
}) {
  const navigation = useNavigation();
  const [notifs, setNotifs] = useState([]);
  const [chatsSinLeer, setChatsSinLeer] = useState(0);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([fetchNotificacionesPaseador(), contarNoLeidosPaseo('paseador')]);
      setNotifs(n);
      setChatsSinLeer(c);
      onChatsSinLeer?.(c);
    } catch {
      // sin red: los íconos quedan sin badge
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  const noLeidas = notifs.filter((n) => !n.leido).length;
  const nombre = perfil ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() : '';
  const primerNombre = perfil?.nombre?.split(' ')[0] || 'Paseador';

  const abrir = () => {
    setAbierto(true);
    if (noLeidas > 0) {
      marcarNotificacionesLeidas().catch(() => {});
      // se muestran como no leídas en esta apertura; al cerrar ya cuentan leídas
    }
  };
  const cerrar = () => {
    setAbierto(false);
    setNotifs((prev) => prev.map((n) => ({ ...n, leido: true })));
  };

  /**
   * Tocar una notificación la abre, igual que en el Home de dueños. Antes el
   * panel era solo una lista para mirar: te avisaba de una solicitud nueva y
   * después tenías que ir a buscarla a mano.
   */
  const tocar = async (item) => {
    if (!item.leido) {
      setNotifs((prev) => prev.map((n) => (n.id === item.id ? { ...n, leido: true } : n)));
      marcarNotificacionPaseadorLeida(item.id).catch(() => {});
    }
    setAbierto(false);

    const destino = destinoNotificacionPaseador(item);
    if (destino === 'chats') navigation.navigate('PaseadorChats');
    // Las secciones (solicitudes/inicio) son pestañas dentro de PaseadorApp, no
    // rutas propias: las cambia la pantalla contenedora.
    else onIrASeccion?.(destino);
  };

  return (
    <View style={s.header}>
      {onMenu ? (
        <TouchableOpacity onPress={onMenu} style={s.menu} accessibilityLabel="Abrir menú"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="menu" size={28} color="#0A0A0A" />
        </TouchableOpacity>
      ) : null}
      <Avatar uri={perfil?.foto} nombre={nombre} size={42} borde />
      <View style={s.textos}>
        <Text style={s.hola} numberOfLines={1}>{titulo ?? `Hola, ${primerNombre}`}</Text>
        {mostrarEstado && perfil ? (
          <Chip
            texto={perfil.disponible ? 'Disponible' : 'No disponible'}
            icono={perfil.disponible ? 'radio-button-on' : 'radio-button-off'}
            color={perfil.disponible ? C.teal : C.texto2}
            fondo={perfil.disponible ? C.menta : '#EFEFEF'}
            style={{ marginTop: 3 }}
          />
        ) : subtitulo ? (
          <Text style={s.sub}>{subtitulo}</Text>
        ) : null}
      </View>

      {/* El acceso a Chats vive SOLO en el menú (ya estaba ahí, con su badge).
          Tenerlo también acá, pegado a la campana, hacía que dos íconos casi
          iguales compitieran y se tocara el equivocado. Igual que en la app de
          dueños, en el header queda únicamente la campana. */}

      <TouchableOpacity onPress={abrir} style={s.campana} accessibilityLabel={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ''}`}>
        <Ionicons name="notifications-outline" size={26} color={C.texto} />
        {noLeidas > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{noLeidas > 9 ? '9+' : noLeidas}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={cerrar}>
        <Pressable style={s.overlay} onPress={cerrar}>
          <Pressable style={s.panel} onPress={() => {}}>
            <Text style={s.panelTitulo}>Notificaciones</Text>
            <FlatList
              data={notifs}
              keyExtractor={(n) => String(n.id)}
              ListEmptyComponent={<Text style={s.panelVacio}>No tenés notificaciones por ahora.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.notif} onPress={() => tocar(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.titulo}${item.leido ? '' : ', sin leer'}`}>
                  {!item.leido && <View style={s.punto} />}
                  <View style={{ flex: 1 }}>
                    <Text style={s.notifTitulo}>{item.titulo}</Text>
                    {item.mensaje ? <Text style={s.notifMsg}>{item.mensaje}</Text> : null}
                  </View>
                  <Text style={s.notifHora}>{tiempoRelativoCorto(item.fecha)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={C.gris} style={{ marginTop: 2 }} />
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14,
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  textos: { flex: 1 },
  menu: { width: 36, height: 44, justifyContent: 'center' },
  hola: { fontSize: 18, fontWeight: '800', color: C.texto },
  sub: { fontSize: 13, color: C.texto2, marginTop: 2 },
  campana: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: C.ambar, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeTxt: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', paddingTop: 70, paddingHorizontal: 14 },
  panel: { backgroundColor: C.card, borderRadius: 18, padding: 16, maxHeight: '70%', ...sombra },
  panelTitulo: { fontSize: 17, fontWeight: '800', color: C.texto, marginBottom: 8 },
  panelVacio: { fontSize: 14, color: C.texto2, paddingVertical: 16, textAlign: 'center' },
  notif: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F1F1',
  },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ambar, marginTop: 6 },
  notifTitulo: { fontSize: 14, fontWeight: '700', color: C.texto },
  notifMsg: { fontSize: 13, color: C.texto2, marginTop: 2 },
  notifHora: { fontSize: 12, color: C.gris },
});
