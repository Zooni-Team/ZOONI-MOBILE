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
 * Si la base no responde o no tiene veterinarias cargadas, la pantalla lo dice
 * y ofrece Google Maps. Nunca muestra datos de ejemplo: alguien con una
 * urgencia real podría llamar a un número inventado.
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
  LINEAS_FALLBACK,
  distanciaM,
  fetchLineasEmergencia,
  fetchVeterinarias,
  formatearDistancia,
  horarioSemanal,
  logLlamadaSos,
  obtenerCoordenadas,
  textoHorario,
  urlBuscarEnMaps,
  urlComoLlegar,
} from '../services/sosApi';
import { alerta } from '../utils/dialogo';
import { colores } from '../theme';
import { normalizarBusqueda } from '../utils/texto';

// Ícono de cada tipo de línea de emergencia (emergency_lines.kind)
const ICONO_LINEA = {
  intoxicaciones: 'warning',
  zoonosis: 'paw',
  national_emergency: 'medkit',
};

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

  const colorEstado = horario.abierta === null ? colores.textoDeshabilitado
    : horario.abierta ? (horario.porCerrar ? colores.ambar : colores.verde)
    : colores.rojo;

  return (
    <View style={st.vetCard}>
      <View style={st.vetHead}>
        <Text style={st.vetNombre}>{vet.nombre}</Text>
        {vet.ratingAvg != null && (
          <View style={st.vetRating}>
            <Ionicons name="star" size={16} color={colores.amarillo} />
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
            <Ionicons name="navigate-outline" size={12} color={colores.textoSecundario} />
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
            <Ionicons name={verHorarios ? 'chevron-up' : 'chevron-down'} size={14} color={colores.textoSecundario} />
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
            <Ionicons name="time-outline" size={13} color={colores.verde} />
            <Text style={st.badge24Txt}>24 hs</Text>
          </View>
        )}
        {/* "Urgencias" sólo si atiende ahora: una cerrada con ese cartel confunde */}
        {vet.urgencias && horario.abierta !== false && (
          <View style={st.badgeUrgencias}>
            <Ionicons name="pulse" size={13} color={colores.rojo} />
            <Text style={st.badgeUrgenciasTxt}>Urgencias</Text>
          </View>
        )}
      </View>

      <View style={st.vetFooter}>
        <TouchableOpacity style={st.vetMapsBtn} onPress={() => abrirMaps(urlComoLlegar(vet))}
          accessibilityRole="button" accessibilityLabel={`Cómo llegar a ${vet.nombre}`}>
          <Ionicons name="map-outline" size={15} color={colores.texto} />
          <Text style={st.vetMapsTxt}>Cómo llegar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={st.vetLlamarBtn}
          onPress={() => llamar(vet.telefono, { clinicId: vet.id })}
          accessibilityRole="button"
          accessibilityLabel={`Llamar a ${vet.nombre}`}
        >
          <Ionicons name="call" size={15} color={colores.blanco} />
          <Text style={st.vetLlamarTxt}>{vet.telefono}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── ORDEN Y FILTROS ──────────────────────────────────────────────────────────

// "Recomendado" es el orden de urgencia de siempre (abiertas → cercanas →
// mejor valoradas). El resto ordena por un solo criterio; tocarlo de nuevo
// invierte el sentido.
const ORDENES = [
  { key: 'recomendado', label: 'Recomendado', icono: 'sparkles-outline' },
  { key: 'cercania',    label: 'Cercanía',    icono: 'navigate-outline' },
  { key: 'rating',      label: 'Rating',      icono: 'star-outline' },
  { key: 'resenas',     label: 'Más reseñas', icono: 'chatbubbles-outline' },
  { key: 'nombre',      label: 'Nombre',      icono: 'text-outline' },
];

const FILTROS_FIJOS = [
  { key: 'abiertas',  label: 'Abiertas ahora',  icono: 'time-outline',   test: (v) => textoHorario(v).abierta === true },
  { key: '24h',       label: '24 hs',           icono: 'moon-outline',   test: (v) => v.is24h },
  { key: 'urgencias', label: 'Urgencias',       icono: 'pulse',          test: (v) => v.urgencias },
  { key: 'rating4',   label: '4★ o más',        icono: 'star',           test: (v) => (v.ratingAvg ?? 0) >= 4 },
  { key: 'cerca3',    label: 'A menos de 3 km', icono: 'locate-outline', test: (v) => v.distanciaM != null && v.distanciaM <= 3000, requiereUbicacion: true },
];

const SERVICIO_LABEL = {
  internacion: 'Internación', cirugia: 'Cirugía', radiologia: 'Radiología', domicilio: 'A domicilio',
};
const etiquetaServicio = (k) => SERVICIO_LABEL[k] ?? (k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '));

// Comparadores en su sentido "natural": cercanía = más cerca primero,
// rating/reseñas = más alto primero, nombre = A→Z. Las que no tienen el dato
// (sin distancia, sin rating) van siempre al final.
function alFinal(x, y) {
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return null;
}

function comparar(orden, a, b) {
  switch (orden) {
    case 'cercania':
      return alFinal(a.distanciaM, b.distanciaM) ?? a.distanciaM - b.distanciaM;
    case 'rating':
      return alFinal(a.ratingAvg, b.ratingAvg)
        ?? ((b.ratingAvg - a.ratingAvg) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0));
    case 'resenas':
      return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
    case 'nombre':
      return a.nombre.localeCompare(b.nombre, 'es');
    default: {
      const abiertaA = textoHorario(a).abierta === true;
      const abiertaB = textoHorario(b).abierta === true;
      if (abiertaA !== abiertaB) return abiertaA ? -1 : 1;
      const d = alFinal(a.distanciaM, b.distanciaM);
      if (d === null && a.distanciaM !== b.distanciaM) return a.distanciaM - b.distanciaM;
      if (d) return d;
      return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
    }
  }
}

function ChipFiltro({ label, icono, activo, onPress }) {
  return (
    <TouchableOpacity
      style={[st.chip, activo && st.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={label}
    >
      {icono ? <Ionicons name={icono} size={14} color={activo ? colores.blanco : colores.texto} /> : null}
      <Text style={[st.chipTxt, activo && st.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
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
  const [errorCarga, setErrorCarga] = useState(false);
  const [orden, setOrden]           = useState('recomendado');
  const [invertido, setInvertido]   = useState(false);
  const [filtros, setFiltros]       = useState([]); // keys de FILTROS_FIJOS y 'srv:<servicio>'
  const [pidiendoUbicacion, setPidiendoUbicacion] = useState(false);

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
    setErrorCarga(clinicas === null);
    setVets(clinicas ?? []);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const onRefresh = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  // Servicios que existen en los datos (no se ofrece un filtro que siempre vacía la lista)
  const serviciosDisponibles = useMemo(() => {
    const set = new Set();
    vets.forEach((v) => (v.servicios ?? []).forEach((x) => set.add(x)));
    return [...set].sort((a, b) => etiquetaServicio(a).localeCompare(etiquetaServicio(b), 'es'));
  }, [vets]);

  const vetsFiltrados = useMemo(() => {
    const q = normalizarBusqueda(busqueda.trim());
    const conDistancia = vets.map((v) => ({
      ...v,
      distanciaM: coords ? distanciaM(coords.lat, coords.lng, v.lat, v.lng) : null,
    }));

    const filtrados = conDistancia.filter((v) => {
      if (q && ![v.nombre, v.direccion, v.barrio, ...(v.especialidades ?? [])]
        .some((campo) => normalizarBusqueda(campo).includes(q))) return false;
      // Los filtros se combinan: tiene que cumplir TODOS los activos
      return filtros.every((f) => {
        if (f.startsWith('srv:')) return (v.servicios ?? []).includes(f.slice(4));
        return FILTROS_FIJOS.find((x) => x.key === f)?.test(v) ?? true;
      });
    });

    const ordenados = [...filtrados].sort((a, b) => comparar(orden, a, b));
    // "Recomendado" no se invierte: es un orden de urgencia, no un criterio
    return invertido && orden !== 'recomendado' ? ordenados.reverse() : ordenados;
  }, [busqueda, vets, coords, orden, invertido, filtros]);

  // Ordenar o filtrar por cercanía sin ubicación: se pide en el momento (el
  // permiso pudo haberse rechazado o demorado al abrir la pantalla)
  const pedirUbicacion = useCallback(async () => {
    setPidiendoUbicacion(true);
    const c = await obtenerCoordenadas();
    setPidiendoUbicacion(false);
    if (c) setCoords(c);
    else alerta('No pudimos ver tu ubicación', 'Activá el permiso de ubicación para ordenar por cercanía.');
    return c;
  }, []);

  const elegirOrden = async (key) => {
    if (key === orden) {
      if (key !== 'recomendado') setInvertido((x) => !x); // tocar el activo invierte
      return;
    }
    if (key === 'cercania' && !coords && !(await pedirUbicacion())) return;
    setOrden(key);
    setInvertido(false);
  };

  const toggleFiltro = async (key, requiereUbicacion) => {
    const activo = filtros.includes(key);
    if (!activo && requiereUbicacion && !coords && !(await pedirUbicacion())) return;
    setFiltros((fs) => (activo ? fs.filter((f) => f !== key) : [...fs, key]));
  };

  const limpiar = () => {
    setFiltros([]);
    setOrden('recomendado');
    setInvertido(false);
    setBusqueda('');
  };

  const hayFiltros = filtros.length > 0 || orden !== 'recomendado' || busqueda.trim().length > 0;
  const textoSentido = {
    recomendado: coords ? 'Abiertas y más cercanas primero' : 'Abiertas primero',
    cercania: invertido ? 'Más lejanas primero' : 'Más cercanas primero',
    rating: invertido ? 'Peor valoradas primero' : 'Mejor valoradas primero',
    resenas: invertido ? 'Menos reseñas primero' : 'Más reseñas primero',
    nombre: invertido ? 'De la Z a la A' : 'De la A a la Z',
  }[orden];

  return (
    <SafeAreaView style={st.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header — solo la flecha de volver */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerBtn}
          accessibilityLabel="Volver" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colores.texto} />
        </TouchableOpacity>
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh}
            colors={[colores.rojo]} tintColor={colores.rojo} />
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
          <View style={st.lineasTituloFila}>
            <Ionicons name="call" size={18} color={colores.blanco} />
            <Text style={st.lineasTitulo}>Líneas de Emergencia</Text>
          </View>
          <Text style={st.lineasSubtitulo}>Para orientarte mientras vas a una veterinaria con guardia</Text>

          {lineas.map((linea) => (
            <TouchableOpacity key={`${linea.kind}-${linea.telefono}`} style={st.lineaBtn}
              onPress={() => llamar(linea.telefono, { lineId: linea.id })}
              accessibilityRole="button"
              accessibilityLabel={`Llamar a ${linea.label}, ${linea.telefono}`}>
              <Ionicons name={ICONO_LINEA[linea.kind] ?? 'call'} size={18} color={colores.rojo} />
              <View style={st.lineaTextos}>
                <Text style={st.lineaBtnTxt}>{linea.label}: {linea.telefono}</Text>
                {linea.horario ? <Text style={st.lineaHorario}>{linea.horario}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Buscador */}
        <View style={st.searchBox}>
          <Ionicons name="search" size={18} color={colores.textoDeshabilitado} />
          <TextInput
            style={st.searchInput}
            placeholder="Buscar veterinario por nombre, especialidad..."
            placeholderTextColor={colores.textoDeshabilitado}
            value={busqueda}
            onChangeText={setBusqueda}
            returnKeyType="search"
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda('')} accessibilityLabel="Limpiar búsqueda">
              <Ionicons name="close-circle" size={18} color={colores.textoDeshabilitado} />
            </TouchableOpacity>
          )}
        </View>

        {/* Ordenar */}
        <Text style={st.filtrosLabel}>Ordenar por</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chipsFila} keyboardShouldPersistTaps="handled">
          {ORDENES.map((o) => {
            const activo = orden === o.key;
            const conFlecha = activo && o.key !== 'recomendado';
            return (
              <TouchableOpacity key={o.key}
                style={[st.chip, activo && st.chipOn]}
                onPress={() => elegirOrden(o.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                accessibilityLabel={`Ordenar por ${o.label}${conFlecha ? '. Tocá de nuevo para invertir' : ''}`}>
                {pidiendoUbicacion && o.key === 'cercania'
                  ? <ActivityIndicator size="small" color={activo ? colores.blanco : colores.rojo} />
                  : <Ionicons name={o.icono} size={14} color={activo ? colores.blanco : colores.texto} />}
                <Text style={[st.chipTxt, activo && st.chipTxtOn]}>{o.label}</Text>
                {conFlecha && <Ionicons name={invertido ? 'arrow-up' : 'arrow-down'} size={13} color={colores.blanco} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filtros (se combinan entre sí) */}
        <Text style={st.filtrosLabel}>Filtrar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chipsFila} keyboardShouldPersistTaps="handled">
          {FILTROS_FIJOS.map((f) => (
            <ChipFiltro key={f.key} label={f.label} icono={f.icono}
              activo={filtros.includes(f.key)}
              onPress={() => toggleFiltro(f.key, f.requiereUbicacion)} />
          ))}
          {serviciosDisponibles.map((srv) => (
            <ChipFiltro key={srv} label={etiquetaServicio(srv)}
              activo={filtros.includes(`srv:${srv}`)}
              onPress={() => toggleFiltro(`srv:${srv}`)} />
          ))}
        </ScrollView>

        {/* Lista de veterinarias */}
        <View style={st.seccionFila}>
          <Text style={st.seccionTitulo}>
            Veterinarias{!cargando ? <Text style={st.seccionCuenta}> ({vetsFiltrados.length})</Text> : null}
          </Text>
          {hayFiltros ? (
            <TouchableOpacity onPress={limpiar} hitSlop={8} accessibilityLabel="Limpiar búsqueda, filtros y orden">
              <Text style={st.limpiarTxt}>Limpiar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={st.seccionSentido}>{textoSentido}</Text>

        {errorCarga && !cargando && (
          <View style={st.avisoDemo}>
            <Ionicons name="alert-circle-outline" size={14} color="#A05F00" />
            <Text style={st.avisoDemoTxt}>
              No pudimos cargar las veterinarias. Las líneas de emergencia de arriba funcionan igual.
            </Text>
          </View>
        )}

        {cargando ? (
          <ActivityIndicator color={colores.rojo} style={{ marginTop: 24 }} />
        ) : (
          vetsFiltrados.map((vet) => <VetCard key={vet.id} vet={vet} />)
        )}

        {!cargando && vetsFiltrados.length === 0 && (
          <View style={st.emptyBox}>
            <Ionicons name="search-outline" size={32} color={colores.textoDeshabilitado} />
            <Text style={st.emptyTxt}>
              {vets.length === 0
                ? 'Todavía no hay veterinarias verificadas en Zooni para tu zona. Buscá las de urgencia más cercanas en Google Maps.'
                : busqueda.trim()
                  ? `No encontramos veterinarias para "${busqueda.trim()}"`
                  : 'Ninguna veterinaria cumple todos los filtros'}
            </Text>
            {hayFiltros && (
              <TouchableOpacity onPress={limpiar} style={st.emptyBtn} accessibilityRole="button">
                <Text style={st.emptyBtnTxt}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Salida al mapa: la app lista las veterinarias cargadas en Zooni;
            para el resto, Google Maps ya sabe cuáles hay alrededor. */}
        <TouchableOpacity style={st.buscarMapsBtn} onPress={() => abrirMaps(urlBuscarEnMaps(coords))}
          accessibilityRole="button" accessibilityLabel="Buscar más veterinarias en Google Maps">
          <Ionicons name="map" size={16} color={colores.texto} />
          <Text style={st.buscarMapsTxt}>Buscar más veterinarias en Google Maps</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  lineasTituloFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  filtrosLabel: { fontSize: 12, fontWeight: '700', color: colores.textoSecundario, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipsFila: { gap: 8, paddingBottom: 10, paddingRight: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 14,
    borderRadius: 19, backgroundColor: colores.blanco, borderWidth: 1.5, borderColor: '#F3C9CD',
  },
  chipOn: { backgroundColor: colores.rojo, borderColor: colores.rojo },
  chipTxt: { fontSize: 13, fontWeight: '700', color: colores.texto },
  chipTxtOn: { color: colores.blanco },
  seccionCuenta: { fontSize: 15, fontWeight: '600', color: colores.textoSecundario },
  seccionSentido: { fontSize: 12, color: colores.textoSecundario, marginTop: -6, marginBottom: 10 },
  limpiarTxt: { fontSize: 14, fontWeight: '700', color: colores.rojo },
  emptyBtn: { marginTop: 12, borderRadius: 20, borderWidth: 1.5, borderColor: colores.rojo, paddingHorizontal: 16, paddingVertical: 8 },
  emptyBtnTxt: { fontSize: 14, fontWeight: '700', color: colores.rojo },
  safeArea: { flex: 1, backgroundColor: '#F7F7F7' },

  header: {
    height: 48, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, backgroundColor: 'transparent',
  },
  headerBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  bannerEmergencia: {
    backgroundColor: colores.rojo, borderRadius: 16, padding: 18, marginTop: 8,
    shadowColor: colores.rojo, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  bannerTitulo: { fontSize: 17, fontWeight: '800', color: colores.blanco, textAlign: 'center', marginBottom: 6 },
  bannerTexto:  { fontSize: 13, color: '#FFE0E3', textAlign: 'center', lineHeight: 19 },

  cardLineas: {
    backgroundColor: colores.rojo, borderRadius: 16, padding: 18, marginTop: 14,
    shadowColor: colores.rojo, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  lineasTitulo:    { fontSize: 16, fontWeight: '800', color: colores.blanco, textAlign: 'center' },
  lineasSubtitulo: { fontSize: 13, color: '#FFE0E3', textAlign: 'center', marginTop: 4, marginBottom: 14 },
  lineaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colores.blanco, borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 10,
  },
  lineaBtnTxt: { fontSize: 15, fontWeight: '700', color: colores.rojo, textAlign: 'center' },
  lineaTextos: { alignItems: 'center', flexShrink: 1 },
  lineaHorario: { fontSize: 12, color: colores.textoSecundario, marginTop: 1 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colores.blanco, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 4,
    marginTop: 20, borderWidth: 1, borderColor: '#EAEAEA',
  },
  searchInput: { flex: 1, fontSize: 14, color: colores.texto, paddingVertical: 10 },

  seccionFila:   { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  seccionTitulo: { fontSize: 18, fontWeight: '800', color: colores.texto },
  seccionSub:    { fontSize: 12, color: colores.textoDeshabilitado },

  avisoDemo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3E0', borderRadius: 12, padding: 10, marginBottom: 12,
  },
  avisoDemoTxt: { flex: 1, fontSize: 12, color: '#A05F00', lineHeight: 17 },

  vetCard: {
    backgroundColor: colores.blanco, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  vetHead:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  vetNombre:      { flex: 1, fontSize: 16, fontWeight: '800', color: colores.texto },
  vetRating:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vetRatingTxt:   { fontSize: 14, fontWeight: '700', color: colores.ambar },
  vetRatingCount: { fontSize: 11, color: colores.textoDeshabilitado },

  vetEstadoFila: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  puntoEstado:   { width: 7, height: 7, borderRadius: 4 },
  vetEstadoTxt:  { fontSize: 13, fontWeight: '700' },
  vetSep:        { fontSize: 13, color: '#CCCCCC' },
  vetDistancia:  { fontSize: 12, color: colores.textoSecundario, fontWeight: '600' },

  vetDato:      { fontSize: 13, color: colores.textoSecundario, lineHeight: 20, marginBottom: 2 },
  vetDatoLabel: { fontWeight: '700', color: colores.texto },

  verHorariosBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  verHorariosTxt: { fontSize: 12, fontWeight: '600', color: colores.textoSecundario },
  horariosBox:    { backgroundColor: '#F7F7F7', borderRadius: 10, padding: 10, marginTop: 8, gap: 3 },
  horarioFila:    { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  horarioDia:     { fontSize: 12, color: colores.textoSecundario, width: 78 },
  horarioRango:   { flex: 1, fontSize: 12, color: colores.textoSecundario, textAlign: 'right' },
  horarioHoy:     { color: colores.texto, fontWeight: '700' },

  vetBadges: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  badge24: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8F8EF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  badge24Txt: { fontSize: 12, fontWeight: '700', color: colores.verde },
  badgeUrgencias: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FDE7E9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeUrgenciasTxt: { fontSize: 12, fontWeight: '700', color: colores.rojo },

  vetFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  vetMapsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colores.gris150, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  vetMapsTxt: { fontSize: 13, fontWeight: '700', color: colores.texto },
  vetLlamarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto',
    backgroundColor: colores.rojo, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  vetLlamarTxt: { fontSize: 13, fontWeight: '700', color: colores.blanco },

  buscarMapsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colores.blanco, borderRadius: 24, paddingVertical: 13, marginTop: 8,
    borderWidth: 1.5, borderColor: '#EAEAEA',
  },
  buscarMapsTxt: { fontSize: 14, fontWeight: '700', color: colores.texto },

  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  emptyTxt: { fontSize: 14, color: colores.textoDeshabilitado, textAlign: 'center' },
});
