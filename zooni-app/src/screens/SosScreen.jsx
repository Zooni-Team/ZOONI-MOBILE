/**
 * SosScreen.jsx — Pantalla "S.O.S Veterinario" (emergencias)
 *
 * Basada en el diseño de Figma (Imagenes-Figma/SOS/SOS.png):
 *   · Banner rojo de emergencia
 *   · Líneas de emergencia con botones que abren el marcador (tel:)
 *   · Buscador + lista de veterinarios disponibles
 *
 * Los veterinarios son datos demo locales por ahora — cuando exista la tabla
 * en Supabase se reemplaza VETERINARIOS por un fetch sin tocar la UI.
 */

import { useMemo, useState } from 'react';
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// ─── DATOS DEMO ───────────────────────────────────────────────────────────────

const LINEA_VETERINARIA = '0800-123-4567';
const LINEA_EMERGENCIAS = '911';

const VETERINARIOS = [
  {
    id: 1,
    nombre: 'Clínica Veterinaria del Centro',
    especialidad: 'Medicina General y Emergencias 24hs',
    direccion: 'Av. Corrientes 1234, CABA',
    telefono: '011-4555-1234',
    rating: 4.8,
    abierto24hs: true,
  },
  {
    id: 2,
    nombre: 'Hospital Veterinario San Roque',
    especialidad: 'Cirugía y Traumatología',
    direccion: 'Av. Rivadavia 5678, CABA',
    telefono: '011-4666-5678',
    rating: 4.6,
    abierto24hs: true,
  },
  {
    id: 3,
    nombre: 'Veterinaria Patitas Felices',
    especialidad: 'Clínica General y Vacunación',
    direccion: 'Calle Belgrano 910, CABA',
    telefono: '011-4777-0910',
    rating: 4.5,
    abierto24hs: false,
  },
  {
    id: 4,
    nombre: 'Centro Veterinario Animalia',
    especialidad: 'Cardiología y Diagnóstico por Imágenes',
    direccion: 'Av. Cabildo 2345, CABA',
    telefono: '011-4888-2345',
    rating: 4.7,
    abierto24hs: false,
  },
];

// Abre el marcador del teléfono con el número listo para llamar.
function llamar(numero) {
  Linking.openURL(`tel:${numero.replace(/[^0-9+]/g, '')}`);
}

// ─── CARD DE VETERINARIO ──────────────────────────────────────────────────────

