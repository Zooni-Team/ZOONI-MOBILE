import { useCallback, useState } from 'react';
import {
  ImageBackground, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import HamburgerDrawer from '../components/HamburgerDrawer';
import SelectorMascota from '../components/SelectorMascota';
import EventoPublicoCard, { EventoPublicoCargando } from '../components/eventos/EventoPublicoCard';
import AvisoError from '../components/salud/AvisoError';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import { useEventosPublicos } from '../hooks/useEventosPublicos';
import { colores } from '../theme';
import { alerta } from '../utils/dialogo';

export default function EventosScreen() {
  const datos = useEventosPublicos();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [expandidos, setExpandidos] = useState(() => new Set());

  const alternarDescripcion = useCallback((id) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const { agregar } = datos;
  const agregarAlCalendario = useCallback(async (evento) => {
    try {
      await agregar(evento);
    } catch (e) {
      if (e.message === 'sin_mascota') {
        alerta('Primero sumá una mascota', 'Los eventos se guardan en el calendario de cada mascota.');
      } else {
        alerta('No se pudo agregar al calendario', 'Revisá tu conexión y probá de nuevo.');
      }
    }
  }, [agregar]);

  const refresco = (
    <RefreshControl refreshing={datos.refrescando} onRefresh={datos.refrescar}
      colors={[colores.verde]} tintColor={colores.verde} />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground source={HOME_BACKGROUND} style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage} resizeMode="cover">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMenuAbierto(true)} style={styles.headerBtn}
            accessibilityLabel="Abrir menú" accessibilityRole="button">
            <Ionicons name="menu" size={30} color={colores.texto} />
          </TouchableOpacity>
        </View>

        <View style={styles.tituloContainer}>
          <Text style={styles.titulo} accessibilityRole="header">🎉 Eventos</Text>
          {datos.mascotas.length > 1 && datos.mascota ? (
            <Text style={styles.subtitulo}>Se agregan al calendario de {datos.mascota.nombre}</Text>
          ) : null}
        </View>

        <SelectorMascota mascotas={datos.mascotas} valor={datos.idMascota}
          onCambiar={datos.elegirMascota} style={styles.selector} />

        {datos.cargando ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <EventoPublicoCargando />
            <EventoPublicoCargando />
          </ScrollView>
        ) : datos.error ? (
          <View style={styles.errorContainer}>
            <AvisoError mensaje="No pudimos cargar los eventos. Revisá tu conexión." onReintentar={datos.reintentar} />
          </View>
        ) : datos.eventos.length === 0 ? (
          <ScrollView contentContainerStyle={styles.emptyContainer} refreshControl={refresco}>
            <Ionicons name="calendar-outline" size={60} color={colores.textoTenue} />
            <Text style={styles.emptyTitulo}>No hay eventos por ahora</Text>
            <Text style={styles.emptySubtexto}>Cuando haya actividades cerca tuyo, las vas a ver acá 🐾</Text>
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}
            refreshControl={refresco}>
            {datos.eventos.map((evento) => (
              <EventoPublicoCard
                key={evento.id}
                evento={evento}
                yaAgregado={datos.agregados.has(evento.id)}
                expandido={expandidos.has(evento.id)}
                onToggleDescripcion={alternarDescripcion}
                onAgregarAlCalendario={agregarAlCalendario}
                procesando={datos.procesando.has(evento.id)}
              />
            ))}
          </ScrollView>
        )}
      </ImageBackground>

      <HamburgerDrawer
        visible={menuAbierto}
        onClose={() => setMenuAbierto(false)}
        usuario={datos.usuario}
        mascotaActiva={datos.mascotaActiva}
        activeRoute="Eventos"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colores.mentaClara },
  screenBackground: { flex: 1, width: '100%' },
  screenBackgroundImage: { width: '100%', height: '100%' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center' },
  selector: { marginBottom: 10 },
  errorContainer: { paddingHorizontal: 20 },
  tituloContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: colores.texto,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 14,
    fontWeight: '400',
    color: colores.textoSecundario,
    textAlign: 'center',
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: colores.texto,
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubtexto: {
    fontSize: 14,
    fontWeight: '400',
    color: colores.textoSecundario,
    textAlign: 'center',
    marginTop: 6,
  },
});
