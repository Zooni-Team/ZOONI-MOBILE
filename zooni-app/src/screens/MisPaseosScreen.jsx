/**
 * MisPaseosScreen.jsx — Los paseos que pedí como dueño
 *
 * Estado en vivo de cada pedido (pendiente → aceptado → en curso →
 * finalizado), chat con el paseador, cancelar mientras no empezó y calificar
 * al terminar (esa calificación es la reseña que ve el paseador en su Perfil).
 * Mientras hay un paseo en curso se refresca solo cada 15 s.
 *
 * App de DUEÑOS: fondo menta, header centrado con hamburguesa.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, RefreshControl, SafeAreaView,
  StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import HamburgerDrawer from '../components/HamburgerDrawer';
import CalificarPaseoModal from '../components/resenas/CalificarPaseoModal';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import {
  cancelarPaseoDueno, cuandoDe, fetchMisPaseosDueno, formatoDistancia,
  formatoPlata, formatoTimer, segundosDePaseo,
} from '../services/paseadorApi';
import { confirmar } from '../utils/dialogo';

const VERDE = '#2DBD72';
const MENTA = '#C8F0D8';
const AMARILLO = '#F5C842';
const ROJO = '#E63946';
const AMBAR = '#F5A623';
const TEXTO = '#2C2C2C';
const TEXTO2 = '#6B6B6B';

const ESTADOS = {
  pendiente: { txt: 'Esperando respuesta', icono: 'hourglass-outline', color: AMBAR, fondo: '#FFF1DC' },
  aceptado: { txt: 'Aceptado', icono: 'checkmark-circle', color: VERDE, fondo: MENTA },
  en_curso: { txt: 'Paseando ahora', icono: 'walk', color: ROJO, fondo: '#FDECEE' },
  finalizado: { txt: 'Finalizado', icono: 'flag', color: TEXTO2, fondo: '#F1F1F1' },
  rechazado: { txt: 'Rechazado', icono: 'close-circle', color: ROJO, fondo: '#FDECEE' },
  cancelado: { txt: 'Cancelado', icono: 'ban', color: TEXTO2, fondo: '#F1F1F1' },
};

function Estrellas({ valor, onCambio, size = 30 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onCambio?.(i)} disabled={!onCambio} hitSlop={4}
          accessibilityLabel={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}>
          <Ionicons name={valor >= i ? 'star' : 'star-outline'} size={size} color={AMARILLO} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function MisPaseosScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { usuario, mascotaActiva } = useUsuarioActivo();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paseos, setPaseos] = useState(null);
  const [error, setError] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [aviso, setAviso] = useState(route.params?.enviada
    ? `¡Listo! Le enviamos tu solicitud a ${route.params.enviada}. Te avisamos cuando responda.` : null);
  const [calificando, setCalificando] = useState(null); // paseo
  const [, setTick] = useState(0);

  const cargar = useCallback(async () => {
    try {
      setPaseos(await fetchMisPaseosDueno());
      setError(null);
    } catch (err) {
      setPaseos((p) => p ?? []);
      setError(err?.message === 'migracion_pendiente'
        ? 'A la base de datos le falta Zooni Paseadores: es necesario correr las migraciones 035 y 038.'
        : 'No se pudieron cargar tus paseos. Deslizá hacia abajo para reintentar.');
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // En curso: refresco del estado cada 15 s y del timer cada segundo
  const hayEnCurso = !!paseos?.some((p) => p.estado === 'en_curso');
  useEffect(() => {
    if (!hayEnCurso) return undefined;
    const t1 = setInterval(cargar, 15000);
    const t2 = setInterval(() => setTick((x) => x + 1), 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [hayEnCurso, cargar]);

  useEffect(() => {
    if (!aviso) return undefined;
    navigation.setParams({ enviada: undefined });
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso, navigation]);

  const cancelar = async (p) => {
    const ok = await confirmar(`¿Cancelar el paseo de ${p.mascota.nombre}?`,
      'Le avisamos al paseador.', { textoOk: 'Cancelar paseo', textoCancelar: 'Volver', destructivo: true });
    if (!ok) return;
    try {
      await cancelarPaseoDueno(p);
      cargar();
    } catch {
      setError('No se pudo cancelar. Probá de nuevo.');
    }
  };

  const calificacionEnviada = ({ parcial }) => {
    setCalificando(null);
    setAviso(parcial
      ? '¡Gracias! Guardamos tus estrellas y tu opinión (las fotos y respuestas necesitan la migración 042).'
      : '¡Gracias! Tu reseña ayuda a otros dueños a elegir.');
    cargar();
  };

  const renderPaseo = ({ item: p }) => {
    const est = ESTADOS[p.estado] ?? ESTADOS.pendiente;
    const puedeCancelar = ['pendiente', 'aceptado'].includes(p.estado);
    const puedeChatear = ['pendiente', 'aceptado', 'en_curso', 'finalizado'].includes(p.estado);
    return (
      <View style={s.card}>
        <View style={[s.estado, { backgroundColor: est.fondo }]}>
          <Ionicons name={est.icono} size={14} color={est.color} />
          <Text style={[s.estadoTxt, { color: est.color }]}>{est.txt}</Text>
        </View>

        <View style={s.fila}>
          <Image source={p.mascota.visual} style={s.foto} />
          <View style={{ flex: 1 }}>
            <Text style={s.nombre}>{p.mascota.nombre} con {p.paseador?.nombre ?? 'paseador'}</Text>
            <Text style={s.sub}>{cuandoDe(p.fecha)} · {p.duracionMin} minutos</Text>
            {p.direccion ? <Text style={s.sub} numberOfLines={1}>{p.direccion}</Text> : null}
          </View>
          <Text style={s.precio}>{formatoPlata(p.precio)}</Text>
        </View>

        {p.estado === 'en_curso' && (
          <View style={s.vivo}>
            <View style={s.vivoPunto} />
            <Text style={s.vivoTxt}>
              {p.reanudadoEn ? 'Paseando' : 'En pausa'} · {formatoTimer(segundosDePaseo(p))} · {formatoDistancia(p.distanciaMetros)}
            </Text>
          </View>
        )}
        {p.estado === 'finalizado' && (
          <Text style={s.resumen}>
            Duró {Math.round((p.segundosAcumulados || 0) / 60)} minutos · {formatoDistancia(p.distanciaMetros)} recorridos
          </Text>
        )}
        {p.estado === 'finalizado' && p.rating != null && (
          <View style={{ marginTop: 8, alignItems: 'flex-start' }}>
            <Estrellas valor={p.rating} size={16} />
            {p.resena ? <Text style={s.resenaTxt}>“{p.resena}”</Text> : null}
          </View>
        )}

        <View style={s.acciones}>
          {puedeChatear && (
            <TouchableOpacity style={s.btnSec} onPress={() => navigation.navigate('PaseadorChat', { paseoId: p.id })}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={VERDE} />
              <Text style={s.btnSecTxt}>Chat</Text>
            </TouchableOpacity>
          )}
          {puedeCancelar && (
            <TouchableOpacity style={[s.btnSec, { borderColor: ROJO }]} onPress={() => cancelar(p)}>
              <Text style={[s.btnSecTxt, { color: ROJO }]}>Cancelar</Text>
            </TouchableOpacity>
          )}
          {p.estado === 'finalizado' && p.rating == null && (
            <TouchableOpacity style={s.btnPri} onPress={() => setCalificando(p)}>
              <Ionicons name="star" size={16} color={TEXTO} />
              <Text style={s.btnPriTxt}>Calificar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={MENTA} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} hitSlop={10} accessibilityLabel="Abrir menú">
          <Ionicons name="menu" size={28} color="#0A0A0A" />
        </TouchableOpacity>
        <Text style={s.titulo}>Mis paseos</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Comunidad')} hitSlop={10} accessibilityLabel="Buscar paseador">
          <Ionicons name="search" size={24} color={TEXTO} />
        </TouchableOpacity>
      </View>

      {aviso && (
        <View style={s.aviso}>
          <Ionicons name="checkmark-circle" size={18} color={VERDE} />
          <Text style={s.avisoTxt}>{aviso}</Text>
        </View>
      )}
      {error && <Text style={s.error}>{error}</Text>}

      {paseos === null ? (
        <ActivityIndicator color={VERDE} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={paseos}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderPaseo}
          contentContainerStyle={s.lista}
          refreshControl={<RefreshControl refreshing={refrescando} tintColor={VERDE}
            onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />}
          ListEmptyComponent={
            <View style={s.vacio}>
              <Ionicons name="walk-outline" size={44} color={VERDE} />
              <Text style={s.vacioTitulo}>Todavía no pediste paseos</Text>
              <Text style={s.vacioTxt}>Buscá paseadores de Zooni en el mapa de Comunidad: cada uno muestra su zona con un círculo.</Text>
              <TouchableOpacity style={[s.btnPri, { marginTop: 14, paddingHorizontal: 22 }]} onPress={() => navigation.navigate('Comunidad')}>
                <Text style={s.btnPriTxt}>Buscar paseador</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <CalificarPaseoModal
        visible={!!calificando}
        paseo={calificando}
        onCerrar={() => setCalificando(null)}
        onEnviado={calificacionEnviada}
      />

      <HamburgerDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)}
        usuario={usuario} mascotaActiva={mascotaActiva} activeRoute="MisPaseos" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: MENTA },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  titulo: { fontSize: 20, fontWeight: '800', color: VERDE },
  lista: { padding: 16, paddingBottom: 32, flexGrow: 1 },

  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4,
    backgroundColor: '#FFF', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: VERDE,
  },
  avisoTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: TEXTO },
  error: { marginHorizontal: 16, padding: 12, borderRadius: 12, backgroundColor: '#FDECEE', color: ROJO, fontSize: 13 },

  card: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  estado: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 12,
  },
  estadoTxt: { fontSize: 12, fontWeight: '800' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: 52, height: 52, borderRadius: 26, backgroundColor: MENTA },
  nombre: { fontSize: 16, fontWeight: '800', color: TEXTO },
  sub: { fontSize: 13, color: TEXTO2, marginTop: 2 },
  precio: { fontSize: 19, fontWeight: '900', color: TEXTO },

  vivo: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: '#FDECEE', borderRadius: 12, padding: 10,
  },
  vivoPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: ROJO },
  vivoTxt: { fontSize: 14, fontWeight: '800', color: TEXTO },
  resumen: { fontSize: 13, color: TEXTO2, marginTop: 10 },
  resenaTxt: { fontSize: 13, color: TEXTO, fontStyle: 'italic', marginTop: 4 },

  acciones: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  btnSec: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 2, borderColor: VERDE,
  },
  btnSecTxt: { fontSize: 14, fontWeight: '800', color: VERDE },
  btnPri: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40,
    paddingHorizontal: 16, borderRadius: 20, backgroundColor: AMARILLO,
  },
  btnPriTxt: { fontSize: 14, fontWeight: '800', color: TEXTO },

  vacio: { alignItems: 'center', marginTop: 50, paddingHorizontal: 30, gap: 6 },
  vacioTitulo: { fontSize: 17, fontWeight: '800', color: TEXTO, marginTop: 6 },
  vacioTxt: { fontSize: 14, color: TEXTO2, textAlign: 'center', lineHeight: 20 },

});
