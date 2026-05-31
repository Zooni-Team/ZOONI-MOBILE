/**
 * HamburgerDrawer.jsx — Menú lateral deslizable (drawer)
 *
 * Se abre al tocar el ícono ☰ del header de la Home.
 * Se desliza desde la izquierda cubriendo el 80% de la pantalla.
 * El resto queda oscurecido con un overlay semitransparente.
 * Tocar el overlay cierra el menú.
 *
 * Props:
 *   visible      → boolean que controla si el drawer está abierto
 *   onClose      → función para cerrar el drawer
 *   usuario      → objeto { nombre, apellido, fotoPerfil } del usuario logueado
 *   mascotaActiva→ objeto { nombre, raza } de la mascota activa
 *   activeRoute  → nombre de la ruta actual (para resaltar el ítem activo)
 *
 * Animaciones:
 *   - translateX: el drawer se desliza desde -DRAWER_WIDTH hasta 0
 *   - overlayOpacity: el fondo oscuro aparece/desaparece con fade
 */

import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ScrollView, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { clearToken } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// El drawer ocupa el 80% del ancho, con un máximo de 320px
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);

// Lista de ítems del menú lateral
// isDivider: true → renderiza una línea separadora
// isLogout: true  → muestra en rojo y ejecuta el flujo de cierre de sesión
const MENU_ITEMS = [
  { key: 'inicio',        label: 'Inicio',                    icono: 'home-outline',               ruta: 'Home' },
  { key: 'comunidad',     label: 'Comunidad',                 icono: 'people-outline',              ruta: 'Comunidad' },
  { key: 'match',         label: 'Match',                     icono: 'paw-outline',                 ruta: 'Match' },
  { key: 'planificador',  label: 'Planificador de Servicios', icono: 'calendar-outline',            ruta: 'Planificador' },
  { key: 'ficha_medica',  label: 'Ficha Médica',              icono: 'medkit-outline',              ruta: 'FichaMedica' },
  { key: 'calendario',    label: 'Calendario',                icono: 'today-outline',               ruta: 'Calendario' },
  { key: 'eventos',       label: 'Eventos',                   icono: 'sparkles-outline',            ruta: 'Eventos' },
  { key: 'chatbot',       label: 'ChatBot',                   icono: 'chatbubble-ellipses-outline', ruta: 'ChatBot' },
  { key: 'closet',        label: 'Closet',                    icono: 'shirt-outline',               ruta: 'Closet' },
  { key: 'perfil',        label: 'Perfil',                    icono: 'person-outline',              ruta: 'Perfil' },
  { key: 'configuracion', label: 'Configuración',             icono: 'settings-outline',            ruta: 'Configuracion' },
  { key: 'divider', isDivider: true },
  { key: 'logout',        label: 'Cerrar sesión',             icono: 'log-out-outline',             isLogout: true },
];

export default function HamburgerDrawer({ visible, onClose, usuario, mascotaActiva, activeRoute }) {
  const navigation = useNavigation();

  // Posición horizontal del drawer (empieza fuera de pantalla a la izquierda)
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  // Opacidad del overlay oscuro
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Anima la apertura/cierre del drawer cuando cambia `visible`
  useEffect(() => {
    if (visible) {
      // Abrir: deslizar hacia adentro + oscurecer fondo
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      // Cerrar: deslizar hacia afuera + aclarar fondo
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  /**
   * handleNavigate — Cierra el drawer y navega a la pantalla del ítem tocado.
   * Caso especial: FichaMedica recibe el ID de la mascota activa como parámetro.
   */
  const handleNavigate = (item) => {
    onClose();
    if (item.ruta === 'FichaMedica' && mascotaActiva) {
      navigation.navigate('FichaMedica', { mascotaId: mascotaActiva.id });
    } else if (item.ruta) {
      navigation.navigate(item.ruta);
    }
  };

  /**
   * handleLogout — Muestra un diálogo de confirmación antes de cerrar sesión.
   * Si confirma: elimina el token JWT y redirige al Login.
   */
  const handleLogout = () => {
    Alert.alert(
      '¿Cerrar sesión?',
      '¿Seguro que querés salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, salir',
          style: 'destructive',
          onPress: async () => {
            onClose();
            await clearToken(); // Elimina el JWT del almacenamiento local
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]
    );
  };

  /**
   * getInitials — Genera las iniciales del usuario para el avatar fallback.
   * Ejemplo: "Sofía García" → "SG"
   */
  const getInitials = (nombre, apellido) => {
    return ((nombre?.[0] ?? '') + (apellido?.[0] ?? '')).toUpperCase() || '?';
  };

  // No renderiza nada si el drawer está cerrado (optimización de performance)
  if (!visible) return null;

  return (
    // absoluteFill: cubre toda la pantalla para capturar el toque en el overlay
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

      {/* Overlay oscuro — tocar cierra el drawer */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Panel del drawer */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>

        {/* Encabezado: avatar + nombre usuario + mascota activa */}
        <View style={styles.drawerHeader}>
          {usuario?.fotoPerfil ? (
            // Si tiene foto de perfil, mostrarla
            <Image source={{ uri: usuario.fotoPerfil }} style={styles.avatar} />
          ) : (
            // Si no tiene foto, mostrar iniciales sobre fondo verde
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
            {/* Muestra nombre y raza de la mascota activa si existe */}
            {mascotaActiva && (
              <Text style={styles.headerMascota} numberOfLines={1}>
                {mascotaActiva.nombre} · {mascotaActiva.raza}
              </Text>
            )}
          </View>
        </View>

        {/* Línea separadora entre header y lista de ítems */}
        <View style={styles.dividerLine} />

        {/* Lista scrolleable de ítems del menú */}
        <ScrollView showsVerticalScrollIndicator={false}>
          {MENU_ITEMS.map((item) => {
            // Renderiza separador visual
            if (item.isDivider) return <View key={item.key} style={styles.dividerLine} />;

            // Resalta el ítem de la pantalla actual
            const isActive = activeRoute === item.ruta;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => item.isLogout ? handleLogout() : handleNavigate(item)}
                accessibilityLabel={item.label}
              >
                <Ionicons
                  name={item.icono}
                  size={22}
                  // Rojo para logout, verde para activo, gris oscuro para el resto
                  color={item.isLogout ? '#E63946' : isActive ? '#2DBD72' : '#2C2C2C'}
                  style={styles.menuIcon}
                />
                <Text style={[
                  styles.menuLabel,
                  isActive && styles.menuLabelActive,
                  item.isLogout && styles.menuLabelLogout,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fondo oscuro semitransparente detrás del drawer
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_WIDTH, backgroundColor: '#FFFFFF',
    borderTopRightRadius: 20, borderBottomRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    paddingTop: 50, // Espacio para la status bar
  },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#2DBD72', marginRight: 12 },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#C8F0D8',
    borderWidth: 2, borderColor: '#2DBD72', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarInitials: { fontSize: 16, fontWeight: '700', color: '#27AE60' },
  headerInfo: { flex: 1 },
  headerNombre: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
  headerMascota: { fontSize: 13, color: '#6B6B6B', marginTop: 2 },
  dividerLine: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 20 },
  menuItemActive: { backgroundColor: 'rgba(45, 189, 114, 0.12)' }, // Verde suave para ítem activo
  menuIcon: { marginRight: 14 },
  menuLabel: { fontSize: 15, color: '#2C2C2C' },
  menuLabelActive: { color: '#2DBD72', fontWeight: '700' },
  menuLabelLogout: { color: '#E63946' }, // Rojo para cerrar sesión
});
