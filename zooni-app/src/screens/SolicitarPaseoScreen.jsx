/**
 * SolicitarPaseoScreen.jsx — El dueño contrata a un paseador de Zooni
 *
 * Se llega desde Comunidad (círculo del paseador en el mapa o lista de
 * Servicios) con { paseadorId }. Elige mascota, día, hora, duración (con el
 * precio que puso el paseador), dirección y notas. La solicitud queda
 * 'pendiente' y le llega al paseador en su pestaña Solicitudes ("Para vos").
 *
 * App de DUEÑOS: fondo menta, header centrado, botones pill.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import FechaPicker from '../components/FechaPicker';
import HoraPicker from '../components/HoraPicker';
import { useMisMascotas } from '../hooks/useMisMascotas';
import { resolveMascotaVisual } from '../constants/petImages';
import {
  MEDIOS_PAGO, crearSolicitudPaseo, direccionDe, fetchPaseadorPublico, formatoDuracion, formatoPlata, precioPara,
  serviciosDe,
} from '../services/paseadorApi';

const VERDE = '#2DBD72';
const MENTA = '#C8F0D8';
const AMARILLO = '#F5C842';
const ROJO = '#E63946';
const TEXTO = '#2C2C2C';
const TEXTO2 = '#6B6B6B';

function proximaHoraRedonda() {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  return d;
}

const fechaTexto = (d) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const horaTexto = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function SolicitarPaseoScreen() {
  const navigation = useNavigation();
  const { paseadorId } = useRoute().params ?? {};
  const { mascotas, cargando: cargandoMascotas } = useMisMascotas();

  const [paseador, setPaseador] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [mascotaId, setMascotaId] = useState(null);
  const [fecha, setFecha] = useState(proximaHoraRedonda);
  const [duracion, setDuracion] = useState(null); // minutos de uno de sus servicios
  // Cómo le va a pagar al paseador: él lo ve en su sección Pagos
  const [medioPago, setMedioPago] = useState(null);
  const [direccion, setDireccion] = useState('');
  const [coords, setCoords] = useState(null);
  const [notas, setNotas] = useState('');
  const [picker, setPicker] = useState(null); // 'fecha' | 'hora'
  const [ubicando, setUbicando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Candado sincrónico: dos toques rápidos llegan antes de que `enviando`
  // deshabilite el botón, y cada uno creaba una solicitud.
  const enviandoRef = useRef(false);
  const [errores, setErrores] = useState([]);
  const [errorGeneral, setErrorGeneral] = useState(null);

  useEffect(() => {
    fetchPaseadorPublico(paseadorId)
      .then((p) => {
        setPaseador(p);
        // El primer paseo que ofrece (el más corto) queda elegido de entrada
        setDuracion(serviciosDe(p)[0]?.minutos ?? null);
      })
      .catch(() => setPaseador(null))
      .finally(() => setCargando(false));
  }, [paseadorId]);

  // Primera mascota (la principal) elegida por defecto
  useEffect(() => {
    if (!mascotaId && mascotas.length) {
      setMascotaId((mascotas.find((m) => m.esPrincipal) ?? mascotas[0]).id);
    }
  }, [mascotas, mascotaId]);

  const mascota = mascotas.find((m) => m.id === mascotaId) ?? null;
  const servicios = serviciosDe(paseador);
  const precio = paseador ? (precioPara(paseador, duracion) ?? 0) : 0;

  const usarUbicacion = () => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null;
    if (!geo) return;
    setUbicando(true);
    geo.getCurrentPosition(async (p) => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude };
      setCoords(c);
      const dir = await direccionDe(c.lat, c.lng);
      if (dir) setDireccion(dir);
      setUbicando(false);
    }, () => setUbicando(false), { enableHighAccuracy: true, timeout: 10000 });
  };

  const enviar = async () => {
    if (enviandoRef.current) return;
    const faltan = [];
    if (!mascota) faltan.push('Es necesario elegir qué mascota va a pasear');
    if (precioPara(paseador, duracion) == null) faltan.push('Es necesario elegir cuánto tiempo dura el paseo');
    if (!medioPago) faltan.push('Es necesario elegir cómo le vas a pagar');
    if (fecha.getTime() < Date.now() + 15 * 60 * 1000) faltan.push('Es necesario elegir un horario de al menos 15 minutos desde ahora');
    if (direccion.trim().length < 5) faltan.push('Es necesario la dirección donde el paseador busca a tu mascota');
    setErrores(faltan);
    setErrorGeneral(null);
    if (faltan.length) return;

    enviandoRef.current = true;
    setEnviando(true);
    try {
      await crearSolicitudPaseo({
        paseador, mascota, fecha, duracionMin: duracion, direccion, medioPago,
        lat: coords?.lat ?? paseador.lat, lng: coords?.lng ?? paseador.lng, notas,
      });
      navigation.replace('MisPaseos', { enviada: paseador.nombreCompleto });
    } catch (err) {
      console.error('[Solicitar paseo]', err?.message, err?.detalle ?? err);
      setErrorGeneral(err?.message === 'migracion_pendiente'
        ? `A la base de datos le falta Zooni Paseadores: es necesario correr las migraciones 035 y 038.${err?.detalle ? `\n\nDetalle: ${err.detalle}` : ''}`
        : `No se pudo enviar la solicitud.${err?.detalle ? `\n\nDetalle: ${err.detalle}` : ''}`);
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  if (cargando) {
    return <View style={[s.safe, s.centro]}><ActivityIndicator size="large" color={VERDE} /></View>;
  }
  if (!paseador) {
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <Ionicons name="alert-circle-outline" size={40} color={TEXTO2} />
        <Text style={s.vacioTxt}>Este paseador ya no está disponible.</Text>
        <TouchableOpacity style={[s.btn, { alignSelf: 'stretch', marginHorizontal: 24 }]} onPress={() => navigation.goBack()}>
          <Text style={s.btnTxt}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={MENTA} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={TEXTO} />
        </TouchableOpacity>
        <Text style={s.titulo}>Pedir un paseo</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Paseador */}
          <View style={s.card}>
            <View style={s.paseadorFila}>
              {paseador.foto
                ? <Image source={{ uri: paseador.foto }} style={s.avatar} />
                : <View style={[s.avatar, s.avatarIni]}><Ionicons name="walk" size={26} color={VERDE} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.paseadorNombre}>{paseador.nombreCompleto}</Text>
                <Text style={s.paseadorSub}>
                  {paseador.zona} · {paseador.radioKm} km
                  {paseador.rating ? ` · ★ ${paseador.rating.toFixed(1).replace('.', ',')}` : ''}
                </Text>
                <Text style={s.paseadorSub}>{paseador.paseos} {paseador.paseos === 1 ? 'paseo hecho' : 'paseos hechos'} · hasta {paseador.maxPerros} perros</Text>
              </View>
            </View>
            {paseador.bio ? <Text style={s.bio}>{paseador.bio}</Text> : null}
          </View>

          {/* Mascota */}
          <Text style={s.label}>¿Quién sale a pasear?</Text>
          {cargandoMascotas ? <ActivityIndicator color={VERDE} /> : mascotas.length === 0 ? (
            <Text style={s.ayuda}>No tenés mascotas cargadas. Agregá una desde Mis Mascotas.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {mascotas.map((m) => {
                const on = m.id === mascotaId;
                return (
                  <TouchableOpacity key={m.id} style={[s.mascota, on && s.mascotaOn]} onPress={() => setMascotaId(m.id)}
                    accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <Image source={resolveMascotaVisual(m)} style={s.mascotaFoto} />
                    <Text style={[s.mascotaNombre, on && { color: '#FFF' }]} numberOfLines={1}>{m.nombre}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Cuándo */}
          <Text style={s.label}>¿Cuándo?</Text>
          <View style={s.fila}>
            <TouchableOpacity style={[s.campo, { flex: 1.6 }]} onPress={() => setPicker('fecha')}>
              <Ionicons name="calendar-outline" size={18} color={VERDE} />
              <Text style={s.campoTxt} numberOfLines={1}>{fechaTexto(fecha)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.campo, { flex: 1 }]} onPress={() => setPicker('hora')}>
              <Ionicons name="time-outline" size={18} color={VERDE} />
              <Text style={s.campoTxt}>{horaTexto(fecha)}</Text>
            </TouchableOpacity>
          </View>

          {/* Duración y precio */}
          <Text style={s.label}>¿Cuánto tiempo?</Text>
          <View style={[s.fila, { flexWrap: 'wrap' }]}>
            {servicios.map(({ minutos, precio: p }) => {
              const on = duracion === minutos;
              return (
                <TouchableOpacity key={minutos} style={[s.duracion, on && s.duracionOn]} onPress={() => setDuracion(minutos)}
                  accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[s.duracionTxt, on && { color: '#FFF' }]}>{formatoDuracion(minutos)}</Text>
                  <Text style={[s.duracionPrecio, on && { color: '#FFF' }]}>{formatoPlata(p)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Dónde */}
          {/* Medio de pago */}
          <Text style={s.label}>¿Cómo le vas a pagar?</Text>
          <View style={s.medios}>
            {MEDIOS_PAGO.map((m) => {
              const on = medioPago === m.key;
              return (
                <TouchableOpacity key={m.key} style={[s.medio, on && s.medioOn]} onPress={() => setMedioPago(m.key)}
                  accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Ionicons name={m.icono} size={16} color={on ? '#FFF' : VERDE} />
                  <Text style={[s.medioTxt, on && { color: '#FFF' }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.medioAyuda}>Le pagás directo al paseador: este dato es para que sepa cómo vas a hacerlo.</Text>

          <Text style={s.label}>¿Dónde lo busca?</Text>
          <View style={s.inputFila}>
            <TextInput style={s.inputFlex} value={direccion} onChangeText={(v) => { setDireccion(v.slice(0, 200)); setCoords(null); }}
              placeholder="Calle, número y piso/depto" placeholderTextColor="#AAAAAA" />
            <TouchableOpacity onPress={usarUbicacion} hitSlop={8} accessibilityLabel="Usar mi ubicación">
              {ubicando ? <ActivityIndicator size="small" color={VERDE} /> : <Ionicons name="locate" size={22} color={VERDE} />}
            </TouchableOpacity>
          </View>

          {/* Notas */}
          <Text style={s.label}>Notas para el paseador (opcional)</Text>
          <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} value={notas} onChangeText={setNotas}
            multiline maxLength={500} placeholderTextColor="#AAAAAA"
            placeholder="Ej: tira un poco de la correa, las llaves están con el portero." />

          {errores.length > 0 && (
            <View style={s.errores}>
              <Text style={s.erroresTitulo}>Para enviar la solicitud es necesario:</Text>
              {errores.map((e) => <Text key={e} style={s.errorItem}>• {e.replace(/^Es necesario /, '')}</Text>)}
            </View>
          )}
          {errorGeneral && <Text style={s.errorGeneral}>{errorGeneral}</Text>}

          <TouchableOpacity style={[s.btn, enviando && { opacity: 0.6 }]} onPress={enviar} disabled={enviando} activeOpacity={0.85}>
            {enviando ? <ActivityIndicator color={TEXTO} /> : (
              <Text style={s.btnTxt}>Enviar solicitud · {formatoPlata(precio)}</Text>
            )}
          </TouchableOpacity>
          <Text style={s.pie}>El pago se coordina con el paseador. Te avisamos cuando acepte.</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <FechaPicker
        visible={picker === 'fecha'}
        titulo="Día del paseo"
        valor={fecha}
        aniosAtras={0}
        aniosAdelante={1}
        onCancelar={() => setPicker(null)}
        onConfirmar={(d) => {
          const nueva = new Date(fecha);
          nueva.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
          setFecha(nueva);
          setPicker(null);
        }}
      />
      <HoraPicker
        visible={picker === 'hora'}
        titulo="Hora del paseo"
        valor={fecha}
        onCancelar={() => setPicker(null)}
        onConfirmar={(d) => {
          const nueva = new Date(fecha);
          nueva.setHours(d.getHours(), d.getMinutes(), 0, 0);
          setFecha(nueva);
          setPicker(null);
        }}
      />
    </SafeAreaView>
  );
}

const sombra = {
  shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: MENTA },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  titulo: { fontSize: 20, fontWeight: '800', color: VERDE },
  scroll: { padding: 20, paddingTop: 4, paddingBottom: 40 },

  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, ...sombra },
  paseadorFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, borderColor: VERDE },
  avatarIni: { backgroundColor: MENTA, alignItems: 'center', justifyContent: 'center' },
  paseadorNombre: { fontSize: 18, fontWeight: '800', color: TEXTO },
  paseadorSub: { fontSize: 13, color: TEXTO2, marginTop: 2 },
  bio: { fontSize: 14, color: TEXTO, marginTop: 12, lineHeight: 20 },

  label: { fontSize: 15, fontWeight: '800', color: TEXTO, marginTop: 22, marginBottom: 10 },
  ayuda: { fontSize: 13, color: TEXTO2 },
  fila: { flexDirection: 'row', gap: 10 },

  mascota: {
    alignItems: 'center', width: 86, paddingVertical: 10, borderRadius: 18,
    backgroundColor: '#FFF', borderWidth: 2, borderColor: '#FFF',
  },
  mascotaOn: { backgroundColor: VERDE, borderColor: VERDE },
  mascotaFoto: { width: 52, height: 52, borderRadius: 26, backgroundColor: MENTA },
  mascotaNombre: { fontSize: 13, fontWeight: '800', color: TEXTO, marginTop: 6, maxWidth: 74 },

  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF',
    borderRadius: 16, paddingHorizontal: 14, height: 52,
  },
  campoTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: TEXTO },

  duracion: { flexGrow: 1, flexBasis: '40%', backgroundColor: '#FFF', borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  duracionOn: { backgroundColor: VERDE },
  duracionTxt: { fontSize: 14, fontWeight: '700', color: TEXTO2 },
  duracionPrecio: { fontSize: 22, fontWeight: '900', color: TEXTO, marginTop: 2 },
  medios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  medio: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  medioOn: { backgroundColor: VERDE },
  medioTxt: { fontSize: 14, fontWeight: '700', color: TEXTO },
  medioAyuda: { fontSize: 12, color: TEXTO2, marginTop: 8 },

  inputFila: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF',
    borderRadius: 16, paddingHorizontal: 14,
  },
  inputFlex: { flex: 1, paddingVertical: 14, fontSize: 15, color: TEXTO },
  input: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, fontSize: 15, color: TEXTO },

  errores: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#FDECEE', borderWidth: 1, borderColor: '#F5B7BD' },
  erroresTitulo: { fontSize: 13, fontWeight: '800', color: ROJO, marginBottom: 4 },
  errorItem: { fontSize: 13, color: TEXTO, marginTop: 2 },
  errorGeneral: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#FDECEE', fontSize: 13, color: ROJO },

  btn: {
    marginTop: 22, height: 56, borderRadius: 30, backgroundColor: AMARILLO,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  btnTxt: { fontSize: 16, fontWeight: '800', color: TEXTO },
  pie: { fontSize: 12, color: TEXTO2, textAlign: 'center', marginTop: 10 },
  vacioTxt: { fontSize: 15, color: TEXTO2, textAlign: 'center' },
});
