/**
 * TurnosTab.jsx — Turnos de la veterinaria / peluquería
 *
 *   Por confirmar  lo que pidieron los dueños (urgencias primero):
 *                  Confirmar · Rechazar (con motivo opcional)
 *   Agenda         día por día (hoy y las próximas 2 semanas), con los
 *                  confirmados y los por confirmar. Al atender: veterinaria →
 *                  informe de la consulta; peluquería → fotos y notas del
 *                  trabajo. También "No vino" y "Cancelar".
 *   Historial      los últimos 60 días; tocar uno atendido corrige su informe.
 *
 * Cada cambio le llega al dueño como notificación (negocioApi).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { C, PillButton, Vacio } from '../../../components/paseador/PaseadorUI';
import { MotivoModal, Segmento, TurnoCard } from '../../../components/negocio/NegocioUI';
import InformeModal from '../../../components/negocio/InformeModal';
import {
  actualizarDatos, cambiarEstadoTurno, fetchTurnosNegocio, formatoPlata, guardarInforme, GALERIA_MAX,
} from '../../../services/negocioApi';
import { confirmar } from '../../../utils/dialogo';

const DIAS_AGENDA = 14;
const mismoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

function diasAgenda() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Array.from({ length: DIAS_AGENDA }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    return d;
  });
}

export default function TurnosTab({ negocio, setNegocio, tipo, avisar, abrirChat, refrescarBadges }) {
  const [turnos, setTurnos] = useState(null);
  const [vista, setVista] = useState('pendientes');
  const [dia, setDia] = useState(() => diasAgenda()[0]);
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState(null); // id del turno que se está guardando
  const [motivo, setMotivo] = useState(null); // { turno, estado }
  const [informe, setInforme] = useState(null); // { turno, editar }

  const cargar = useCallback(async () => {
    const desde = new Date(Date.now() - 60 * 86400000);
    try {
      setTurnos(await fetchTurnosNegocio(negocio.id, { desde }));
    } catch {
      setTurnos((t) => t ?? []);
      avisar('No se pudieron cargar los turnos.', 'alert-circle');
    }
  }, [negocio.id, avisar]);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await Promise.all([cargar(), refrescarBadges()]);
    setRefrescando(false);
  };

  const lista = turnos ?? [];
  const pendientes = useMemo(() => lista
    .filter((t) => t.estado === 'pendiente' && new Date(t.fecha).getTime() > Date.now() - 3600000)
    .sort((a, b) => (b.urgencia - a.urgencia) || (new Date(a.fecha) - new Date(b.fecha))), [lista]);
  const delDia = useMemo(() => lista
    .filter((t) => mismoDia(t.fecha, dia) && ['pendiente', 'confirmado', 'completado', 'ausente'].includes(t.estado))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)), [lista, dia]);
  const historial = useMemo(() => lista
    .filter((t) => ['completado', 'ausente', 'cancelado', 'rechazado'].includes(t.estado)
      || (t.estado === 'pendiente' && new Date(t.fecha).getTime() <= Date.now() - 3600000))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)), [lista]);

  const reemplazar = (nuevo) => setTurnos((ts) => ts.map((t) => (t.id === nuevo.id ? { ...t, ...nuevo } : t)));

  const cambiar = async (turno, estado, extra) => {
    setOcupado(turno.id);
    try {
      reemplazar(await cambiarEstadoTurno(negocio, turno, estado, extra));
      refrescarBadges();
      const textos = {
        confirmado: `Turno de ${turno.mascota.nombre} confirmado`,
        rechazado: 'Turno rechazado: le avisamos al dueño',
        cancelado: 'Turno cancelado: le avisamos al dueño',
        ausente: `Marcado: ${turno.mascota.nombre} no vino`,
        completado: tipo === 'veterinaria' ? 'Consulta guardada en la historia clínica' : '¡Listo! Le avisamos al dueño',
      };
      avisar(textos[estado] ?? 'Turno actualizado');
      return true;
    } catch (err) {
      avisar(err?.message === 'turno_cambiado'
        ? 'El turno cambió mientras tanto (¿lo canceló el dueño?). Actualizamos la lista.'
        : 'No se pudo actualizar el turno. Probá de nuevo.', 'alert-circle');
      cargar();
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const confirmarTurno = async (turno) => {
    // Si se pisa con otro confirmado, avisar antes (el dueño eligió de los
    // horarios libres, pero el negocio puede haber confirmado otro a mano)
    const ini = new Date(turno.fecha).getTime();
    const fin = ini + turno.duracionMin * 60000;
    const choca = lista.find((t) => t.id !== turno.id && t.estado === 'confirmado'
      && ini < new Date(t.fecha).getTime() + t.duracionMin * 60000 && fin > new Date(t.fecha).getTime());
    if (choca) {
      const ok = await confirmar('Se superpone con otro turno',
        `${choca.mascota.nombre} (${choca.servicio}) ya está confirmado en ese horario. ¿Confirmar igual?`,
        { textoOk: 'Confirmar igual' });
      if (!ok) return;
    }
    cambiar(turno, 'confirmado');
  };

  const marcarAusente = async (turno) => {
    const ok = await confirmar(`¿${turno.mascota.nombre} no vino?`, 'Queda registrado en su ficha.', { textoOk: 'No vino' });
    if (ok) cambiar(turno, 'ausente');
  };

  const guardarInformeModal = async (inf, { aGaleria }) => {
    const { turno, editar } = informe;
    if (editar) {
      reemplazar(await guardarInforme(negocio, turno, inf));
      avisar('Informe actualizado');
    } else {
      const ok = await cambiar(turno, 'completado', { informe: inf });
      if (!ok) return;
    }
    if (aGaleria && inf.fotos?.length) {
      const nuevas = inf.fotos.map((url) => ({ url, nota: `${turno.servicio} · ${turno.mascota.nombre}`, fecha: new Date().toISOString() }));
      try {
        setNegocio(await actualizarDatos(negocio, {
          galeria: [...nuevas, ...(negocio.datos?.galeria ?? [])].slice(0, GALERIA_MAX),
        }));
      } catch {
        // las fotos quedan en el informe igual
      }
    }
    setInforme(null);
  };

  if (turnos === null) return <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />;

  const acciones = (t) => {
    if (t.estado === 'pendiente') {
      return (
        <>
          <PillButton titulo="Rechazar" variante="secundario" chico disabled={ocupado === t.id}
            onPress={() => setMotivo({ turno: t, estado: 'rechazado' })} style={{ flex: 1 }} />
          <PillButton titulo="Confirmar" icono="checkmark" variante="teal" chico cargando={ocupado === t.id}
            onPress={() => confirmarTurno(t)} style={{ flex: 1.3 }} />
        </>
      );
    }
    if (t.estado === 'confirmado') {
      const yaEmpezo = new Date(t.fecha).getTime() <= Date.now() + 30 * 60000;
      return (
        <>
          {yaEmpezo ? (
            <PillButton titulo="No vino" variante="secundario" chico disabled={ocupado === t.id}
              onPress={() => marcarAusente(t)} style={{ flex: 1 }} />
          ) : (
            <PillButton titulo="Cancelar" variante="secundario" chico disabled={ocupado === t.id}
              onPress={() => setMotivo({ turno: t, estado: 'cancelado' })} style={{ flex: 1 }} />
          )}
          <PillButton titulo={tipo === 'veterinaria' ? 'Atender' : 'Terminado'} icono={tipo === 'veterinaria' ? 'medkit' : 'cut'}
            chico cargando={ocupado === t.id} onPress={() => setInforme({ turno: t, editar: false })} style={{ flex: 1.3 }} />
        </>
      );
    }
    return null;
  };

  const tarjeta = (t, mostrarFecha) => (
    <TurnoCard key={t.id} turno={t} mostrarFecha={mostrarFecha}
      onChat={() => abrirChat(t.idDueno, t.dueno.nombre)}
      onPress={t.estado === 'completado' ? () => setInforme({ turno: t, editar: true }) : undefined}>
      {acciones(t)}
    </TurnoCard>
  );

  const facturadoDia = delDia.filter((t) => t.estado === 'completado').reduce((a, t) => a + t.precio, 0);
  const aConfirmarDia = delDia.filter((t) => t.estado === 'pendiente').length;

  return (
    <View style={{ flex: 1 }}>
      <View style={s.top}>
        <Segmento
          opciones={[
            { key: 'pendientes', label: 'Por confirmar', badge: pendientes.length || null },
            { key: 'agenda', label: 'Agenda' },
            { key: 'historial', label: 'Historial' },
          ]}
          valor={vista}
          onCambio={setVista}
        />
        {vista === 'agenda' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dias}>
            {diasAgenda().map((d, i) => {
              const on = mismoDia(d, dia);
              const cant = lista.filter((t) => mismoDia(t.fecha, d) && ['pendiente', 'confirmado'].includes(t.estado)).length;
              return (
                <TouchableOpacity key={d.toISOString()} style={[s.dia, on && s.diaOn]} onPress={() => setDia(d)}>
                  <Text style={[s.diaNombre, on && s.diaTxtOn]}>
                    {i === 0 ? 'Hoy' : ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()]}
                  </Text>
                  <Text style={[s.diaNum, on && s.diaTxtOn]}>{d.getDate()}</Text>
                  {cant > 0 ? <View style={[s.diaPunto, on && { backgroundColor: '#FFF' }]} /> : <View style={s.diaPuntoVacio} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <FlatList
        data={vista === 'pendientes' ? pendientes : vista === 'agenda' ? delDia : historial}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={s.lista}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={C.teal} />}
        ListHeaderComponent={vista === 'agenda' && delDia.length ? (
          <Text style={s.resumenDia}>
            {delDia.length} {delDia.length === 1 ? 'turno' : 'turnos'}
            {aConfirmarDia ? ` · ${aConfirmarDia} por confirmar` : ''}
            {facturadoDia ? ` · facturado ${formatoPlata(facturadoDia)}` : ''}
          </Text>
        ) : null}
        ListEmptyComponent={
          <Vacio
            icono={vista === 'pendientes' ? 'checkmark-done-outline' : 'calendar-outline'}
            titulo={vista === 'pendientes' ? 'No hay turnos por confirmar'
              : vista === 'agenda' ? 'Día libre' : 'Todavía no hay historial'}
            texto={vista === 'pendientes'
              ? 'Cuando un dueño te pida un turno, aparece acá y te llega una notificación.'
              : vista === 'agenda' ? 'No tenés turnos para este día.' : undefined}
          />
        }
        renderItem={({ item }) => tarjeta(item, vista !== 'agenda')}
      />

      <MotivoModal
        visible={!!motivo}
        titulo={motivo?.estado === 'rechazado' ? '¿Rechazar el turno?' : '¿Cancelar el turno?'}
        texto={motivo ? `${motivo.turno.mascota.nombre} · ${motivo.turno.servicio}. Le avisamos al dueño.` : ''}
        textoOk={motivo?.estado === 'rechazado' ? 'Rechazar' : 'Cancelar turno'}
        placeholder="Ej: Ese día no tenemos cirujano. ¿Te sirve el jueves?"
        onCerrar={() => setMotivo(null)}
        onConfirmar={async (texto) => {
          const { turno, estado } = motivo;
          setMotivo(null);
          await cambiar(turno, estado, { motivo: texto });
        }}
      />
      <InformeModal
        visible={!!informe}
        tipo={tipo}
        turno={informe?.turno}
        editar={!!informe?.editar}
        onGuardar={guardarInformeModal}
        onCerrar={() => setInforme(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  dias: { gap: 8, paddingBottom: 4 },
  dia: {
    width: 54, paddingVertical: 8, borderRadius: 16, alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: C.borde,
  },
  diaOn: { backgroundColor: C.teal, borderColor: C.teal },
  diaNombre: { fontSize: 12, fontWeight: '700', color: C.texto2 },
  diaNum: { fontSize: 18, fontWeight: '900', color: C.texto },
  diaTxtOn: { color: '#FFFFFF' },
  diaPunto: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.teal, marginTop: 3 },
  diaPuntoVacio: { width: 6, height: 6, marginTop: 3 },
  lista: { padding: 20, paddingBottom: 40 },
  resumenDia: { fontSize: 13, fontWeight: '700', color: C.texto2, marginBottom: 10 },
});
