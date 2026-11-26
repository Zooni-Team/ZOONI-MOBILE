import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ScrollView, Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { clearToken } from '../services/api';
import {
  clearCurrentUserId, getCurrentUserId, modoNegocio, setModo, usoModoPaseador, MODO_PASEADOR,
} from '../config/session';
import { configNegocio } from '../constants/negocios';
import { contarMensajesNoLeidos } from '../services/chatStore';
import { fetchRolesCuenta } from '../services/paseadorApi';
import AppDialog from './AppDialog';
import { colores } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);

const MENU_ITEMS = [
  { key: 'inicio',        label: 'Inicio',                    icono: 'home-outline',               ruta: 'Home' },
  { key: 'comunidad',     label: 'Comunidad',                 icono: 'people-outline',              ruta: 'Comunidad' },
  { key: 'match',         label: 'Match',                     icono: 'paw-outline',                 ruta: 'Match' },
  { key: 'mensajes',      label: 'Mensajes',                  icono: 'chatbubbles-outline',         ruta: 'Mensajes' },
  { key: 'mis_paseos',    label: 'Mis paseos',                icono: 'walk-outline',                ruta: 'MisPaseos' },
  { key: 'mis_turnos',    label: 'Turnos y pedidos',          icono: 'receipt-outline',             ruta: 'MisTurnos' },
  { key: 'ficha_medica',  label: 'Ficha Médica',              icono: 'medkit-outline',              ruta: 'FichaMedica' },
  { key: 'calendario',    label: 'Calendario',                icono: 'today-outline',               ruta: 'Calendario' },
  { key: 'eventos',       label: 'Eventos',                   icono: 'sparkles-outline',            ruta: 'Eventos' },
  { key: 'chatbot',       label: 'ZooniVet',                  icono: 'chatbubble-ellipses-outline', ruta: 'ChatBot' },
  { key: 'closet',        label: 'Closet',                    icono: 'shirt-outline',               ruta: 'Closet' },
  { key: 'perfil',        label: 'Perfil',                    icono: 'person-outline',              ruta: 'Perfil' },
  { key: 'configuracion', label: 'Configuración',             icono: 'settings-outline',            ruta: 'Configuracion' },
  { key: 'divider', isDivider: true },
  { key: 'modo_paseador', label: 'Cambiar a modo paseador',   icono: 'swap-horizontal-outline',     soloPaseador: true },
  { key: 'logout',        label: 'Cerrar sesión',             icono: 'log-out-outline',             isLogout: true },
];

let rolesCache = { userId: null, roles: null, usoPaseador: false };

