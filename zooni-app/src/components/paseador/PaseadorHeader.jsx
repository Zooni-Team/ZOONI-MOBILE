/**
 * PaseadorHeader.jsx — AppBar de Zooni Paseadores
 *
 * Único quiebre de patrón con la app de dueños: alineado a la izquierda
 * (avatar + nombre + estado de trabajo) en vez de un título centrado. La
 * campana con badge ámbar queda a la derecha, igual que en Zooni.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Chip, sombra } from './PaseadorUI';
import { fetchNotificacionesPaseador, marcarNotificacionesLeidas } from '../../services/paseadorApi';
import { tiempoRelativoCorto } from '../../utils/tiempoRelativo';

export default function PaseadorHeader({ perfil, subtitulo, mostrarEstado = true }) {
  const [notifs, setNotifs] = useState([]);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setNotifs(await fetchNotificacionesPaseador());
    } catch {
      // sin red: la campana queda sin badge
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

  return (
    <View style={s.header}>
      <Avatar uri={perfil?.foto} nombre={nombre} size={46} borde />
      <View style={s.textos}>
        <Text style={s.hola} numberOfLines={1}>Hola, {primerNombre} 👋</Text>
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
                <View style={s.notif}>
                  {!item.leido && <View style={s.punto} />}
                  <View style={{ flex: 1 }}>
                    <Text style={s.notifTitulo}>{item.titulo}</Text>
                    {item.mensaje ? <Text style={s.notifMsg}>{item.mensaje}</Text> : null}
                  </View>
                  <Text style={s.notifHora}>{tiempoRelativoCorto(item.fecha)}</Text>
                </View>
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
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  textos: { flex: 1 },
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
