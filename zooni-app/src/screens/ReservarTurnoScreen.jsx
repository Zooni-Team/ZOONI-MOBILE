/**
 * ReservarTurnoScreen.jsx — El dueño pide un turno en una veterinaria o peluquería
 *
 * Se llega desde la ficha del negocio (NegocioPublico) con el servicio ya
 * elegido, o desde "Volver a pedir" en Turnos y pedidos. Todo en una pantalla,
 * de arriba hacia abajo:
 *
 *   1. Servicio      los del negocio, con duración y precio
 *   2. Mascota       sus mascotas; en peluquería, el tamaño sale del peso (y se
 *                    puede corregir) y define el precio
 *   3. Día           las próximas 3 semanas; los días cerrados no se pueden elegir
 *   4. Horario       sólo los libres (turnosLibres: dentro del horario, sin
 *                    pisar otros turnos, con anticipación)
 *   5. Extras        veterinaria: urgencia (si atiende 24 h, abre todo el día)
 *                    y a domicilio · peluquería: busca y lleva (con su costo)
 *   6. Notas         lo que el negocio tiene que saber antes
 *
 * Abajo, el resumen y "Pedir turno · $X". El turno queda "Por confirmar" y al
 * negocio le llega la notificación; al confirmarlo, le llega al dueño.
 *
 * Params: { idNegocio, idItem?, idMascota?, urgente? }
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { useMisMascotas } from '../hooks/useMisMascotas';
import { resolveMascotaVisual } from '../constants/petImages';
import { TAMANOS, configNegocio, tamanoPorPeso } from '../constants/negocios';
import {
  crearTurno, fetchNegocioPublico, fetchOcupados, formatoPlata, horaTexto, horarioDelDia, precioTurno,
  recargoDomicilio, textoPrecioItem, turnosLibres,
} from '../services/negocioApi';
import { direccionDe } from '../services/paseadorApi';

const VERDE = '#2DBD72';
const MENTA = '#C8F0D8';
const AMARILLO = '#F5C842';
const ROJO = '#E63946';
const TEXTO = '#2C2C2C';
const TEXTO2 = '#6B6B6B';

const DIAS_VISTA = 21;
const NOMBRE_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fechaLarga = (d) => d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

function proximosDias() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Array.from({ length: DIAS_VISTA }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    return d;
  });
}

// Urgencias 24 h: ese día se puede pedir a cualquier hora
const HORARIO_24H = Object.fromEntries(['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']
  .map((k) => [k, { activo: true, desde: '00:00', hasta: '23:59' }]));

const ESPECIE_KEY = (especie) => {
  const e = String(especie ?? '').toLowerCase();
  if (e.includes('perr')) return 'perro';
  if (e.includes('gat')) return 'gato';
  return 'exoticos';
};

export default function ReservarTurnoScreen() {
  const navigation = useNavigation();
  const { idNegocio, idItem, idMascota, urgente: urgenteParam = false } = useRoute().params ?? {};
  const { mascotas, cargando: cargandoMascotas } = useMisMascotas();

  const [negocio, setNegocio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [itemId, setItemId] = useState(idItem ?? null);
  const [mascotaId, setMascotaId] = useState(idMascota ?? null);
  const [tamano, setTamano] = useState(null); // corrección manual (peluquería)
  const [urgente, setUrgente] = useState(!!urgenteParam);
  const [dia, setDia] = useState(null);
  const [hora, setHora] = useState(null); // Date
  const [libres, setLibres] = useState(null);
  const [cargandoLibres, setCargandoLibres] = useState(false);
  const [aDomicilio, setADomicilio] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [ubicando, setUbicando] = useState(false);
  const [notas, setNotas] = useState('');
  const [errores, setErrores] = useState([]);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchNegocioPublico(idNegocio)
      .then((n) => {
        setNegocio(n);
        if (!idItem && n?.items?.length) setItemId(n.items[0].id);
      })
      .catch(() => setNegocio(null))
      .finally(() => setCargando(false));
  }, [idNegocio, idItem]);

  useEffect(() => {
    if (!mascotaId && mascotas.length) setMascotaId((mascotas.find((m) => m.esPrincipal) ?? mascotas[0]).id);
  }, [mascotas, mascotaId]);

  const cfg = configNegocio(negocio?.tipo);
  const d = negocio?.datos ?? {};
  const esVet = negocio?.tipo === 'veterinaria';
  const esPelu = negocio?.tipo === 'peluqueria';
  const item = negocio?.items?.find((i) => i.id === itemId) ?? null;
  const mascota = mascotas.find((m) => m.id === mascotaId) ?? null;
  const tamanoMascota = tamano ?? tamanoPorPeso(mascota?.peso) ?? null;
  const usa24h = esVet && urgente && !!d.urgencias24h;
  const horarios = usa24h ? HORARIO_24H : negocio?.horarios;
  const ofreceDomicilio = (esVet && d.aDomicilio) || (esPelu && d.buscaYLleva);
  const precio = negocio && item ? precioTurno(negocio, item, tamanoMascota, aDomicilio) : 0;

  const dias = useMemo(proximosDias, []);
  const diaAbierto = useCallback((x) => !!horarios && horarioDelDia(horarios, x).activo, [horarios]);

  // Primer día abierto elegido de entrada (o hoy si es urgente)
  useEffect(() => {
    if (!negocio || dia) return;
    setDia(dias.find(diaAbierto) ?? null);
  }, [negocio, dia, dias, diaAbierto]);

  // Horarios libres del día elegido, para la duración del servicio
  useEffect(() => {
    if (!negocio || !item || !dia) { setLibres(null); return undefined; }
    let vivo = true;
    setCargandoLibres(true);
    setHora(null);
    fetchOcupados(negocio.id, dia)
      .then((ocupados) => {
        if (!vivo) return;
        setLibres(turnosLibres({
          horarios, dia, duracion: item.duracionMin, ocupados, anticipacionMin: usa24h ? 15 : 60,
        }));
      })
      .catch(() => { if (vivo) setLibres([]); })
      .finally(() => { if (vivo) setCargandoLibres(false); });
    return () => { vivo = false; };
  }, [negocio, item, dia, horarios, usa24h]);

  const usarUbicacion = () => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null;
    if (!geo) return;
    setUbicando(true);
    geo.getCurrentPosition(async (p) => {
      const dir = await direccionDe(p.coords.latitude, p.coords.longitude);
      if (dir) setDireccion(dir);
      setUbicando(false);
    }, () => setUbicando(false), { enableHighAccuracy: true, timeout: 10000 });
  };

  const especieOk = !mascota || !d.especies?.length || d.especies.includes(ESPECIE_KEY(mascota.especie));
  const tamanoOk = !esPelu || !tamanoMascota || !d.tamanos?.length || d.tamanos.includes(tamanoMascota);

  const enviar = async () => {
    if (enviandoRef.current) return;
    const faltan = [];
    if (!item) faltan.push('elegir el servicio');
    if (!mascota) faltan.push('elegir la mascota');
    if (esPelu && !tamanoMascota) faltan.push('elegir el tamaño de tu mascota (define el precio)');
    if (!hora) faltan.push('elegir un horario libre');
    if (aDomicilio && direccion.trim().length < 5) faltan.push('escribir la dirección de tu casa');
    setErrores(faltan);
    setErrorGeneral(null);
    if (faltan.length) { scrollRef.current?.scrollToEnd({ animated: true }); return; }

    enviandoRef.current = true;
    setEnviando(true);
    try {
      await crearTurno({
        negocio, item, mascota, fecha: hora, tamano: tamanoMascota,
        urgencia: esVet && urgente, aDomicilio, direccion, notas,
      });
      navigation.replace('MisTurnos', {
        tab: 'turnos',
        aviso: `¡Listo! Le pedimos el turno a ${negocio.nombre}. Te avisamos cuando lo confirme.`,
      });
    } catch (err) {
      const m = err?.message;
      if (m === 'horario_ocupado') {
        setErrorGeneral('Alguien acaba de tomar ese horario. Elegí otro, ya actualizamos los libres.');
        setDia((x) => new Date(x)); // fuerza recargar los libres
      } else if (m === 'negocio_cerrado') {
        setErrorGeneral(`${negocio.nombre} dejó de tomar turnos hace un momento. Escribile por chat.`);
      } else {
        setErrorGeneral(`No se pudo pedir el turno.${err?.detalle ? `\n\nDetalle: ${err.detalle}` : ''}`);
      }
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  if (cargando) return <View style={[s.safe, s.centro]}><ActivityIndicator size="large" color={VERDE} /></View>;
  if (!negocio || !negocio.items?.length) {
    return (
      <SafeAreaView style={[s.safe, s.centro]}>
        <Ionicons name="calendar-outline" size={44} color={TEXTO2} />
        <Text style={s.vacioTxt}>{negocio ? 'Este negocio todavía no cargó sus servicios.' : 'Este negocio ya no está disponible.'}</Text>
        <TouchableOpacity style={[s.btn, { alignSelf: 'stretch', marginHorizontal: 24 }]} onPress={() => navigation.goBack()}>
          <Text style={s.btnTxt}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Horarios agrupados en mañana / tarde / noche
  const grupos = libres ? [
    { titulo: 'Mañana', horas: libres.filter((h) => h.getHours() < 12) },
    { titulo: 'Tarde', horas: libres.filter((h) => h.getHours() >= 12 && h.getHours() < 19) },
    { titulo: 'Noche', horas: libres.filter((h) => h.getHours() >= 19) },
  ].filter((g) => g.horas.length) : [];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={MENTA} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={TEXTO} />
        </TouchableOpacity>
        <Text style={s.titulo}>{urgente && esVet ? 'Turno urgente' : 'Pedir turno'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Negocio */}
          <View style={s.card}>
            <View style={s.fila}>
              {negocio.logo
                ? <Image source={{ uri: negocio.logo }} style={s.logo} />
                : <View style={[s.logo, { backgroundColor: cfg.fondoIcono, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name={cfg.icono} size={26} color={cfg.color} />
                </View>}
              <View style={{ flex: 1 }}>
                <Text style={s.negocioNombre}>{negocio.nombre}</Text>
                <Text style={s.negocioSub} numberOfLines={1}>{cfg.label} · {negocio.direccion}</Text>
              </View>
            </View>
          </View>

          {/* 1. Servicio */}
          <Text style={s.label}>{esVet ? '¿Qué necesitás?' : '¿Qué servicio?'}</Text>
          <View style={{ gap: 8 }}>
            {negocio.items.map((it) => {
              const on = it.id === itemId;
              return (
                <TouchableOpacity key={it.id} style={[s.opcion, on && s.opcionOn]} onPress={() => setItemId(it.id)}
                  accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? '#FFF' : VERDE} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.opcionTitulo, on && { color: '#FFF' }]}>{it.nombre}</Text>
                    <Text style={[s.opcionTxt, on && { color: '#F0FFF6' }]}>{it.categoria} · {it.duracionMin} min</Text>
                  </View>
                  <Text style={[s.opcionPrecio, on && { color: '#FFF' }]}>
                    {esPelu && tamanoMascota && it.precios ? formatoPlata(precioTurno(negocio, it, tamanoMascota, false)) : textoPrecioItem(it)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 2. Mascota */}
          <Text style={s.label}>¿Para quién?</Text>
          {cargandoMascotas ? <ActivityIndicator color={VERDE} /> : mascotas.length === 0 ? (
            <Text style={s.ayuda}>No tenés mascotas cargadas. Agregá una desde Mis Mascotas.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {mascotas.map((m) => {
                const on = m.id === mascotaId;
                return (
                  <TouchableOpacity key={m.id} style={[s.mascota, on && s.mascotaOn]}
                    onPress={() => { setMascotaId(m.id); setTamano(null); }}
                    accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <Image source={resolveMascotaVisual(m)} style={s.mascotaFoto} />
                    <Text style={[s.mascotaNombre, on && { color: '#FFF' }]} numberOfLines={1}>{m.nombre}</Text>
                    {m.peso ? <Text style={[s.mascotaPeso, on && { color: '#F0FFF6' }]}>{String(m.peso).replace('.', ',')} kg</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {!especieOk && (
            <Text style={s.alerta}>
              <Ionicons name="warning-outline" size={13} color={ROJO} /> {negocio.nombre} no indica que atienda {String(mascota?.especie ?? '').toLowerCase()}s. Consultá por chat antes.
            </Text>
          )}
          {esPelu && mascota && (
            <>
              <Text style={s.subLabel}>
                Tamaño {tamanoPorPeso(mascota.peso) && !tamano ? '(por su peso)' : ''}
              </Text>
              <View style={s.chips}>
                {TAMANOS.map((t) => {
                  const on = tamanoMascota === t.key;
                  const atiende = !d.tamanos?.length || d.tamanos.includes(t.key);
                  return (
                    <TouchableOpacity key={t.key} style={[s.chip, on && s.chipOn, !atiende && { opacity: 0.4 }]}
                      onPress={() => setTamano(t.key)} disabled={!atiende}>
                      <Text style={[s.chipTxt, on && { color: '#FFF' }]}>{t.label}</Text>
                      <Text style={[s.chipSub, on && { color: '#F0FFF6' }]}>{t.detalle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!tamanoOk && <Text style={s.alerta}>Este tamaño no lo atienden. Consultá por chat.</Text>}
            </>
          )}

          {/* Urgencia (veterinaria) */}
          {esVet && (
            <TouchableOpacity style={[s.toggle, urgente && s.toggleUrgente]} onPress={() => { setUrgente((u) => !u); setDia(null); }}
              accessibilityRole="switch" accessibilityState={{ checked: urgente }}>
              <Ionicons name={urgente ? 'alert-circle' : 'alert-circle-outline'} size={24} color={urgente ? ROJO : TEXTO2} />
              <View style={{ flex: 1 }}>
                <Text style={[s.toggleTitulo, urgente && { color: ROJO }]}>Es una urgencia</Text>
                <Text style={s.toggleTxt}>
                  {d.urgencias24h
                    ? 'Atienden urgencias 24 h: podés elegir cualquier horario y les llega destacado.'
                    : 'Les llega destacado para que lo atiendan lo antes posible.'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* 3. Día */}
          <Text style={s.label}>¿Qué día?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {dias.map((x, i) => {
              const on = dia && x.toDateString() === dia.toDateString();
              const abierto = diaAbierto(x);
              return (
                <TouchableOpacity key={x.toISOString()} style={[s.dia, on && s.diaOn, !abierto && s.diaCerrado]}
                  onPress={() => setDia(x)} disabled={!abierto}
                  accessibilityLabel={`${fechaLarga(x)}${abierto ? '' : ', cerrado'}`}>
                  <Text style={[s.diaNombre, on && { color: '#FFF' }]}>{i === 0 ? 'Hoy' : i === 1 ? 'Mañ' : NOMBRE_DIA[x.getDay()]}</Text>
                  <Text style={[s.diaNum, on && { color: '#FFF' }]}>{x.getDate()}</Text>
                  <Text style={[s.diaMes, on && { color: '#F0FFF6' }]}>{abierto ? x.toLocaleDateString('es-AR', { month: 'short' }) : 'cerr.'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 4. Horario */}
          <Text style={s.label}>¿A qué hora?{dia ? <Text style={s.labelSub}> · {fechaLarga(dia)}</Text> : null}</Text>
          {!item ? <Text style={s.ayuda}>Elegí primero el servicio.</Text>
            : cargandoLibres || libres === null ? <ActivityIndicator color={VERDE} />
              : !grupos.length ? (
                <View style={s.sinLibres}>
                  <Ionicons name="calendar-clear-outline" size={20} color={TEXTO2} />
                  <Text style={s.sinLibresTxt}>No quedan horarios libres para {item.duracionMin} min este día. Probá con otro.</Text>
                </View>
              ) : grupos.map((g) => (
                <View key={g.titulo} style={{ marginBottom: 8 }}>
                  <Text style={s.subLabel}>{g.titulo}</Text>
                  <View style={s.horas}>
                    {g.horas.map((h) => {
                      const on = hora && h.getTime() === hora.getTime();
                      return (
                        <TouchableOpacity key={h.toISOString()} style={[s.hora, on && s.horaOn]} onPress={() => setHora(h)}
                          accessibilityRole="radio" accessibilityState={{ selected: on }}>
                          <Text style={[s.horaTxt, on && { color: '#FFF' }]}>{horaTexto(h)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

          {/* 5. A domicilio */}
          {ofreceDomicilio && (
            <>
              <TouchableOpacity style={[s.toggle, aDomicilio && s.toggleOn]} onPress={() => setADomicilio((x) => !x)}
                accessibilityRole="switch" accessibilityState={{ checked: aDomicilio }}>
                <Ionicons name={aDomicilio ? 'checkbox' : 'square-outline'} size={22} color={aDomicilio ? VERDE : TEXTO2} />
                <View style={{ flex: 1 }}>
                  <Text style={s.toggleTitulo}>{esVet ? 'Que vengan a mi casa' : 'Que lo busquen y lo traigan'}</Text>
                  <Text style={s.toggleTxt}>
                    {esVet ? 'La consulta es en tu casa.'
                      : recargoDomicilio(negocio, true) ? `Se suma ${formatoPlata(recargoDomicilio(negocio, true))} al precio.` : 'Sin costo extra.'}
                  </Text>
                </View>
              </TouchableOpacity>
              {aDomicilio && (
                <View style={s.inputFila}>
                  <TextInput style={s.inputFlex} value={direccion} onChangeText={(v) => setDireccion(v.slice(0, 300))}
                    placeholder="Tu dirección (calle, número, piso)" placeholderTextColor="#AAAAAA" />
                  <TouchableOpacity onPress={usarUbicacion} hitSlop={8} accessibilityLabel="Usar mi ubicación">
                    {ubicando ? <ActivityIndicator size="small" color={VERDE} /> : <Ionicons name="locate" size={22} color={VERDE} />}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* 6. Notas */}
          <Text style={s.label}>{esVet ? 'Contales qué le pasa (opcional)' : 'Notas para la peluquería (opcional)'}</Text>
          <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} value={notas} onChangeText={setNotas}
            multiline maxLength={500} placeholderTextColor="#AAAAAA"
            placeholder={esVet
              ? 'Ej: vomitó dos veces desde ayer, está decaído. Toma un antibiótico.'
              : 'Ej: tiene nudos en las patas, se pone nervioso con el secador.'} />

          {/* Resumen */}
          {item && mascota && hora ? (
            <View style={[s.card, { marginTop: 22 }]}>
              <Text style={s.resumenTitulo}>Tu turno</Text>
              <Text style={s.resumenFila}><Ionicons name="paw" size={14} color={VERDE} /> {mascota.nombre} · {item.nombre}</Text>
              <Text style={s.resumenFila}><Ionicons name="calendar" size={14} color={VERDE} /> {fechaLarga(hora)} a las {horaTexto(hora)} ({item.duracionMin} min)</Text>
              {aDomicilio ? <Text style={s.resumenFila}><Ionicons name="home" size={14} color={VERDE} /> {esVet ? 'En tu casa' : 'Busca y lleva'}</Text> : null}
              {esVet && urgente ? <Text style={[s.resumenFila, { color: ROJO }]}><Ionicons name="alert-circle" size={14} color={ROJO} /> Urgencia</Text> : null}
              <View style={s.resumenTotal}>
                <Text style={s.resumenTotalTxt}>Total</Text>
                <Text style={s.resumenTotalTxt}>{formatoPlata(precio)}</Text>
              </View>
            </View>
          ) : null}

          {errores.length > 0 && (
            <View style={s.errores}>
              <Text style={s.erroresTitulo}>Para pedir el turno es necesario:</Text>
              {errores.map((e) => <Text key={e} style={s.errorItem}>• {e}</Text>)}
            </View>
          )}
          {errorGeneral && <Text style={s.errorGeneral}>{errorGeneral}</Text>}

          <TouchableOpacity style={[s.btn, esVet && urgente && { backgroundColor: ROJO }, enviando && { opacity: 0.6 }]}
            onPress={enviar} disabled={enviando} activeOpacity={0.85}>
            {enviando ? <ActivityIndicator color={TEXTO} /> : (
              <Text style={[s.btnTxt, esVet && urgente && { color: '#FFF' }]}>
                {esVet && urgente ? 'Pedir turno urgente' : 'Pedir turno'}{item ? ` · ${formatoPlata(precio)}` : ''}
              </Text>
            )}
          </TouchableOpacity>
          <Text style={s.pie}>El pago es en el {esVet ? 'consultorio' : 'local'}. Te avisamos cuando {negocio.nombre} confirme.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 54, height: 54, borderRadius: 16 },
  negocioNombre: { fontSize: 17, fontWeight: '900', color: TEXTO },
  negocioSub: { fontSize: 13, color: TEXTO2, marginTop: 2 },

  label: { fontSize: 15, fontWeight: '800', color: TEXTO, marginTop: 22, marginBottom: 10 },
  labelSub: { fontSize: 13, fontWeight: '600', color: TEXTO2 },
  subLabel: { fontSize: 13, fontWeight: '700', color: TEXTO2, marginTop: 10, marginBottom: 8 },
  ayuda: { fontSize: 13, color: TEXTO2 },
  alerta: { fontSize: 12, color: ROJO, fontWeight: '700', marginTop: 8 },

  opcion: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 18, padding: 14 },
  opcionOn: { backgroundColor: VERDE },
  opcionTitulo: { fontSize: 15, fontWeight: '800', color: TEXTO },
  opcionTxt: { fontSize: 12, color: TEXTO2, marginTop: 2 },
  opcionPrecio: { fontSize: 15, fontWeight: '900', color: TEXTO },

  mascota: { alignItems: 'center', width: 86, paddingVertical: 10, borderRadius: 18, backgroundColor: '#FFF' },
  mascotaOn: { backgroundColor: VERDE },
  mascotaFoto: { width: 52, height: 52, borderRadius: 26, backgroundColor: MENTA },
  mascotaNombre: { fontSize: 13, fontWeight: '800', color: TEXTO, marginTop: 6, maxWidth: 74 },
  mascotaPeso: { fontSize: 11, color: TEXTO2 },

  chips: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 10 },
  chipOn: { backgroundColor: VERDE },
  chipTxt: { fontSize: 14, fontWeight: '800', color: TEXTO },
  chipSub: { fontSize: 11, color: TEXTO2, marginTop: 1 },

  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 18,
    padding: 14, marginTop: 18, borderWidth: 2, borderColor: '#FFF',
  },
  toggleOn: { borderColor: VERDE },
  toggleUrgente: { borderColor: ROJO, backgroundColor: '#FFF7F8' },
  toggleTitulo: { fontSize: 15, fontWeight: '800', color: TEXTO },
  toggleTxt: { fontSize: 12, color: TEXTO2, marginTop: 2, lineHeight: 17 },

  dia: { width: 58, alignItems: 'center', paddingVertical: 10, borderRadius: 16, backgroundColor: '#FFF' },
  diaOn: { backgroundColor: VERDE },
  diaCerrado: { opacity: 0.4 },
  diaNombre: { fontSize: 12, fontWeight: '700', color: TEXTO2 },
  diaNum: { fontSize: 20, fontWeight: '900', color: TEXTO },
  diaMes: { fontSize: 11, color: TEXTO2 },

  horas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hora: { width: '22.5%', alignItems: 'center', paddingVertical: 11, borderRadius: 14, backgroundColor: '#FFF' },
  horaOn: { backgroundColor: VERDE },
  horaTxt: { fontSize: 15, fontWeight: '800', color: TEXTO, fontVariant: ['tabular-nums'] },
  sinLibres: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 16, padding: 14 },
  sinLibresTxt: { flex: 1, fontSize: 13, color: TEXTO2 },

  inputFila: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF',
    borderRadius: 16, paddingHorizontal: 14, marginTop: 10,
  },
  inputFlex: { flex: 1, paddingVertical: 14, fontSize: 15, color: TEXTO },
  input: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, fontSize: 15, color: TEXTO },

  resumenTitulo: { fontSize: 16, fontWeight: '900', color: TEXTO, marginBottom: 6 },
  resumenFila: { fontSize: 14, color: TEXTO, marginTop: 4 },
  resumenTotal: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#F2F2F2',
  },
  resumenTotalTxt: { fontSize: 18, fontWeight: '900', color: TEXTO },

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
  vacioTxt: { fontSize: 15, color: TEXTO2, textAlign: 'center', paddingHorizontal: 24 },
});
