/**
 * SolicitudesTab.jsx — Tab 2 de Zooni Paseadores
 *
 *   Nuevas  → pedidos pendientes con Aceptar (amarillo) / Rechazar (outline)
 *   Agenda  → paseos ya aceptados, con Iniciar / Cancelar
 *
 * Listas accionables en vez del swipe de Match: el paseador decide con una
 * mano, con botones grandes y la info siempre en el mismo orden.
 */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C, PillButton, Vacio } from '../../../components/paseador/PaseadorUI';
import PaseoCard from '../../../components/paseador/PaseoCard';
import {
  aceptarSolicitud, cancelarPaseo, fetchMisPaseos, rechazarSolicitud, setDisponible,
} from '../../../services/paseadorApi';
import { confirmar } from '../../../utils/dialogo';

// Se puede iniciar desde 1 hora antes del horario pactado
const VENTANA_INICIO_MS = 60 * 60 * 1000;

export default function SolicitudesTab({
  perfil, setPerfil, solicitudes, recargarSolicitudes, paseoActivo,
  empezarPaseo, abrirChat, irA, avisar,
}) {
  const [vista, setVista] = useState('nuevas');
  const [agenda, setAgenda] = useState([]);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState(null); // id del paseo con una acción en curso

  const cargarAgenda = useCallback(async () => {
    try {
      setAgenda(await fetchMisPaseos(['aceptado']));
    } catch {
      // queda lo anterior
    }
  }, []);

  useEffect(() => { cargarAgenda(); }, [cargarAgenda]);

  const refrescar = async () => {
    setRefrescando(true);
    await Promise.all([recargarSolicitudes(), cargarAgenda()]);
    setRefrescando(false);
  };

  const aceptar = async (paseo) => {
    setOcupado(paseo.id);
    try {
      const ok = await aceptarSolicitud(paseo);
      if (ok) {
        avisar(`¡Aceptaste el paseo de ${paseo.mascota.nombre}! Quedó en tu agenda.`);
      } else {
        avisar('Otro paseador la tomó antes', 'alert-circle');
      }
      await Promise.all([recargarSolicitudes(), cargarAgenda()]);
    } catch {
      avisar('No se pudo aceptar. Probá de nuevo.', 'alert-circle');
    } finally {
      setOcupado(null);
    }
  };

  const rechazar = async (paseo) => {
    const ok = await confirmar(
      `¿Rechazar el paseo de ${paseo.mascota.nombre}?`,
      paseo.abierta ? 'No te la vamos a volver a mostrar.' : 'Le avisamos al dueño para que busque otro paseador.',
      { textoOk: 'Rechazar', destructivo: true },
    );
    if (!ok) return;
    setOcupado(paseo.id);
    try {
      await rechazarSolicitud(paseo);
      await recargarSolicitudes();
    } catch {
      avisar('No se pudo rechazar. Probá de nuevo.', 'alert-circle');
    } finally {
      setOcupado(null);
    }
  };

  const cancelar = async (paseo) => {
    const ok = await confirmar(
      `¿Cancelar el paseo de ${paseo.mascota.nombre}?`,
      'El dueño va a recibir un aviso. Cancelar seguido baja tu reputación.',
      { textoOk: 'Cancelar paseo', textoCancelar: 'Volver', destructivo: true },
    );
    if (!ok) return;
    setOcupado(paseo.id);
    try {
      await cancelarPaseo(paseo);
      await cargarAgenda();
      avisar('Paseo cancelado. Le avisamos al dueño.', 'information-circle');
    } catch {
      avisar('No se pudo cancelar. Probá de nuevo.', 'alert-circle');
    } finally {
      setOcupado(null);
    }
  };

  const activar = async () => {
    setPerfil((p) => ({ ...p, disponible: true }));
    try {
      await setDisponible(true);
      await recargarSolicitudes();
    } catch {
      setPerfil((p) => ({ ...p, disponible: false }));
    }
  };

  const disponible = !!perfil?.disponible;
  // Las que un dueño me mandó a MÍ se ven siempre; las abiertas, sólo disponible
  const visibles = disponible ? solicitudes : solicitudes.filter((x) => !x.abierta);
  const datos = vista === 'nuevas' ? visibles : agenda;

  const renderNueva = ({ item }) => (
    <PaseoCard paseo={item} onChat={() => abrirChat(item)}>
      <PillButton titulo="Rechazar" variante="secundario" chico onPress={() => rechazar(item)}
        disabled={ocupado === item.id} style={{ flex: 1 }} />
      <PillButton titulo="Aceptar" icono="checkmark" chico onPress={() => aceptar(item)}
        cargando={ocupado === item.id} style={{ flex: 1.4 }} />
    </PaseoCard>
  );

  const renderAgenda = ({ item }) => {
    const falta = item.fecha ? new Date(item.fecha).getTime() - Date.now() : 0;
    const puedeIniciar = falta < VENTANA_INICIO_MS && !paseoActivo;
    return (
      <PaseoCard paseo={item} onChat={() => abrirChat(item)}>
        <PillButton titulo="Cancelar" variante="peligro" chico onPress={() => cancelar(item)}
          cargando={ocupado === item.id} style={{ flex: 1 }} />
        <PillButton
          titulo={puedeIniciar ? 'Iniciar paseo' : 'Todavía no'}
          icono={puedeIniciar ? 'play' : 'time-outline'}
          chico
          disabled={!puedeIniciar}
          onPress={() => empezarPaseo(item)}
          style={{ flex: 1.4 }}
        />
      </PaseoCard>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.segmento}>
        {[
          { key: 'nuevas', label: 'Nuevas', n: visibles.length },
          { key: 'agenda', label: 'Agenda', n: agenda.length },
        ].map((op) => {
          const on = vista === op.key;
          return (
            <TouchableOpacity key={op.key} style={[s.segBtn, on && s.segBtnOn]} onPress={() => setVista(op.key)}
              accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[s.segTxt, on && s.segTxtOn]}>{op.label}</Text>
              {op.n > 0 && (
                <View style={[s.segBadge, on && { backgroundColor: '#FFFFFF' }]}>
                  <Text style={[s.segBadgeTxt, on && { color: C.teal }]}>{op.n}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {vista === 'nuevas' && !disponible && (
        <View style={s.aviso}>
          <Ionicons name="pause-circle" size={22} color={C.texto2} />
          <Text style={s.avisoTxt}>Estás como no disponible: sólo ves los pedidos que te mandaron a vos.</Text>
          <TouchableOpacity onPress={activar} style={s.avisoBtn}>
            <Text style={s.avisoBtnTxt}>Activar</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={datos}
        keyExtractor={(p) => String(p.id)}
        renderItem={vista === 'nuevas' ? renderNueva : renderAgenda}
        contentContainerStyle={s.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
        ListEmptyComponent={
          vista === 'nuevas' ? (
            disponible ? (
              <Vacio icono="file-tray-outline" titulo="No hay solicitudes por ahora"
                texto="Te avisamos con la campana cuando llegue una. Deslizá hacia abajo para actualizar." />
            ) : null
          ) : (
            <Vacio icono="calendar-outline" titulo="Tu agenda está vacía"
              texto="Los paseos que aceptes aparecen acá.">
              <PillButton titulo="Ver solicitudes" variante="secundario" chico style={{ marginTop: 14 }}
                onPress={() => setVista('nuevas')} />
            </Vacio>
          )
        }
        ListFooterComponent={vista === 'agenda' && paseoActivo ? (
          <TouchableOpacity onPress={() => irA('paseo')}>
            <Text style={s.footer}>Tenés un paseo en curso con {paseoActivo.mascota.nombre} · Ver</Text>
          </TouchableOpacity>
        ) : null}
      />
    </View>
  );
}

const s = StyleSheet.create({
  segmento: {
    flexDirection: 'row', margin: 20, marginBottom: 6, padding: 4,
    backgroundColor: '#FFFFFF', borderRadius: 30, borderWidth: 1, borderColor: C.borde,
  },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 42, borderRadius: 26,
  },
  segBtnOn: { backgroundColor: C.teal },
  segTxt: { fontSize: 15, fontWeight: '700', color: C.texto2 },
  segTxtOn: { color: '#FFFFFF', fontWeight: '800' },
  segBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: C.ambar, alignItems: 'center', justifyContent: 'center',
  },
  segBadgeTxt: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 10,
    padding: 14, borderRadius: 16, backgroundColor: '#F1F1F1',
  },
  avisoTxt: { flex: 1, fontSize: 13, color: C.texto, fontWeight: '600' },
  avisoBtn: { backgroundColor: C.teal, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  avisoBtnTxt: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  lista: { padding: 20, paddingTop: 12, paddingBottom: 32, flexGrow: 1 },
  footer: { fontSize: 13, fontWeight: '700', color: C.teal, textAlign: 'center', marginTop: 6 },
});