function VetCard({ vet }) {
  return (
    <View style={st.vetCard}>
      <View style={st.vetHead}>
        <Text style={st.vetNombre}>{vet.nombre}</Text>
        <View style={st.vetRating}>
          <Ionicons name="star" size={16} color="#F5C842" />
          <Text style={st.vetRatingTxt}>{vet.rating}</Text>
        </View>
      </View>

      <Text style={st.vetDato}>
        <Text style={st.vetDatoLabel}>Especialidad: </Text>{vet.especialidad}
      </Text>
      <Text style={st.vetDato}>
        <Text style={st.vetDatoLabel}>Dirección: </Text>{vet.direccion}
      </Text>

      <View style={st.vetFooter}>
        {vet.abierto24hs && (
          <View style={st.badge24}>
            <Ionicons name="time-outline" size={13} color="#2DBD72" />
            <Text style={st.badge24Txt}>Abierto 24hs</Text>
          </View>
        )}
        <TouchableOpacity
          style={st.vetLlamarBtn}
          onPress={() => llamar(vet.telefono)}
          accessibilityLabel={`Llamar a ${vet.nombre}`}
        >
          <Ionicons name="call" size={15} color="#FFF" />
          <Text style={st.vetLlamarTxt}>{vet.telefono}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SCREEN ───────────────────────────────────────────────────────────────────

export default function SosScreen() {
  const navigation = useNavigation();
  const [busqueda, setBusqueda] = useState('');

  const vetsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = !q
      ? VETERINARIOS
      : VETERINARIOS.filter(
          (v) =>
            v.nombre.toLowerCase().includes(q) ||
            v.especialidad.toLowerCase().includes(q) ||
            v.direccion.toLowerCase().includes(q)
        );
    // Mejor valorados primero
    return [...filtrados].sort((a, b) => b.rating - a.rating);
  }, [busqueda]);

  return (
    <SafeAreaView style={st.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header — solo la flecha de volver */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerBtn}
          accessibilityLabel="Volver" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
        </TouchableOpacity>
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Banner de emergencia */}
        <View style={st.bannerEmergencia}>
          <Text style={st.bannerTitulo}>Emergencia Veterinaria</Text>
          <Text style={st.bannerTexto}>
            Si tu mascota necesita atención urgente, contactá inmediatamente
          </Text>
        </View>

        {/* Líneas de emergencia */}
        <View style={st.cardLineas}>
          <Text style={st.lineasTitulo}>📞 Líneas de Emergencia</Text>
          <Text style={st.lineasSubtitulo}>Veterinarias de emergencia 24hs</Text>

          <TouchableOpacity style={st.lineaBtn} onPress={() => llamar(LINEA_VETERINARIA)}
            accessibilityLabel={`Llamar a la línea veterinaria ${LINEA_VETERINARIA}`}>
            <Ionicons name="call" size={18} color="#E63946" />
            <Text style={st.lineaBtnTxt}>Llamar: {LINEA_VETERINARIA}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={st.lineaBtn} onPress={() => llamar(LINEA_EMERGENCIAS)}
            accessibilityLabel="Llamar a emergencias 911">
            <Ionicons name="medkit" size={18} color="#E63946" />
            <Text style={st.lineaBtnTxt}>Emergencias: {LINEA_EMERGENCIAS}</Text>
          </TouchableOpacity>
        </View>

        {/* Buscador */}
        <View style={st.searchBox}>
          <Ionicons name="search" size={18} color="#9B9B9B" />
          <TextInput
            style={st.searchInput}
            placeholder="Buscar veterinario por nombre, especialidad..."
            placeholderTextColor="#9B9B9B"
            value={busqueda}
            onChangeText={setBusqueda}
            returnKeyType="search"
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda('')} accessibilityLabel="Limpiar búsqueda">
              <Ionicons name="close-circle" size={18} color="#9B9B9B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Lista de veterinarios */}
        <Text style={st.seccionTitulo}>Veterinarios Disponibles</Text>

        {vetsFiltrados.map((vet) => (
          <VetCard key={vet.id} vet={vet} />
        ))}

        {vetsFiltrados.length === 0 && (
          <View style={st.emptyBox}>
            <Ionicons name="search-outline" size={32} color="#9B9B9B" />
            <Text style={st.emptyTxt}>
              No encontramos veterinarios para "{busqueda.trim()}"
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F7F7' },

  header: {
    height: 48, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, backgroundColor: 'transparent',
  },
  headerBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  bannerEmergencia: {
    backgroundColor: '#E63946', borderRadius: 16, padding: 18, marginTop: 8,
    shadowColor: '#E63946', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  bannerTitulo: { fontSize: 17, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  bannerTexto:  { fontSize: 13, color: '#FFE0E3', textAlign: 'center', lineHeight: 19 },

  cardLineas: {
    backgroundColor: '#E63946', borderRadius: 16, padding: 18, marginTop: 14,
    shadowColor: '#E63946', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  lineasTitulo:    { fontSize: 16, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  lineasSubtitulo: { fontSize: 13, color: '#FFE0E3', textAlign: 'center', marginTop: 4, marginBottom: 14 },
  lineaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 24, paddingVertical: 12, marginBottom: 10,
  },
  lineaBtnTxt: { fontSize: 15, fontWeight: '700', color: '#E63946' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4,
    marginTop: 20, borderWidth: 1, borderColor: '#EAEAEA',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#2C2C2C', paddingVertical: 10 },

  seccionTitulo: { fontSize: 18, fontWeight: '800', color: '#2C2C2C', marginTop: 22, marginBottom: 12 },

  vetCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  vetHead:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  vetNombre:    { flex: 1, fontSize: 16, fontWeight: '800', color: '#2C2C2C' },
  vetRating:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vetRatingTxt: { fontSize: 14, fontWeight: '700', color: '#F5A623' },

  vetDato:      { fontSize: 13, color: '#6B6B6B', lineHeight: 20, marginBottom: 2 },
  vetDatoLabel: { fontWeight: '700', color: '#2C2C2C' },

  vetFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  badge24: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8F8EF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  badge24Txt: { fontSize: 12, fontWeight: '700', color: '#2DBD72' },
  vetLlamarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto',
    backgroundColor: '#E63946', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  vetLlamarTxt: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  emptyTxt: { fontSize: 14, color: '#9B9B9B', textAlign: 'center' },
});
