/**
 * PantallaSalud.jsx — Armazón de las pantallas de la Ficha Médica que listan
 * registros de una mascota (Vacunas y Tratamientos).
 *
 * Pone lo que era idéntico en las dos: flecha para volver, selector de
 * mascota, el hero con la ilustración, la hoja blanca con scroll y "tirar para
 * recargar", y el Toast. Cada pantalla pasa su contenido como hijos.
 */

import { useEffect, useRef } from 'react';
import {
  Animated, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import PetHero from '../PetHero';
import SelectorMascota from '../SelectorMascota';
import Toast from '../ui/Toast';
import { colores } from '../../theme';

const AREA_TOQUE = { top: 12, bottom: 12, left: 12, right: 12 };

/**
 * @param {string}   titulo        "Vacunas", "Tratamientos" (va en el hero)
 * @param {object}   mascota       la que muestra el hero
 * @param {boolean}  cargando      mientras carga, el hero todavía no entra
 * @param {object}   toast         lo que devuelve useToast()
 */
export default function PantallaSalud({
  titulo, mascota, petId, onCambiarMascota, cargando, refrescando, onRefrescar, toast, children,
}) {
  const navigation = useNavigation();
  const escala = useRef(new Animated.Value(0.88)).current;
  const opacidad = useRef(new Animated.Value(0)).current;

  // El hero entra cuando termina la primera carga.
  useEffect(() => {
    if (cargando) return;
    Animated.parallel([
      Animated.timing(escala, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(opacidad, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [cargando, escala, opacidad]);

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <Toast {...toast} />

      <View style={s.fondo}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}
            accessibilityRole="button" accessibilityLabel="Volver" hitSlop={AREA_TOQUE}>
            <Ionicons name="arrow-back" size={26} color={colores.texto} />
          </TouchableOpacity>
        </View>

        <SelectorMascota valor={petId} onCambiar={onCambiarMascota} style={s.selector} />

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContenido}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={(
            <RefreshControl refreshing={refrescando} onRefresh={onRefrescar}
              colors={[colores.verde]} tintColor={colores.verde} />
          )}>
          <PetHero mascota={mascota} titulo={titulo} anim={{ scale: escala, opacity: opacidad }} />
          <View style={s.hoja}>{children}</View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colores.menta },
  fondo: { flex: 1, width: '100%', backgroundColor: colores.menta },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  headerBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },
  selector: { marginBottom: 6 },
  scroll: { flex: 1 },
  scrollContenido: { flexGrow: 1 },
  hoja: {
    backgroundColor: colores.blanco,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40,
    minHeight: 400,
  },
});
