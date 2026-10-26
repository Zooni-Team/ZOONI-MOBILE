/**
 * InicioTab.jsx — Tab 1 de Zooni Paseadores
 *
 *   · Toggle "Disponible" (el control más importante de la app)
 *   · Paseo en curso: TODAS las mascotas que se están paseando (un grupo),
 *     cada una con su tiempo y sus botones de pausar y finalizar
 *   · Resumen del día: cobrado, paseos y km — números grandes
 *   · Próximo paseo con mini mapa e "Iniciar paseo" (o "Sumar al paseo" si
 *     ya hay mascotas en curso)
 *   · Aviso de solicitudes nuevas
 */

import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  C, Card, PillButton, Seccion, Stat, SwitchGrande, Vacio,
} from '../../../components/paseador/PaseadorUI';
import MapaPaseo from '../../../components/paseador/MapaPaseo';
import MapaPaseoModal from '../../../components/paseador/MapaPaseoModal';
import PaseoCard from '../../../components/paseador/PaseoCard';
import { FilaPaseo } from './PaseoTab';
import {
  cuandoDe, enModoDemo, fetchMisPaseos, formatoDistancia, formatoPlata, setDisponible,
} from '../../../services/paseadorApi';

function inicioDeHoy() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function InicioTab({
  perfil, setPerfil, solicitudes, paseosActivos, ocupado, empezarPaseo, pausarOReanudar, pausarOReanudarTodos,
  finalizar, abrirChat, irA, avisar,
}) {
  const [hoy, setHoy] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [refrescando, setRefrescando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Paseo cuyo mapa se está viendo en grande (null = cerrado)
  const [mapaAmpliado, setMapaAmpliado] = useState(null);
  const [, setTick] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const [finalizados, aceptados] = await Promise.all([
        fetchMisPaseos(['finalizado'], { desde: inicioDeHoy() }),
        fetchMisPaseos(['aceptado']),
      ]);
      setHoy(finalizados);
      setAgenda(aceptados);
    } catch {
      // queda lo anterior
    }
  }, []);

  // Al iniciar o finalizar una mascota cambian la agenda y lo cobrado hoy
  useEffect(() => { cargar(); }, [cargar, paseosActivos.length]);

  // Los timers del paseo en curso avanzan solos
  const alguienCamina = paseosActivos.some((p) => p.reanudadoEn);
  useEffect(() => {
    if (!alguienCamina) return undefined;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [alguienCamina]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const cambiarDisponible = async (valor) => {
    setPerfil((p) => ({ ...p, disponible: valor })); // optimista
    setGuardando(true);
    try {
      await setDisponible(valor);
      avisar(valor ? 'Estás disponible: te van a llegar solicitudes' : 'Pausaste las solicitudes', valor ? 'radio-button-on' : 'pause-circle');
    } catch {
      setPerfil((p) => ({ ...p, disponible: !valor }));
      avisar('No se pudo cambiar tu estado. Probá de nuevo.', 'alert-circle');
    } finally {
      setGuardando(false);
    }
  };

  const cobradoHoy = hoy.reduce((acc, p) => acc + p.precio, 0);
  const kmHoy = hoy.reduce((acc, p) => acc + (p.distanciaMetros ?? 0), 0);
  const proximo = agenda[0] ?? null;
  const disponible = !!perfil?.disponible;
  // Dirigidas a mí: siempre. Abiertas: sólo si estoy disponible
  const nuevas = disponible ? solicitudes : solicitudes.filter((x) => !x.abierta);

  return (
    <ScrollView
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
    >
      {enModoDemo() && (
        <View style={s.demo}>
          <Ionicons name="flask-outline" size={16} color={C.ambar} />
          <Text style={s.demoTxt}>Modo demo: los datos son de ejemplo hasta correr la migración 035.</Text>
        </View>
      )}

      {/* ── Disponible ─────────────────────────────────────────────── */}
      <View style={[s.disponible, disponible ? s.disponibleOn : s.disponibleOff]}>
        <View style={{ flex: 1 }}>
          <Text style={s.dispTitulo}>{disponible ? 'Estás disponible' : 'No estás disponible'}</Text>
          <Text style={s.dispTxt}>
            {disponible
              ? 'Te llegan solicitudes de paseo de tu zona.'
              : 'Activalo cuando estés listo para recibir paseos.'}
          </Text>
        </View>
        <SwitchGrande valor={disponible} onCambio={cambiarDisponible} disabled={guardando} />
      </View>

      {/* ── Paseo en curso ─────────────────────────────────────────── */}
      {paseosActivos.length > 0 && (
        <View style={s.enCurso}>
          <TouchableOpacity style={s.enCursoHeader} onPress={() => irA('paseo')} activeOpacity={0.8}
            accessibilityRole="button" accessibilityLabel="Ver el paseo en el mapa">
            <View style={[s.enVivo, !alguienCamina && { backgroundColor: C.gris }]} />
            <Text style={s.enCursoTitulo} numberOfLines={1}>
              {paseosActivos.length === 1
                ? `Paseando a ${paseosActivos[0].mascota.nombre}`
                : `Paseando ${paseosActivos.length} mascotas`}
            </Text>
            <Text style={s.verMapa}>Ver mapa ›</Text>
          </TouchableOpacity>
          {paseosActivos.map((p) => (
            <FilaPaseo key={p.id} paseo={p} ocupado={ocupado === p.id || ocupado === 'todos'}
              onPausa={() => pausarOReanudar(p)} onFinalizar={() => finalizar(p)} onChat={() => abrirChat(p)} />
          ))}
          {paseosActivos.length > 1 && (
            <PillButton titulo={alguienCamina ? 'Pausar a todos' : 'Reanudar a todos'} icono={alguienCamina ? 'pause' : 'play'}
              variante="secundario" chico onPress={pausarOReanudarTodos} cargando={ocupado === 'todos'}
              style={{ marginTop: 10 }} />
          )}
        </View>
      )}

      {/* ── Resumen del día ────────────────────────────────────────── */}
      <Seccion titulo="Tu día" accion="Ver ganancias" onAccion={() => irA('ganancias')} />
      <Card>
        <Text style={s.cobradoLabel}>Cobraste hoy</Text>
        <Text style={s.cobrado}>{formatoPlata(cobradoHoy)}</Text>
        <View style={s.stats}>
          <Stat valor={String(hoy.length)} etiqueta={hoy.length === 1 ? 'paseo' : 'paseos'} icono="paw" />
          <View style={s.divisor} />
          <Stat valor={formatoDistancia(kmHoy)} etiqueta="caminados" icono="footsteps" />
          <View style={s.divisor} />
          <Stat valor={String(agenda.length)} etiqueta="agendados" icono="calendar" />
        </View>
      </Card>

      {/* ── Solicitudes nuevas ─────────────────────────────────────── */}
      {nuevas.length > 0 && (
        <TouchableOpacity style={s.nuevas} onPress={() => irA('solicitudes')} activeOpacity={0.9}>
          <View style={s.nuevasBadge}>
            <Text style={s.nuevasNum}>{nuevas.length}</Text>
          </View>
          <Text style={s.nuevasTxt}>
            {nuevas.length === 1 ? 'Tenés una solicitud nueva' : `Tenés ${nuevas.length} solicitudes nuevas`}
          </Text>
          <Ionicons name="chevron-forward" size={22} color={C.texto} />
        </TouchableOpacity>
      )}

      {/* ── Próximo paseo ──────────────────────────────────────────── */}
      <Seccion titulo="Próximo paseo" accion={agenda.length > 1 ? `Ver agenda (${agenda.length})` : null}
        onAccion={() => irA('solicitudes')} />
      {proximo ? (
        <View>
          {proximo.lat != null && (
            /*
              Tocar el mini mapa lo abre a pantalla completa. Antes era una
              imagen muerta: con 150 px y sin zoom no se podía ver por dónde
              llegar, y tocarlo no hacía nada.

              El toque va en un contenedor que envuelve al mapa (y no dentro de
              MapaPaseo) porque en web el mapa es un <iframe>: se come los
              eventos, así que la capa que recibe el toque tiene que estar
              ENCIMA — es lo que hace `s.miniMapaTapa`.
            */
            <View style={s.miniMapa}>
              <MapaPaseo destino={{ lat: proximo.lat, lng: proximo.lng }}
                centro={{ lat: proximo.lat, lng: proximo.lng }} interactivo={false} style={{ flex: 1 }} />
              <TouchableOpacity
                style={s.miniMapaTapa}
                onPress={() => setMapaAmpliado(proximo)}
                accessibilityRole="button"
                accessibilityLabel={`Ver en el mapa dónde buscar a ${proximo.mascota.nombre}`}
              />
              <View style={s.miniMapaChip} pointerEvents="none">
                <Ionicons name="location" size={13} color={C.teal} />
                <Text style={s.miniMapaTxt} numberOfLines={1}>{proximo.direccion ?? 'Ubicación del paseo'}</Text>
              </View>
              <View style={s.miniMapaLupa} pointerEvents="none">
                <Ionicons name="expand" size={15} color={C.texto} />
              </View>
            </View>
          )}
          <PaseoCard paseo={proximo} onChat={() => abrirChat(proximo)} mostrarNotas
            style={proximo.lat != null ? s.cardBajoMapa : null}>
            <PillButton
              titulo={paseosActivos.length ? 'Sumar al paseo' : 'Iniciar paseo'}
              icono={paseosActivos.length ? 'add' : 'play'}
              cargando={ocupado === proximo.id}
              onPress={() => empezarPaseo(proximo)}
              style={{ flex: 1 }}
            />
          </PaseoCard>
          <Text style={s.tip}>
            {paseosActivos.length
              ? `Sumá a ${proximo.mascota.nombre} al grupo cuando la tengas con la correa puesta.`
              : `Iniciá el paseo cuando tengas a ${proximo.mascota.nombre} con la correa puesta.`}
          </Text>
        </View>
      ) : (
        <Card>
          <Vacio
            icono="calendar-outline"
            titulo="No tenés paseos agendados"
            texto={disponible
              ? 'Cuando aceptes una solicitud, aparece acá.'
              : 'Activá "Disponible" para empezar a recibir solicitudes.'}
          />
        </Card>
      )}

      {!!proximo && agenda.length > 1 && (
        <Text style={s.siguiente}>Después: {agenda[1].mascota.nombre} · {cuandoDe(agenda[1].fecha)}</Text>
      )}

      <MapaPaseoModal
        visible={!!mapaAmpliado}
        onCerrar={() => setMapaAmpliado(null)}
        destino={mapaAmpliado ? { lat: mapaAmpliado.lat, lng: mapaAmpliado.lng } : null}
        direccion={mapaAmpliado?.direccion}
        mascota={mapaAmpliado?.mascota?.nombre}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 32 },

  demo: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF6E5',
    borderRadius: 12, padding: 10, marginBottom: 14,
  },
  demoTxt: { flex: 1, fontSize: 12, color: C.texto, fontWeight: '600' },

  disponible: {
    flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 18,
  },
  disponibleOn: { backgroundColor: C.menta },
  disponibleOff: { backgroundColor: '#F1F1F1' },
  dispTitulo: { fontSize: 20, fontWeight: '900', color: C.texto },
  dispTxt: { fontSize: 13, color: C.texto2, marginTop: 3, lineHeight: 18 },

  enCurso: {
    marginTop: 14, backgroundColor: C.card, borderRadius: 18, padding: 12, borderWidth: 2, borderColor: C.teal,
  },
  enCursoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 4, minHeight: 32 },
  enVivo: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.rojo },
  enCursoTitulo: { flex: 1, fontSize: 16, fontWeight: '800', color: C.texto },
  verMapa: { fontSize: 13, fontWeight: '800', color: C.teal },

  cobradoLabel: { fontSize: 13, fontWeight: '700', color: C.texto2 },
  cobrado: { fontSize: 40, fontWeight: '900', color: C.texto, marginTop: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  divisor: { width: 1, alignSelf: 'stretch', backgroundColor: '#F0F0F0', marginHorizontal: 12 },

  nuevas: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14,
    backgroundColor: C.amarillo, borderRadius: 30, paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  nuevasBadge: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  nuevasNum: { fontSize: 16, fontWeight: '900', color: C.texto },
  nuevasTxt: { flex: 1, fontSize: 15, fontWeight: '800', color: C.texto },

  miniMapa: { height: 150, borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  // Capa transparente ENCIMA del mapa: en web el mapa es un iframe y se queda
  // con los eventos, así que el toque tiene que recibirse acá arriba.
  miniMapaTapa: { ...StyleSheet.absoluteFillObject },
  miniMapaLupa: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  miniMapaChip: {
    position: 'absolute', left: 10, bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6,
  },
  miniMapaTxt: { flex: 1, fontSize: 12, fontWeight: '700', color: C.texto },
  cardBajoMapa: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  tip: { fontSize: 13, color: C.texto2, textAlign: 'center', marginTop: 2 },
  siguiente: { fontSize: 13, color: C.texto2, marginTop: 10, textAlign: 'center' },
});
