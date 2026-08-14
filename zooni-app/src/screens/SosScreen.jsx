/**
 * SosScreen.jsx — Pantalla "S.O.S Veterinario" (emergencias)
 *
 * Basada en el diseño de Figma (Imagenes-Figma/SOS/SOS.png):
 *   · Banner rojo de emergencia
 *   · Líneas de emergencia con botones que abren el marcador (tel:)
 *   · Buscador + lista de veterinarias con horario, distancia y ruta en Maps
 *
 * Los datos salen de Supabase (veterinary_clinics / emergency_lines, migración
 * 018) vía services/sosApi.js. Antes la pantalla tenía cuatro veterinarias
 * escritas a mano que ignoraban por completo lo que había en la base.
 * Si la base no responde se cae a DEMO_VETS: en una emergencia la pantalla
 * NUNCA puede quedar vacía.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
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

import {
  DEMO_VETS,
  LINEAS_FALLBACK,
  distanciaM,
  fetchLineasEmergencia,
  fetchVeterinarias,
  formatearDistancia,
  horarioSemanal,
  logLlamadaSos,
  normalizar,
  obtenerCoordenadas,
  textoHorario,
  urlBuscarEnMaps,
  urlComoLlegar,
} from '../services/sosApi';

// Abre el marcador del teléfono con el número listo para llamar.
function llamar(numero, { clinicId = null, lineId = null } = {}) {
  logLlamadaSos({ telefono: numero, clinicId, lineId }); // fire-and-forget
  Linking.openURL(`tel:${numero.replace(/[^0-9+]/g, '')}`);
}

function abrirMaps(url) {
  Linking.openURL(url).catch(() => {});
}

// ─── CARD DE VETERINARIA ──────────────────────────────────────────────────────

function VetCard({ vet }) {
  const [verHorarios, setVerHorarios] = useState(false);

  // La hora se evalúa en cada render de la lista: alcanza para una pantalla
  // que se abre puntualmente, sin un timer corriendo de fondo.
  const horario = textoHorario(vet);
  const semana  = horarioSemanal(vet);
  const distancia = formatearDistancia(vet.distanciaM);

  const colorEstado = horario.abierta === null ? '#9B9B9B'
    : horario.abierta ? (horario.porCerrar ? '#F5A623' : '#2DBD72')
    : '#E63946';

  return (
    <View style={st.vetCard}>
      <View style={st.vetHead}>
        <Text style={st.vetNombre}>{vet.nombre}</Text>
        {vet.ratingAvg != null && (
          <View style={st.vetRating}>
            <Ionicons name="star" size={16} color="#F5C842" />
            <Text style={st.vetRatingTxt}>{vet.ratingAvg}</Text>
            {vet.ratingCount > 0 && <Text style={st.vetRatingCount}>({vet.ratingCount})</Text>}
          </View>
        )}
      </View>

      {/* Estado horario — lo primero que se necesita saber en una urgencia */}
      <View style={st.vetEstadoFila}>
        <View style={[st.puntoEstado, { backgroundColor: colorEstado }]} />
        <Text style={[st.vetEstadoTxt, { color: colorEstado }]}>{horario.texto}</Text>
        {distancia && (
          <>
            <Text style={st.vetSep}>·</Text>
            <Ionicons name="navigate-outline" size={12} color="#6B6B6B" />
            <Text style={st.vetDistancia}>{distancia}</Text>
          </>
        )}
      </View>

      {vet.especialidades?.length > 0 && (
        <Text style={st.vetDato}>
          <Text style={st.vetDatoLabel}>Especialidad: </Text>{vet.especialidades.join(', ')}
        </Text>
      )}
      <Text style={st.vetDato}>
        <Text style={st.vetDatoLabel}>Dirección: </Text>
        {vet.direccion}{vet.barrio ? `, ${vet.barrio}` : ''}
      </Text>

      {/* Horario completo de la semana, plegado por defecto */}
      {semana.length > 0 && (
        <>
          <TouchableOpacity style={st.verHorariosBtn} onPress={() => setVerHorarios((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`${verHorarios ? 'Ocultar' : 'Ver'} horarios de ${vet.nombre}`}>
            <Ionicons name={verHorarios ? 'chevron-up' : 'chevron-down'} size={14} color="#6B6B6B" />
            <Text style={st.verHorariosTxt}>{verHorarios ? 'Ocultar horarios' : 'Ver horarios'}</Text>
          </TouchableOpacity>
          {verHorarios && (
            <View style={st.horariosBox}>
              {semana.map((d) => (
                <View key={d.dia} style={st.horarioFila}>
                  <Text style={[st.horarioDia, d.esHoy && st.horarioHoy]}>{d.dia}</Text>
                  <Text style={[st.horarioRango, d.esHoy && st.horarioHoy]}>{d.rangos}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View style={st.vetBadges}>
        {vet.is24h && (
          <View style={st.badge24}>
            <Ionicons name="time-outline" size={13} color="#2DBD72" />
            <Text style={st.badge24Txt}>24 hs</Text>
          </View>
        )}
        {vet.urgencias && (
          <View style={st.badgeUrgencias}>
            <Ionicons name="pulse" size={13} color="#E63946" />
            <Text style={st.badgeUrgenciasTxt}>Urgencias</Text>
          </View>
        )}
      </View>

      <View style={st.vetFooter}>
        <TouchableOpacity style={st.vetMapsBtn} onPress={() => abrirMaps(urlComoLlegar(vet))}
          accessibilityRole="button" accessibilityLabel={`Cómo llegar a ${vet.nombre}`}>
          <Ionicons name="map-outline" size={15} color="#2C2C2C" />
          <Text style={st.vetMapsTxt}>Cómo llegar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={st.vetLlamarBtn}
          onPress={() => llamar(vet.telefono, { clinicId: vet.id })}
          accessibilityRole="button"
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
  const [vets, setVets]       = useState([]);
  const [lineas, setLineas]   = useState(LINEAS_FALLBACK);
  const [coords, setCoords]   = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [usandoDemo, setUsandoDemo] = useState(false);

  const cargar = useCallback(async () => {
    // La ubicación se pide en paralelo y NO se espera para mostrar la lista:
    // si el permiso tarda o se rechaza, las veterinarias aparecen igual (sin
    // distancias). En una emergencia no se puede quedar esperando un permiso.
    obtenerCoordenadas().then(setCoords);

    const [clinicas, lineasEmergencia] = await Promise.all([
      fetchVeterinarias().catch(() => null),
      fetchLineasEmergencia().catch(() => LINEAS_FALLBACK),
    ]);
    setLineas(lineasEmergencia);
    setUsandoDemo(!clinicas?.length);
    setVets(clinicas?.length ? clinicas : DEMO_VETS);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const onRefresh = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  const vetsFiltrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const conDistancia = vets.map((v) => ({
      ...v,
      distanciaM: coords ? distanciaM(coords.lat, coords.lng, v.lat, v.lng) : null,
    }));

    const filtrados = !q
      ? conDistancia
      : conDistancia.filter((v) =>
          [v.nombre, v.direccion, v.barrio, ...(v.especialidades ?? [])]
            .some((campo) => normalizar(campo).includes(q))
        );

    // Orden de urgencia: primero las que están abiertas, después por cercanía
    // (si sabemos dónde estamos) y por último las mejor valoradas.
    return [...filtrados].sort((a, b) => {
      const abiertaA = textoHorario(a).abierta === true;
      const abiertaB = textoHorario(b).abierta === true;
      if (abiertaA !== abiertaB) return abiertaA ? -1 : 1;
      if (a.distanciaM != null && b.distanciaM != null) return a.distanciaM - b.distanciaM;
      if (a.distanciaM != null) return -1;
      if (b.distanciaM != null) return 1;
      return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
    });
  }, [busqueda, vets, coords]);

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
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh}
            colors={['#E63946']} tintColor="#E63946" />
        }>

        {/* Banner de emergencia */}
        <View style={st.bannerEmergencia}>
          <Text style={st.bannerTitulo}>Emergencia Veterinaria</Text>
          <Text style={st.bannerTexto}>
            Si tu mascota necesita atención urgente, contactá inmediatamente
          </Text>
        </View>

        {/* Líneas de emergencia (emergency_lines, con fallback local) */}
        <View style={st.cardLineas}>
          <Text style={st.lineasTitulo}>📞 Líneas de Emergencia</Text>
          <Text style={st.lineasSubtitulo}>Veterinarias de emergencia 24hs</Text>

          {lineas.map((linea) => (
            <TouchableOpacity key={`${linea.kind}-${linea.telefono}`} style={st.lineaBtn}
              onPress={() => llamar(linea.telefono, { lineId: linea.id })}
              accessibilityRole="button"
              accessibilityLabel={`Llamar a ${linea.label}, ${linea.telefono}`}>
              <Ionicons name={linea.kind === 'national_emergency' ? 'medkit' : 'call'}
                size={18} color="#E63946" />
              <Text style={st.lineaBtnTxt}>{linea.label}: {linea.telefono}</Text>
            </TouchableOpacity>
          ))}
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

        {/* Lista de veterinarias */}
        <View style={st.seccionFila}>
          <Text style={st.seccionTitulo}>Veterinarias Disponibles</Text>
          {coords && <Text style={st.seccionSub}>Más cercanas primero</Text>}
        </View>

        {usandoDemo && !cargando && (
          <View style={st.avisoDemo}>
            <Ionicons name="alert-circle-outline" size={14} color="#A05F00" />
            <Text style={st.avisoDemoTxt}>
              Sin conexión con la base: mostrando la lista de ejemplo. Los teléfonos funcionan igual.
            </Text>
          </View>
        )}

        {cargando ? (
          <ActivityIndicator color="#E63946" style={{ marginTop: 24 }} />
        ) : (
          vetsFiltrados.map((vet) => <VetCard key={vet.id} vet={vet} />)
        )}

        {!cargando && vetsFiltrados.length === 0 && (
          <View style={st.emptyBox}>
            <Ionicons name="search-outline" size={32} color="#9B9B9B" />
            <Text style={st.emptyTxt}>
              No encontramos veterinarias para "{busqueda.trim()}"
            </Text>
          </View>
        )}

        {/* Salida al mapa: la app lista las veterinarias cargadas en Zooni;
            para el resto, Google Maps ya sabe cuáles hay alrededor. */}
        <TouchableOpacity style={st.buscarMapsBtn} onPress={() => abrirMaps(urlBuscarEnMaps(coords))}
          accessibilityRole="button" accessibilityLabel="Buscar más veterinarias en Google Maps">
          <Ionicons name="map" size={16} color="#2C2C2C" />
          <Text style={st.buscarMapsTxt}>Buscar más veterinarias en Google Maps</Text>
        </TouchableOpacity>
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

  seccionFila:   { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  seccionTitulo: { fontSize: 18, fontWeight: '800', color: '#2C2C2C' },
  seccionSub:    { fontSize: 12, color: '#9B9B9B' },

  avisoDemo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3E0', borderRadius: 12, padding: 10, marginBottom: 12,
  },
  avisoDemoTxt: { flex: 1, fontSize: 12, color: '#A05F00', lineHeight: 17 },

  vetCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  vetHead:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  vetNombre:      { flex: 1, fontSize: 16, fontWeight: '800', color: '#2C2C2C' },
  vetRating:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vetRatingTxt:   { fontSize: 14, fontWeight: '700', color: '#F5A623' },
  vetRatingCount: { fontSize: 11, color: '#9B9B9B' },

  vetEstadoFila: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  puntoEstado:   { width: 7, height: 7, borderRadius: 4 },
  vetEstadoTxt:  { fontSize: 13, fontWeight: '700' },
  vetSep:        { fontSize: 13, color: '#CCCCCC' },
  vetDistancia:  { fontSize: 12, color: '#6B6B6B', fontWeight: '600' },

  vetDato:      { fontSize: 13, color: '#6B6B6B', lineHeight: 20, marginBottom: 2 },
  vetDatoLabel: { fontWeight: '700', color: '#2C2C2C' },

  verHorariosBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  verHorariosTxt: { fontSize: 12, fontWeight: '600', color: '#6B6B6B' },
  horariosBox:    { backgroundColor: '#F7F7F7', borderRadius: 10, padding: 10, marginTop: 8, gap: 3 },
  horarioFila:    { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  horarioDia:     { fontSize: 12, color: '#6B6B6B', width: 78 },
  horarioRango:   { flex: 1, fontSize: 12, color: '#6B6B6B', textAlign: 'right' },
  horarioHoy:     { color: '#2C2C2C', fontWeight: '700' },

  vetBadges: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  badge24: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8F8EF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  badge24Txt: { fontSize: 12, fontWeight: '700', color: '#2DBD72' },
  badgeUrgencias: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FDE7E9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeUrgenciasTxt: { fontSize: 12, fontWeight: '700', color: '#E63946' },

  vetFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  vetMapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0F0F0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  vetMapsTxt: { fontSize: 13, fontWeight: '700', color: '#2C2C2C' },
  vetLlamarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto',
    backgroundColor: '#E63946', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  vetLlamarTxt: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  buscarMapsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 24, paddingVertical: 13, marginTop: 8,
    borderWidth: 1.5, borderColor: '#EAEAEA',
  },
  buscarMapsTxt: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },

  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  emptyTxt: { fontSize: 14, color: '#9B9B9B', textAlign: 'center' },
});