export default function HamburgerDrawer({ visible, onClose, usuario, mascotaActiva, activeRoute }) {
  const navigation = useNavigation();
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const cache = rolesCache.userId === getCurrentUserId() ? rolesCache : null;
  const [roles, setRoles] = useState(cache?.roles ?? null);
  const [usoPaseador, setUsoPaseador] = useState(cache?.usoPaseador ?? false);

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    contarMensajesNoLeidos().then(setMensajesNoLeidos).catch(() => {});
    const userId = getCurrentUserId();
    usoModoPaseador().then((uso) => {
      setUsoPaseador(uso);
      rolesCache = { ...rolesCache, userId, usoPaseador: uso };
    });
    fetchRolesCuenta().then((r) => {
      if (!r) return;
      setRoles(r);
      rolesCache = { ...rolesCache, userId, roles: r };
    }).catch(() => {});
  }, [visible]);

  const puedeSerPaseador = !!roles?.esPaseador || usoPaseador;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [overlayOpacity, translateX, visible]);

  const handleNavigate = (item) => {
    onClose();
    if (item.ruta === 'FichaMedica' && mascotaActiva) {
      navigation.navigate('FichaMedica', { mascotaId: mascotaActiva.id });
    } else if (item.ruta === 'Closet' && mascotaActiva) {
      navigation.navigate('Closet', { petId: mascotaActiva.id });
    } else if (item.ruta) {
      navigation.navigate(item.ruta);
    }
  };

  const modoPaseador = async () => {
    onClose();
    if (roles?.tienePerfil === false && !usoPaseador) {
      navigation.navigate('PaseadorRegistro', { completar: true });
      return;
    }
    await setModo(MODO_PASEADOR);
    navigation.reset({ index: 0, routes: [{ name: 'PaseadorApp' }] });
  };

  const irANegocio = async (tipo) => {
    onClose();
    await setModo(modoNegocio(tipo));
    navigation.reset({ index: 0, routes: [{ name: 'NegocioApp', params: { tipo } }] });
  };

  const handleLogout = () => setLogoutDialog(true);

  const salir = async () => {
    setLogoutDialog(false);
    onClose();
    await clearToken();
    await clearCurrentUserId();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const getInitials = (nombre, apellido) => {
    return ((nombre?.[0] ?? '') + (apellido?.[0] ?? '')).toUpperCase() || '?';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
    <View style={styles.modalRoot} pointerEvents="box-none">

      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>

        <View style={styles.drawerHeader}>
          {usuario?.fotoPerfil ? (
            <Image source={{ uri: usuario.fotoPerfil }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>
                {getInitials(usuario?.nombre, usuario?.apellido)}
              </Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerNombre} numberOfLines={1}>
              {usuario?.nombre ?? 'Usuario'}
            </Text>
            {mascotaActiva && (
              <Text style={styles.headerMascota} numberOfLines={1}>
                {mascotaActiva.nombre} · {mascotaActiva.raza}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.dividerLine} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {MENU_ITEMS.map((item) => {
            if (item.isDivider) return <View key={item.key} style={styles.dividerLine} />;
            if (item.isLogout && roles?.negocios?.length) {
              return [
                ...roles.negocios.map((n) => {
                  const cfgN = configNegocio(n.tipo);
                  return (
                    <TouchableOpacity key={`negocio-${n.id}`} style={styles.menuItem} onPress={() => irANegocio(n.tipo)}
                      accessibilityLabel={`Ir a ${n.nombre}`}>
                      <Ionicons name={`${cfgN.icono}-outline`} size={22} color={cfgN.color} style={styles.menuIcon} />
                      <Text style={styles.menuLabel} numberOfLines={1}>Ir a {n.nombre}</Text>
                    </TouchableOpacity>
                  );
                }),
                <TouchableOpacity key={item.key} style={styles.menuItem} onPress={handleLogout} accessibilityLabel={item.label}>
                  <Ionicons name={item.icono} size={22} color={colores.rojo} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, styles.menuLabelLogout]}>{item.label}</Text>
                </TouchableOpacity>,
              ];
            }
            if (item.soloPaseador && !puedeSerPaseador) return null;

            const isActive = activeRoute === item.ruta;
            const badge = item.key === 'mensajes' ? mensajesNoLeidos : 0;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => (item.isLogout ? handleLogout() : item.soloPaseador ? modoPaseador() : handleNavigate(item))}
                accessibilityLabel={badge > 0 ? `${item.label}, ${badge} mensajes sin leer` : item.label}
              >
                <Ionicons
                  name={item.icono}
                  size={22}
                  color={item.isLogout ? colores.rojo : isActive ? colores.verde : colores.texto}
                  style={styles.menuIcon}
                />
                <Text style={[
                  styles.menuLabel,
                  isActive && styles.menuLabelActive,
                  item.isLogout && styles.menuLabelLogout,
                ]}>
                  {item.label}
                </Text>
                {badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      <AppDialog
        visible={logoutDialog}
        titulo="¿Cerrar sesión?"
        mensaje="Vas a tener que volver a iniciar sesión para usar Zooni."
        botones={[
          { texto: 'Cerrar sesión', estilo: 'destructive', onPress: salir },
          { texto: 'Cancelar', estilo: 'ghost' },
        ]}
        onCerrar={() => setLogoutDialog(false)}
      />
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH, backgroundColor: colores.blanco,
    borderTopRightRadius: 20, borderBottomRightRadius: 20,
    shadowColor: colores.negro, shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    paddingTop: 50,
  },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colores.verde, marginRight: 12 },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colores.menta,
    borderWidth: 2, borderColor: colores.verde, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarInitials: { fontSize: 16, fontWeight: '700', color: colores.verdeExito },
  headerInfo: { flex: 1 },
  headerNombre: { fontSize: 16, fontWeight: '700', color: colores.texto },
  headerMascota: { fontSize: 13, color: colores.textoSecundario, marginTop: 2 },
  dividerLine: { height: 1, backgroundColor: colores.gris300, marginVertical: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 20 },
  menuItemActive: { backgroundColor: 'rgba(45, 189, 114, 0.12)' },
  menuIcon: { marginRight: 14 },
  menuLabel: { flex: 1, fontSize: 15, color: colores.texto },
  menuLabelActive: { color: colores.verde, fontWeight: '700' },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colores.rojo,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8,
  },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: colores.blanco, textAlign: 'center', lineHeight: 20 },
  menuLabelLogout: { color: colores.rojo },
});
