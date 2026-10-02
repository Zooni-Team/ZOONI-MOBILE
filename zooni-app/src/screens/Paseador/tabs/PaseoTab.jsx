/**
 * PaseoTab.jsx — Tab 3 de Zooni Paseadores
 *
 * CON paseo en curso: mapa a pantalla completa + card flotante blanca con la
 * mascota, el timer y la distancia en números grandes, y Pausar / Finalizar.
 *
 * SIN paseo en curso: los paseos aceptados listos para iniciar, o el resumen
 * del paseo que se acaba de terminar.
 *
 * GPS: navigator.geolocation (web y, si existe, nativo). Sólo acumula
 * distancia mientras el timer corre; descarta lecturas imprecisas y el
 * "temblor" del GPS parado. Cada ~15 s / 30 m guarda un punto en PaseoTrack
 * para que el dueño vea el recorrido.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Card, PillButton, Seccion, Stat, Vacio, sombra } from '../../../components/paseador/PaseadorUI';
import MapaPaseo from '../../../components/paseador/MapaPaseo';
import PaseoCard from '../../../components/paseador/PaseoCard';
import {
  distanciaMetros, fetchMisPaseos, fetchRecorrido, finalizarPaseo, formatoDistancia,
  formatoPlata, formatoTimer, pausarPaseo, reanudarPaseo, registrarPunto, segundosDePaseo,
} from '../../../services/paseadorApi';
import { confirmar } from '../../../utils/dialogo';

const PRECISION_MAX_M = 60;    // lecturas peores que esto se descartan
const SALTO_MIN_M = 5;         // menos que esto es temblor del GPS
const SALTO_MAX_M = 300;       // más que esto entre dos lecturas es un error
const GUARDAR_CADA_MS = 15000;
const GUARDAR_CADA_M = 30;

function geolocalizacion() {
  return typeof navigator !== 'undefined' ? navigator.geolocation : null;
}

export default function PaseoTab(props) {
  const { paseoActivo } = props;
  const [resumen, setResumen] = useState(null);

  if (paseoActivo) return <PaseoEnCurso {...props} onFinalizado={setResumen} />;
  if (resumen) return <Resumen paseo={resumen} onCerrar={() => setResumen(null)} irA={props.irA} />;
  return <SinPaseo {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// PASEO EN CURSO
// ─────────────────────────────────────────────────────────────────────────────

function PaseoEnCurso({ paseoActivo: paseo, setPaseoActivo, abrirChat, avisar, onFinalizado }) {
  const [posicion, setPosicion] = useState(null);
  const [ruta, setRuta] = useState([]);
  const [distancia, setDistancia] = useState(paseo.distanciaMetros ?? 0);
  const [gpsError, setGpsError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [, setTick] = useState(0);
  const mapaApi = useRef(null);

  const corriendo = !!paseo.reanudadoEn;

  // Refs para el callback del GPS (no re-suscribirse en cada lectura)
  const ultimo = useRef(null);
  const distRef = useRef(distancia);
  const guardado = useRef({ t: 0, d: distancia });

  // Recorrido previo (si la app se recargó a mitad del paseo)
  useEffect(() => {
    let vivo = true;
    fetchRecorrido(paseo.id).then((pts) => {
      if (!vivo || !pts.length) return;
      setRuta(pts);
      ultimo.current = pts[pts.length - 1];
    });
    return () => { vivo = false; };
  }, [paseo.id]);

  // Timer: re-render cada segundo mientras corre
  useEffect(() => {
    if (!corriendo) return undefined;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [corriendo]);

  // GPS
  const onPosicion = useCallback((p) => {
    const { latitude: lat, longitude: lng, accuracy } = p.coords;
    const punto = { lat, lng };
    setPosicion(punto);
    setGpsError(null);
    if (accuracy != null && accuracy > PRECISION_MAX_M) return;

    const prev = ultimo.current;
    if (!prev) {
      ultimo.current = punto;
      setRuta((r) => [...r, punto]);
      return;
    }
    const salto = distanciaMetros(prev, punto);
    if (salto < SALTO_MIN_M || salto > SALTO_MAX_M) return;

    ultimo.current = punto;
    distRef.current += salto;
    setDistancia(distRef.current);
    setRuta((r) => [...r, punto]);

    const ahora = Date.now();
    if (ahora - guardado.current.t > GUARDAR_CADA_MS || distRef.current - guardado.current.d > GUARDAR_CADA_M) {
      guardado.current = { t: ahora, d: distRef.current };
      registrarPunto(paseo.id, punto, distRef.current).catch(() => {});
    }
  }, [paseo.id]);

  useEffect(() => {
    const geo = geolocalizacion();
    if (!geo) {
      setGpsError('Este dispositivo no comparte la ubicación: el tiempo se cuenta igual.');
      return undefined;
    }
    if (!corriendo) return undefined;
    const id = geo.watchPosition(
      onPosicion,
      (err) => setGpsError(err?.code === 1
        ? 'Activá el permiso de ubicación para registrar el recorrido.'
        : 'Buscando señal de GPS…'),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
    return () => geo.clearWatch(id);
  }, [corriendo, onPosicion]);

  // ── Acciones ───────────────────────────────────────────────────────────────
  const pausarOReanudar = async () => {
    setOcupado(true);
    try {
      const nuevo = corriendo ? await pausarPaseo(paseo) : await reanudarPaseo(paseo);
      // Al reanudar, el primer punto nuevo no suma el tramo hecho en pausa
      if (!corriendo) ultimo.current = null;
      setPaseoActivo(nuevo);
    } catch {
      avisar('No se pudo actualizar el paseo. Probá de nuevo.', 'alert-circle');
    } finally {
      setOcupado(false);
    }
  };

  const finalizar = async () => {
    const minutos = Math.round(segundosDePaseo(paseo) / 60);
    const corto = minutos < paseo.duracionMin * 0.5;
    const ok = await confirmar(
      `¿Finalizar el paseo de ${paseo.mascota.nombre}?`,
      corto
        ? `Llevás ${minutos} minutos de los ${paseo.duracionMin} pactados. ¿Seguro que terminaste?`
        : 'Le avisamos al dueño que ya está de vuelta.',
      { textoOk: 'Finalizar' },
    );
    if (!ok) return;
    setOcupado(true);
    try {
      const fin = await finalizarPaseo(paseo, distRef.current);
      setPaseoActivo(null);
      onFinalizado(fin);
    } catch {
      avisar('No se pudo finalizar. Probá de nuevo.', 'alert-circle');
    } finally {
      setOcupado(false);
    }
  };

  const centrar = () => {
    if (posicion) mapaApi.current?.centrar(posicion.lat, posicion.lng);
  };

  const comoLlegar = () => {
    if (paseo.lat == null) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${paseo.lat},${paseo.lng}`).catch(() => {});
  };

  const segundos = segundosDePaseo(paseo);
  const progreso = Math.min(1, segundos / (paseo.duracionMin * 60));

  return (
    <View style={{ flex: 1 }}>
      <MapaPaseo
        style={StyleSheet.absoluteFill}
        posicion={posicion}
        destino={paseo.lat != null ? { lat: paseo.lat, lng: paseo.lng } : null}
        centro={paseo.lat != null ? { lat: paseo.lat, lng: paseo.lng } : undefined}
        ruta={ruta}
        seguir={corriendo}
        apiRef={mapaApi}
      />

      {/* Arriba: estado en vivo + controles del mapa */}
      <View style={s.topBar} pointerEvents="box-none">
        <View style={[s.vivo, !corriendo && { backgroundColor: '#F1F1F1' }]}>
          <View style={[s.vivoPunto, !corriendo && { backgroundColor: C.gris }]} />
          <Text style={s.vivoTxt}>{corriendo ? 'En vivo · el dueño ve tu recorrido' : 'Paseo en pausa'}</Text>
        </View>
        <View style={{ gap: 10 }}>
          <TouchableOpacity style={s.mapBtn} onPress={centrar} accessibilityLabel="Centrar en mi ubicación">
            <Ionicons name="locate" size={22} color={C.teal} />
          </TouchableOpacity>
          {paseo.lat != null && (
            <TouchableOpacity style={s.mapBtn} onPress={comoLlegar} accessibilityLabel="Cómo llegar a la casa">
              <Ionicons name="navigate" size={20} color={C.teal} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {gpsError && (
        <View style={s.gps}>
          <Ionicons name="warning-outline" size={16} color={C.ambar} />
          <Text style={s.gpsTxt}>{gpsError}</Text>
        </View>
      )}

      {/* Abajo: card flotante */}
      <View style={s.flotante}>
        <View style={s.mascotaRow}>
          <Avatar fuente={paseo.mascota.visual} nombre={paseo.mascota.nombre} size={48} borde />
          <View style={{ flex: 1 }}>
            <Text style={s.mascota}>{paseo.mascota.nombre}</Text>
            <Text style={s.mascotaSub} numberOfLines={1}>
              {paseo.duracionMin} minutos pactados · {formatoPlata(paseo.precio)}
            </Text>
          </View>
          <TouchableOpacity style={s.chat} onPress={() => abrirChat(paseo)} accessibilityLabel="Chat con el dueño">
            <Ionicons name="chatbubble-ellipses" size={22} color={C.teal} />
          </TouchableOpacity>
        </View>

        <View style={s.numeros}>
          <View style={{ flex: 1.3 }}>
            <Text style={[s.timer, !corriendo && { color: C.texto2 }]}>{formatoTimer(segundos)}</Text>
            <Text style={s.numEtiqueta}>tiempo</Text>
          </View>
          <View style={s.numDivisor} />
          <View style={{ flex: 1 }}>
            <Text style={s.distancia}>{formatoDistancia(distancia)}</Text>
            <Text style={s.numEtiqueta}>distancia</Text>
          </View>
        </View>

        <View style={s.barra}>
          <View style={[s.barraFill, { width: `${progreso * 100}%` }, progreso >= 1 && { backgroundColor: C.amarillo }]} />
        </View>
        <Text style={s.barraTxt}>
          {progreso >= 1 ? '¡Cumpliste el tiempo pactado!' : `Faltan ${Math.ceil((paseo.duracionMin * 60 - segundos) / 60)} minutos`}
        </Text>

        <View style={s.acciones}>
          <PillButton
            titulo={corriendo ? 'Pausar' : 'Reanudar'}
            icono={corriendo ? 'pause' : 'play'}
            variante="secundario"
            onPress={pausarOReanudar}
            disabled={ocupado}
            style={{ flex: 1 }}
          />
          <PillButton titulo="Finalizar" icono="flag" onPress={finalizar} cargando={ocupado} style={{ flex: 1.3 }} />
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN DEL PASEO TERMINADO
// ─────────────────────────────────────────────────────────────────────────────

function Resumen({ paseo, onCerrar, irA }) {
  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.resumenTop}>
        <Avatar fuente={paseo.mascota.visual} nombre={paseo.mascota.nombre} size={88} borde />
        <Text style={s.resumenTitulo}>¡{paseo.mascota.nombre} ya volvió a casa!</Text>
        <Text style={s.resumenSub}>Le avisamos a {paseo.dueno.nombre}.</Text>
      </View>
      <Card>
        <Text style={s.cobradoLabel}>Ganaste</Text>
        <Text style={s.cobrado}>{formatoPlata(paseo.precio)}</Text>
        <View style={s.stats}>
          <Stat valor={formatoTimer(paseo.segundosAcumulados)} etiqueta="tiempo" icono="time" />
          <Stat valor={formatoDistancia(paseo.distanciaMetros)} etiqueta="distancia" icono="footsteps" />
        </View>
      </Card>
      <PillButton titulo="Volver al inicio" style={{ marginTop: 20 }} onPress={() => { onCerrar(); irA('inicio'); }} />
      <PillButton titulo="Ver mis ganancias" variante="secundario" style={{ marginTop: 12 }}
        onPress={() => { onCerrar(); irA('ganancias'); }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIN PASEO EN CURSO
// ─────────────────────────────────────────────────────────────────────────────

function SinPaseo({ empezarPaseo, abrirChat, irA }) {
  const [agenda, setAgenda] = useState(null);

  useEffect(() => {
    fetchMisPaseos(['aceptado']).then(setAgenda).catch(() => setAgenda([]));
  }, []);

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <Vacio icono="walk-outline" titulo="No tenés un paseo en curso"
        texto="Cuando inicies un paseo vas a ver el mapa, el tiempo y la distancia en vivo." />
      {agenda?.length ? (
        <>
          <Seccion titulo="Listos para iniciar" />
          {agenda.map((p) => (
            <PaseoCard key={p.id} paseo={p} onChat={() => abrirChat(p)} mostrarNotas={false}>
              <PillButton titulo="Iniciar paseo" icono="play" chico onPress={() => empezarPaseo(p)} style={{ flex: 1 }} />
            </PaseoCard>
          ))}
        </>
      ) : agenda ? (
        <PillButton titulo="Ver solicitudes" variante="secundario" onPress={() => irA('solicitudes')} />
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 32 },

  topBar: {
    position: 'absolute', top: 14, left: 14, right: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  vivo: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 1, marginRight: 10, ...sombra,
  },
  vivoPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.rojo },
  vivoTxt: { fontSize: 12, fontWeight: '800', color: C.texto, flexShrink: 1 },
  mapBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', ...sombra,
  },
  gps: {
    position: 'absolute', top: 70, left: 14, right: 74, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF6E5', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
  },
  gpsTxt: { flex: 1, fontSize: 12, color: C.texto, fontWeight: '600' },

  flotante: {
    position: 'absolute', left: 12, right: 12, bottom: 12,
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
  },
  mascotaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mascota: { fontSize: 18, fontWeight: '800', color: C.texto },
  mascotaSub: { fontSize: 13, color: C.texto2, marginTop: 1 },
  chat: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.menta, alignItems: 'center', justifyContent: 'center' },

  numeros: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  timer: { fontSize: 44, fontWeight: '900', color: C.texto, fontVariant: ['tabular-nums'] },
  distancia: { fontSize: 30, fontWeight: '900', color: C.texto, fontVariant: ['tabular-nums'] },
  numEtiqueta: { fontSize: 12, fontWeight: '700', color: C.texto2, textTransform: 'uppercase', letterSpacing: 0.5 },
  numDivisor: { width: 1, alignSelf: 'stretch', backgroundColor: '#EFEFEF', marginHorizontal: 14 },

  barra: { height: 8, borderRadius: 4, backgroundColor: C.menta, marginTop: 14, overflow: 'hidden' },
  barraFill: { height: 8, borderRadius: 4, backgroundColor: C.teal },
  barraTxt: { fontSize: 12, color: C.texto2, fontWeight: '600', marginTop: 6 },

  acciones: { flexDirection: 'row', gap: 10, marginTop: 14 },

  resumenTop: { alignItems: 'center', marginVertical: 18 },
  resumenTitulo: { fontSize: 22, fontWeight: '900', color: C.texto, marginTop: 14, textAlign: 'center' },
  resumenSub: { fontSize: 14, color: C.texto2, marginTop: 4 },
  cobradoLabel: { fontSize: 13, fontWeight: '700', color: C.texto2 },
  cobrado: { fontSize: 44, fontWeight: '900', color: C.teal, marginTop: 2 },
  stats: { flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
});
