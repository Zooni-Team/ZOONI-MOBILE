/**
 * CalendarioScreen.jsx — Calendario de Cuidados: los recordatorios de una
 * mascota (turnos, medicación, paseos, eventos sumados desde la agenda),
 * coloreados según cuánto falta.
 *
 * Se abre desde la Ficha Médica o el menú, con { petId } opcional. Los datos
 * los maneja hooks/useCalendario; las piezas están en components/calendario.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated, ImageBackground, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import HamburgerDrawer from '../components/HamburgerDrawer';
import SelectorMascota from '../components/SelectorMascota';
import FormularioRecordatorio from '../components/calendario/FormularioRecordatorio';
import RecordatorioCard, { RecordatorioCargando } from '../components/calendario/RecordatorioCard';
import RecordatorioDetalleModal from '../components/calendario/RecordatorioDetalleModal';
import Toast from '../components/ui/Toast';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import { useCalendario } from '../hooks/useCalendario';
import { useToast } from '../hooks/useToast';
import { colores, sombras } from '../theme';
import { confirmar } from '../utils/dialogo';

export default function CalendarioScreen() {
  const calendario = useCalendario();
  const { toast, mostrarToast } = useToast();
  const [menuAbierto, setMenuAbierto] = useState(false);
  // `formulario`: null (cerrado) · { recordatorio: null } (nuevo) · { recordatorio } (edición)
  const [formulario, setFormulario] = useState(null);
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [detalleVisible, setDetalleVisible] = useState(false);

  // El botón "+" aparece una vez, cuando termina la primera carga.
  const fabEscala = useRef(new Animated.Value(0.5)).current;
  const fabOpacidad = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (calendario.cargando) return;
    Animated.parallel([
      Animated.timing(fabEscala, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(fabOpacidad, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [calendario.cargando, fabEscala, fabOpacidad]);

  const abrirFormulario = (recordatorio = null) => {
    setFormulario({ recordatorio });
    setFormularioVisible(true);
  };

  // Si falla, el error lo muestra el propio formulario (queda abierto).
  async function guardar(datos, idMascota) {
    if (formulario.recordatorio) {
      await calendario.editar(formulario.recordatorio.id, datos);
      mostrarToast('Recordatorio actualizado', colores.verde);
    } else {
      await calendario.crear(datos, idMascota);
      mostrarToast('Recordatorio guardado', colores.verde);
    }
    setFormularioVisible(false);
  }

  async function eliminar(recordatorio) {
    const ok = await confirmar(`¿Eliminar "${recordatorio.titulo}"?`, 'Esta acción no se puede deshacer.',
      { textoOk: 'Eliminar', destructivo: true });
    if (!ok) return;
    try {
      await calendario.eliminar(recordatorio.id);
      mostrarToast('Recordatorio eliminado', colores.texto);
    } catch {
      mostrarToast('No se pudo eliminar. Probá de nuevo.', colores.rojo);
    }
  }

  const hayRecordatorios = calendario.recordatorios.length > 0;

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <Toast {...toast} />

      <ImageBackground source={HOME_BACKGROUND} style={s.screenBg} imageStyle={s.screenBgImage} resizeMode="cover">
        <View style={s.header}>
          <TouchableOpacity onPress={() => setMenuAbierto(true)} style={s.headerBtn}
            accessibilityRole="button" accessibilityLabel="Abrir menú">
            <Ionicons name="menu" size={30} color={colores.texto} />
          </TouchableOpacity>
        </View>

        <Text style={s.titulo} accessibilityRole="header">Calendario de Cuidados</Text>

        {/* Cada mascota tiene su calendario. Con una sola, no se muestra. */}
        <SelectorMascota mascotas={calendario.mascotas} valor={calendario.idMascota}
          onCambiar={calendario.elegirMascota} style={s.selector} />

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl refreshing={calendario.refrescando} onRefresh={calendario.refrescar}
              colors={[colores.verde]} tintColor={colores.verde} />
          )}>
          {calendario.cargando ? (
            <View><RecordatorioCargando /><RecordatorioCargando /></View>
          ) : !hayRecordatorios ? (
            <Text style={s.emptyTxt}>
              {calendario.idMascota
                ? 'Todavía no hay recordatorios.\nTocá + para anotar el primero.'
                : 'Sumá una mascota para empezar a usar el calendario.'}
            </Text>
          ) : (
            calendario.recordatorios.map((r, i) => (
              <RecordatorioCard key={r.id} evento={r} index={i}
                onEditar={abrirFormulario} onEliminar={() => eliminar(r)}
                onVerDetalle={(x) => { setDetalle(x); setDetalleVisible(true); }} />
            ))
          )}
        </ScrollView>

        {calendario.idMascota ? (
          <Animated.View style={[
            s.fab, hayRecordatorios ? s.fabCorner : s.fabCentro,
            { opacity: fabOpacidad, transform: [{ scale: fabEscala }] },
          ]}>
            <Pressable style={s.fabBtn} onPress={() => abrirFormulario()}
              accessibilityRole="button" accessibilityLabel="Nuevo recordatorio">
              <Ionicons name="add" size={28} color={colores.blanco} />
            </Pressable>
          </Animated.View>
        ) : null}
      </ImageBackground>

      <FormularioRecordatorio visible={formularioVisible} recordatorio={formulario?.recordatorio ?? null}
        mascotas={calendario.mascotas} idMascota={calendario.idMascota}
        onGuardar={guardar} onCerrar={() => setFormularioVisible(false)} />

      <RecordatorioDetalleModal visible={detalleVisible} evento={detalle} onCerrar={() => setDetalleVisible(false)} />

      <HamburgerDrawer visible={menuAbierto} onClose={() => setMenuAbierto(false)}
        usuario={calendario.usuario} mascotaActiva={calendario.mascotaActiva} activeRoute="Calendario" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colores.menta },
  screenBg: { flex: 1, width: '100%' },
  screenBgImage: { width: '100%', height: '100%' },
  scroll:   { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 100 },
  // Header
  header:    { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center' },
  selector: { marginBottom: 6 },
  titulo: { fontSize: 22, fontWeight: '800', color: colores.texto, textAlign: 'center', marginTop: 8, marginBottom: 20, paddingHorizontal: 20 },
  emptyTxt: { fontSize: 15, color: colores.textoSecundario, textAlign: 'center', marginTop: 60 },
  // FAB
  fab:       { position: 'absolute', width: 56, height: 56 },
  fabCentro: { alignSelf: 'center', top: '42%' },
  fabCorner: { bottom: 32, right: 20 },
  fabBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colores.verde, alignItems: 'center', justifyContent: 'center',
    ...sombras.tarjeta, shadowOpacity: 0.2, elevation: 6,
  },
});
