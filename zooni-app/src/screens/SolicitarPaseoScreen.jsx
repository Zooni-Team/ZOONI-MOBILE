/**
 * SolicitarPaseoScreen.jsx — El dueño contrata a un paseador de Zooni
 *
 * Se llega desde Comunidad (círculo del paseador en el mapa o lista de
 * Servicios) con { paseadorId }. Ve qué días y en qué horario pasea, y elige
 * mascota, día, hora, duración (con el precio que puso el paseador),
 * dirección y notas. Si elige un horario fuera de los del paseador se le
 * avisa, pero puede pedirlo igual (el paseador decide si lo acepta). La solicitud queda
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
import { DIAS_SEMANA, DIA_DE_JS } from '../constants/negocios';
import { horarioDelDia, minutosDe } from '../services/negocioApi';
import {
  MEDIOS_PAGO, crearSolicitudPaseo, direccionDe, fetchPaseadorPublico, formatoDuracion, formatoPlata, precioPara,
  serviciosDe,
} from '../services/paseadorApi';
import { colores, sombras } from '../theme';

function proximaHoraRedonda() {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  return d;
}

const fechaTexto = (d) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const horaTexto = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** ¿El paseo (desde `fecha`, `duracion` minutos) cae fuera de los horarios del paseador? */
function fueraDeHorario(horarios, fecha, duracion) {
  const h = horarioDelDia(horarios, fecha);
  if (!h.activo) return true;
  const inicio = fecha.getHours() * 60 + fecha.getMinutes();
  return inicio < minutosDe(h.desde) || inicio + (duracion ?? 0) > minutosDe(h.hasta);
}

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
    return <View style={[s.safe, s.centro]}><ActivityIndicator size="large" color={colores.verde} /></View>;
  }
  if (!paseador) {
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <Ionicons name="alert-circle-outline" size={40} color={colores.textoSecundario} />
        <Text style={s.vacioTxt}>Este paseador ya no está disponible.</Text>
        <TouchableOpacity style={[s.btn, { alignSelf: 'stretch', marginHorizontal: 24 }]} onPress={() => navigation.goBack()}>
          <Text style={s.btnTxt}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colores.menta} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colores.texto} />
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
                : <View style={[s.avatar, s.avatarIni]}><Ionicons name="walk" size={26} color={colores.verde} /></View>}
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

            <Text style={s.horariosTitulo}>Cuándo pasea</Text>
            {DIAS_SEMANA.map((d) => {
              const h = paseador.horarios?.[d.key];
              const elegido = DIA_DE_JS[fecha.getDay()] === d.key;
              return (
                <View key={d.key} style={[s.horarioFila, elegido && s.horarioElegido]}>
                  <Text style={[s.horarioDia, !h?.activo && s.horarioOff, elegido && { fontWeight: '800' }]}>{d.label}</Text>
                  <Text style={[s.horarioHoras, !h?.activo && s.horarioOff, elegido && { fontWeight: '800' }]}>
                    {h?.activo ? `${h.desde} a ${h.hasta}` : 'No pasea'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Mascota */}
          <Text style={s.label}>¿Quién sale a pasear?</Text>
          {cargandoMascotas ? <ActivityIndicator color={colores.verde} /> : mascotas.length === 0 ? (
            <Text style={s.ayuda}>No tenés mascotas cargadas. Agregá una desde Mis Mascotas.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {mascotas.map((m) => {
                const on = m.id === mascotaId;
                return (
                  <TouchableOpacity key={m.id} style={[s.mascota, on && s.mascotaOn]} onPress={() => setMascotaId(m.id)}
                    accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <Image source={resolveMascotaVisual(m)} style={s.mascotaFoto} />
                    <Text style={[s.mascotaNombre, on && { color: colores.blanco }]} numberOfLines={1}>{m.nombre}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Cuándo */}
          <Text style={s.label}>¿Cuándo?</Text>
          <View style={s.fila}>
            <TouchableOpacity style={[s.campo, { flex: 1.6 }]} onPress={() => setPicker('fecha')}>
              <Ionicons name="calendar-outline" size={18} color={colores.verde} />
              <Text style={s.campoTxt} numberOfLines={1}>{fechaTexto(fecha)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.campo, { flex: 1 }]} onPress={() => setPicker('hora')}>
              <Ionicons name="time-outline" size={18} color={colores.verde} />
              <Text style={s.campoTxt}>{horaTexto(fecha)}</Text>
            </TouchableOpacity>
          </View>

          {fueraDeHorario(paseador.horarios, fecha, duracion) && (
            <View style={s.aviso}>
              <Ionicons name="alert-circle-outline" size={18} color={colores.ambarOscuro} />
              <Text style={s.avisoTxt}>
                Ese horario está fuera de los horarios de {paseador.nombreCompleto}. Podés pedirlo igual, pero puede que no lo acepte.
              </Text>
            </View>
          )}

          {/* Duración y precio */}
          <Text style={s.label}>¿Cuánto tiempo?</Text>
          <View style={[s.fila, { flexWrap: 'wrap' }]}>
            {servicios.map(({ minutos, precio: p }) => {
              const on = duracion === minutos;
              return (
                <TouchableOpacity key={minutos} style={[s.duracion, on && s.duracionOn]} onPress={() => setDuracion(minutos)}
                  accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[s.duracionTxt, on && { color: colores.blanco }]}>{formatoDuracion(minutos)}</Text>
                  <Text style={[s.duracionPrecio, on && { color: colores.blanco }]}>{formatoPlata(p)}</Text>
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
                  <Ionicons name={m.icono} size={16} color={on ? colores.blanco : colores.verde} />
                  <Text style={[s.medioTxt, on && { color: colores.blanco }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.medioAyuda}>Le pagás directo al paseador: este dato es para que sepa cómo vas a hacerlo.</Text>

          <Text style={s.label}>¿Dónde lo busca?</Text>
          <View style={s.inputFila}>
            <TextInput style={s.inputFlex} value={direccion} onChangeText={(v) => { setDireccion(v.slice(0, 200)); setCoords(null); }}
              placeholder="Calle, número y piso/depto" placeholderTextColor={colores.textoTenue} />
            <TouchableOpacity onPress={usarUbicacion} hitSlop={8} accessibilityLabel="Usar mi ubicación">
              {ubicando ? <ActivityIndicator size="small" color={colores.verde} /> : <Ionicons name="locate" size={22} color={colores.verde} />}
            </TouchableOpacity>
          </View>

          {/* Notas */}
          <Text style={s.label}>Notas para el paseador (opcional)</Text>
          <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} value={notas} onChangeText={setNotas}
            multiline maxLength={500} placeholderTextColor={colores.textoTenue}
            placeholder="Ej: tira un poco de la correa, las llaves están con el portero." />

          {errores.length > 0 && (
            <View style={s.errores}>
              <Text style={s.erroresTitulo}>Para enviar la solicitud es necesario:</Text>
              {errores.map((e) => <Text key={e} style={s.errorItem}>• {e.replace(/^Es necesario /, '')}</Text>)}
            </View>
          )}
          {errorGeneral && <Text style={s.errorGeneral}>{errorGeneral}</Text>}

          <TouchableOpacity style={[s.btn, enviando && { opacity: 0.6 }]} onPress={enviar} disabled={enviando} activeOpacity={0.85}>
            {enviando ? <ActivityIndicator color={colores.texto} /> : (
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colores.menta },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  titulo: { fontSize: 20, fontWeight: '800', color: colores.verde },
  scroll: { padding: 20, paddingTop: 4, paddingBottom: 40 },

  card: { backgroundColor: colores.blanco, borderRadius: 20, padding: 16, ...sombras.tarjeta },
  paseadorFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, borderColor: colores.verde },
  avatarIni: { backgroundColor: colores.menta, alignItems: 'center', justifyContent: 'center' },
  paseadorNombre: { fontSize: 18, fontWeight: '800', color: colores.texto },
  paseadorSub: { fontSize: 13, color: colores.textoSecundario, marginTop: 2 },
  bio: { fontSize: 14, color: colores.texto, marginTop: 12, lineHeight: 20 },
  horariosTitulo: { fontSize: 14, fontWeight: '800', color: colores.texto, marginTop: 14, marginBottom: 4 },
  horarioFila: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8,
  },
  horarioElegido: { backgroundColor: colores.menta },
  horarioDia: { fontSize: 14, color: colores.texto },
  horarioHoras: { fontSize: 14, color: colores.texto, fontVariant: ['tabular-nums'] },
  horarioOff: { color: colores.textoTenue },
  aviso: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colores.ambarFondo,
    borderRadius: 12, padding: 12, marginTop: 10,
  },
  avisoTxt: { flex: 1, fontSize: 13, color: '#7A5500', lineHeight: 18 },

  label: { fontSize: 15, fontWeight: '800', color: colores.texto, marginTop: 22, marginBottom: 10 },
  ayuda: { fontSize: 13, color: colores.textoSecundario },
  fila: { flexDirection: 'row', gap: 10 },

  mascota: {
    alignItems: 'center', width: 86, paddingVertical: 10, borderRadius: 18,
    backgroundColor: colores.blanco, borderWidth: 2, borderColor: colores.blanco,
  },
  mascotaOn: { backgroundColor: colores.verde, borderColor: colores.verde },
  mascotaFoto: { width: 52, height: 52, borderRadius: 26, backgroundColor: colores.menta },
  mascotaNombre: { fontSize: 13, fontWeight: '800', color: colores.texto, marginTop: 6, maxWidth: 74 },

  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colores.blanco,
    borderRadius: 16, paddingHorizontal: 14, height: 52,
  },
  campoTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: colores.texto },

  duracion: { flexGrow: 1, flexBasis: '40%', backgroundColor: colores.blanco, borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  duracionOn: { backgroundColor: colores.verde },
  duracionTxt: { fontSize: 14, fontWeight: '700', color: colores.textoSecundario },
  duracionPrecio: { fontSize: 22, fontWeight: '900', color: colores.texto, marginTop: 2 },
  medios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  medio: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colores.blanco, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  medioOn: { backgroundColor: colores.verde },
  medioTxt: { fontSize: 14, fontWeight: '700', color: colores.texto },
  medioAyuda: { fontSize: 12, color: colores.textoSecundario, marginTop: 8 },

  inputFila: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colores.blanco,
    borderRadius: 16, paddingHorizontal: 14,
  },
  inputFlex: { flex: 1, paddingVertical: 14, fontSize: 15, color: colores.texto },
  input: { backgroundColor: colores.blanco, borderRadius: 16, padding: 14, fontSize: 15, color: colores.texto },

  errores: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: colores.rojoFondo, borderWidth: 1, borderColor: colores.rojoBorde },
  erroresTitulo: { fontSize: 13, fontWeight: '800', color: colores.rojo, marginBottom: 4 },
  errorItem: { fontSize: 13, color: colores.texto, marginTop: 2 },
  errorGeneral: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colores.rojoFondo, fontSize: 13, color: colores.rojo },

  btn: {
    marginTop: 22, height: 56, borderRadius: 30, backgroundColor: colores.amarillo,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  btnTxt: { fontSize: 16, fontWeight: '800', color: colores.texto },
  pie: { fontSize: 12, color: colores.textoSecundario, textAlign: 'center', marginTop: 10 },
  vacioTxt: { fontSize: 15, color: colores.textoSecundario, textAlign: 'center' },
});
