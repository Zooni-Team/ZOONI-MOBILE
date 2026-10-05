/**
 * PaseadorDrawer.jsx — Menú hamburguesa de Zooni Paseadores
 *
 * Mismo diseño que el menú lateral de la app de dueños (HamburgerDrawer):
 * panel blanco desde la izquierda, avatar con borde verde, ítem activo
 * resaltado en verde suave, "Cerrar sesión" en rojo al final.
 * Reemplaza al bottom nav: las secciones (Inicio, Solicitudes, Paseo,
 * Ganancias, Perfil) se eligen desde acá.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppDialog from '../AppDialog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);

export const SECCIONES_PASEADOR = [
  { key: 'inicio', label: 'Inicio', icono: 'home-outline' },
  { key: 'solicitudes', label: 'Solicitudes', icono: 'file-tray-full-outline' },
  { key: 'paseo', label: 'Paseo', icono: 'walk-outline' },
  { key: 'ganancias', label: 'Ganancias', icono: 'wallet-outline' },
  { key: 'pagos', label: 'Pagos', icono: 'card-outline' },
  { key: 'perfil', label: 'Perfil', icono: 'person-outline' },
];

function iniciales(nombre = '', apellido = '') {
  return ((nombre?.[0] ?? '') + (apellido?.[0] ?? '')).toUpperCase() || '?';
}

export default function PaseadorDrawer({
  visible, onClose, perfil, activo, onElegir, pendientes = 0, enCurso = false,
  chatsSinLeer = 0, onChats, onZona, onModoDueno, onSalir,
}) {
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: visible ? 0 : -DRAWER_WIDTH, duration: visible ? 250 : 200, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: visible ? 1 : 0, duration: visible ? 250 : 200, useNativeDriver: true }),
    ]).start();
  }, [visible]); // eslint-disable-line

  const elegir = (accion) => { onClose(); accion?.(); };

  const Item = ({ icono, label, activoItem, badge = 0, punto = false, onPress, rojo = false }) => (
    <TouchableOpacity style={[st.item, activoItem && st.itemActivo]} onPress={onPress}
      accessibilityLabel={badge > 0 ? `${label}, ${badge} sin ver` : label}
      accessibilityState={{ selected: activoItem }}>
      <Ionicons name={icono} size={22} color={rojo ? '#E63946' : activoItem ? '#2DBD72' : '#2C2C2C'} style={st.icono} />
      <Text style={[st.label, activoItem && st.labelActivo, rojo && st.labelRojo]}>{label}</Text>
      {punto && <View style={st.punto} />}
      {badge > 0 && (
        <View style={st.badge}><Text style={st.badgeTxt}>{badge > 99 ? '99+' : badge}</Text></View>
      )}
    </TouchableOpacity>
  );

  const nombre = perfil ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.root} pointerEvents="box-none">
        <Animated.View style={[st.overlay, { opacity: overlayOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[st.drawer, { transform: [{ translateX }] }]}>
          <View style={st.header}>
            {perfil?.foto
              ? <Image source={{ uri: perfil.foto }} style={st.avatar} />
              : <View style={st.avatarIni}><Text style={st.avatarIniTxt}>{iniciales(perfil?.nombre, perfil?.apellido)}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={st.nombre} numberOfLines={1}>{nombre || 'Paseador'}</Text>
              <Text style={st.sub} numberOfLines={1}>
                Zooni Paseadores · {perfil?.disponible ? 'Disponible' : 'No disponible'}
              </Text>
            </View>
          </View>
          <View style={st.divisor} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {SECCIONES_PASEADOR.map((sec) => (
              <Item key={sec.key} icono={sec.icono} label={sec.label} activoItem={activo === sec.key}
                badge={sec.key === 'solicitudes' ? pendientes : 0}
                punto={sec.key === 'paseo' && enCurso}
                onPress={() => elegir(() => onElegir(sec.key))} />
            ))}
            <View style={st.divisor} />
            <Item icono="chatbubbles-outline" label="Chats" badge={chatsSinLeer} onPress={() => elegir(onChats)} />
            <Item icono="map-outline" label="Zona de trabajo" onPress={() => elegir(onZona)} />
            {onModoDueno && (
              <Item icono="swap-horizontal-outline" label="Cambiar a modo dueño" onPress={() => elegir(onModoDueno)} />
            )}
            <View style={st.divisor} />
            <Item icono="log-out-outline" label="Cerrar sesión" rojo onPress={() => setConfirmarSalida(true)} />
          </ScrollView>
        </Animated.View>

        <AppDialog
          visible={confirmarSalida}
          titulo="¿Cerrar sesión?"
          mensaje="Vas a dejar de recibir solicitudes en este dispositivo."
          botones={[
            { texto: 'Cerrar sesión', estilo: 'destructive', onPress: () => { setConfirmarSalida(false); onClose(); onSalir(); } },
            { texto: 'Cancelar', estilo: 'ghost' },
          ]}
          onCerrar={() => setConfirmarSalida(false)}
        />
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_WIDTH, backgroundColor: '#FFFFFF',
    borderTopRightRadius: 20, borderBottomRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    paddingTop: 50,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#2DBD72' },
  avatarIni: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#C8F0D8',
    borderWidth: 2, borderColor: '#2DBD72', alignItems: 'center', justifyContent: 'center',
  },
  avatarIniTxt: { fontSize: 16, fontWeight: '700', color: '#27AE60' },
  nombre: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
  sub: { fontSize: 13, color: '#6B6B6B', marginTop: 2 },
  divisor: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 4 },
  item: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 20 },
  itemActivo: { backgroundColor: 'rgba(45, 189, 114, 0.12)' },
  icono: { marginRight: 14 },
  label: { flex: 1, fontSize: 15, color: '#2C2C2C' },
  labelActivo: { color: '#2DBD72', fontWeight: '700' },
  labelRojo: { color: '#E63946' },
  punto: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E63946' },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#F5A623',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8,
  },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: 20 },
});
