/**
 * HomeScreen.jsx — Inicio del modo dueño: la mascota activa arriba y los
 * accesos a las secciones abajo, con el SOS Veterinario siempre a mano.
 *
 * Los datos los trae hooks/useHome. El hero animado es
 * components/home/HeroMascota y los botones, components/home/BotonesHome.
 */

import { useState } from 'react';
import {
  ImageBackground, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import AddButtonModal from '../components/AddButtonModal';
import HamburgerDrawer from '../components/HamburgerDrawer';
import NotificationsPanel from '../components/NotificationsPanel';
import BotonesHome from '../components/home/BotonesHome';
import HeroMascota from '../components/home/HeroMascota';
import AvisoError from '../components/salud/AvisoError';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import { useHome } from '../hooks/useHome';
import { colores, sombras } from '../theme';

// La campana manda nombres de pantalla ('Mensajes') o rutas viejas ('perfil/…').
const PANTALLA_DE_NOTIFICACION = {
  perfil: 'Perfil', match: 'Match', fichamedica: 'FichaMedica', comunidad: 'Comunidad', mensajes: 'Mensajes',
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const home = useHome();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const [editando, setEditando] = useState(false);
  const [agregando, setAgregando] = useState(false);

  const abrirSeccion = (clave, seccion) => {
    // Estas dos necesitan saber de qué mascota se trata.
    if (clave === 'ficha_medica' && home.mascota) navigation.navigate('FichaMedica', { mascotaId: home.mascota.id });
    else if (clave === 'closet' && home.mascota) navigation.navigate('Closet', { petId: home.mascota.id });
    else navigation.navigate(seccion.ruta);
  };

  const abrirNotificacion = (ruta) => {
    // Destino con parámetros ({ screen, params }): por ejemplo el chat de un match
    if (typeof ruta === 'object' && ruta?.screen) {
      navigation.navigate(ruta.screen, ruta.params);
      return;
    }
    const pantalla = PANTALLA_DE_NOTIFICACION[String(ruta ?? '').split('/')[0].toLowerCase()];
    if (pantalla) navigation.navigate(pantalla);
  };

  const guardarBotones = () => {
    setEditando(false);
    // Es una preferencia local: si no se pudo guardar, el orden vale igual
    // hasta cerrar la app.
    home.guardarBotones().catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground source={HOME_BACKGROUND} style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage} resizeMode="cover">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMenuAbierto(true)} style={styles.headerBtn}
            accessibilityRole="button" accessibilityLabel="Abrir menú">
            <Ionicons name="menu" size={30} color={colores.texto} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setNotificacionesAbiertas((v) => !v)} style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={home.sinLeer > 0 ? `Notificaciones, ${home.sinLeer} sin leer` : 'Notificaciones'}>
            <Ionicons name="notifications" size={30} color={colores.amarillo} />
            {home.sinLeer > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{home.sinLeer > 9 ? '9+' : home.sinLeer}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <NotificationsPanel
          visible={notificacionesAbiertas}
          onClose={() => setNotificacionesAbiertas(false)}
          onNavigate={abrirNotificacion}
          onMarcarTodasLeidas={home.marcarNotificacionesLeidas}
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false} scrollEnabled={!editando}
          refreshControl={(
            <RefreshControl refreshing={home.refrescando} onRefresh={home.refrescar}
              colors={[colores.verde]} tintColor={colores.verde} />
          )}>
          {home.error ? (
            <View style={styles.aviso}>
              <AvisoError mensaje="No pudimos actualizar tus datos." onReintentar={() => home.reintentar()} />
            </View>
          ) : null}

          <HeroMascota mascota={home.mascota} mascotas={home.mascotas} cargando={home.cargando}
            onElegirMascota={home.elegirMascota} onMostrarFoto={home.mostrarFoto} />

          <View style={styles.heroButtonsGap} />

          <BotonesHome botones={home.botonesVisibles} cargando={home.cargando} editMode={editando}
            onReordenar={home.reordenarBotones} onQuitar={home.quitarBoton} onGuardar={guardarBotones}
            onAbrir={abrirSeccion} onSos={() => navigation.navigate('SOS')} />
        </ScrollView>

        <View style={styles.fabContainer}>
          <TouchableOpacity style={[styles.fab, editando && styles.fabActive]} onPress={() => setEditando((v) => !v)}
            accessibilityRole="button" accessibilityState={{ selected: editando }}
            accessibilityLabel="Ordenar o quitar botones">
            <Ionicons name="grid-outline" size={22} color={colores.blanco} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={() => setAgregando(true)}
            accessibilityRole="button" accessibilityLabel="Agregar una sección">
            <Ionicons name="add" size={26} color={colores.blanco} />
          </TouchableOpacity>
        </View>
      </ImageBackground>

      <HamburgerDrawer visible={menuAbierto} onClose={() => setMenuAbierto(false)}
        usuario={home.usuario} mascotaActiva={home.mascota} activeRoute="Home" />
      <AddButtonModal visible={agregando} onClose={() => setAgregando(false)}
        botonesActivos={home.botones} onAdd={home.agregarBoton} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colores.mentaClara },
  screenBackground: { flex: 1, width: '100%' },
  screenBackgroundImage: { width: '100%', height: '100%' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20,
    zIndex: 10,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 4, right: 2,
    backgroundColor: colores.rojo, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: colores.blanco, fontSize: 9, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  aviso: { paddingHorizontal: 16, paddingTop: 8 },
  // FABs
  fabContainer: { position: 'absolute', bottom: 16, right: 16, flexDirection: 'row', gap: 10 },
  fab: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colores.verde,
    alignItems: 'center', justifyContent: 'center',
    ...sombras.tarjeta, shadowOpacity: 0.2, elevation: 6,
  },
  fabActive: { backgroundColor: colores.verdeExito },
});
