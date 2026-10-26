/**
 * PaseoTab.jsx — Tab 3 de Zooni Paseadores
 *
 * CON paseos en curso: mapa a pantalla completa + card flotante blanca.
 *   · Una mascota: su timer y su distancia en números grandes, y Pausar /
 *     Finalizar.
 *   · Un grupo: una fila por mascota con su tiempo, su distancia y sus propios
 *     botones de pausar y finalizar (cada una es un paseo aparte, con su
 *     dueño y su precio), más "Pausar todos". Tocar una fila marca su casa en
 *     el mapa.
 *   En los dos casos se puede sumar otra mascota de la agenda.
 *
 * SIN paseo en curso: los paseos aceptados listos para iniciar, o el resumen
 * del paseo que se acaba de terminar.
 *
 * COBRO: precio fijo, el pactado al contratar; el tiempo no suma ni resta.
 * Al terminar, el paseador anota si le pagaron o si el dueño le paga después
 * (cada semana / fin de mes, con recordatorio).
 *
 * TOQUES SIN QUERER: finalizar antes del tiempo pactado pide una segunda
 * confirmación, y en el resumen hay "Retomar paseo" durante RETOMAR_MINUTOS
 * por si igual se finalizó por error.
 *
 * Las acciones (pausar, finalizar…) y el GPS viven en PaseadorAppScreen /
 * useSeguimientoPaseos, así Inicio puede usarlas igual y el recorrido se
 * sigue registrando fuera de este tab.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar, C, Card, PillButton, Seccion, Stat, Vacio, sombra } from '../../../components/paseador/PaseadorUI';
import MapaPaseo from '../../../components/paseador/MapaPaseo';
import PaseoCard from '../../../components/paseador/PaseoCard';
import PagoFormModal from '../../../components/paseador/PagoFormModal';
import ModalidadCobro from '../../../components/paseador/ModalidadCobro';
import {
  COMISION_ZOONI, fetchCuentaCorriente, fetchMisPaseos,
  formatoDistancia, formatoPlata, formatoTimer, guardarModalidadCobro, formatoTiempoPaseado,
  registrarPago, RETOMAR_MINUTOS, retomarPaseo, segundosDePaseo, sePuedeRetomar,
} from '../../../services/paseadorApi';
import { confirmar } from '../../../utils/dialogo';

export default function PaseoTab(props) {
  const { paseosActivos, resumen, setResumen, retomado } = props;

  // Con el grupo todavía en curso, el resumen se abre encima (PaseadorAppScreen)
  if (resumen && !paseosActivos.length) {
    return <Resumen paseo={resumen} onCerrar={() => setResumen(null)} onRetomado={retomado} irA={props.irA} avisar={props.avisar} />;
  }
  if (paseosActivos.length) return <PaseoEnCurso {...props} />;
  return <SinPaseo {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// PASEO EN CURSO (una mascota o un grupo)
// ─────────────────────────────────────────────────────────────────────────────

function PaseoEnCurso({
  paseosActivos, perfil, seguimiento, ocupado, pausarOReanudar, pausarOReanudarTodos, finalizar,
  empezarPaseo, abrirChat, abrirMenu,
}) {
  const { posicion, ruta, gpsError } = seguimiento;
  const [elegidoId, setElegidoId] = useState(null);
  const [verSumar, setVerSumar] = useState(false);
  const [, setTick] = useState(0);
  const mapaApi = useRef(null);

  const grupo = paseosActivos.length > 1;
  // La mascota cuya casa se marca en el mapa (la primera si no se tocó ninguna)
  const elegido = paseosActivos.find((p) => p.id === elegidoId) ?? paseosActivos[0];
  const corriendo = paseosActivos.some((p) => p.reanudadoEn);
  const enPausa = paseosActivos.filter((p) => !p.reanudadoEn).length;
  const puedeSumar = paseosActivos.length < (perfil?.maxPerros ?? 3);

  // Timer: re-render cada segundo mientras alguno corre
  useEffect(() => {
    if (!corriendo) return undefined;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [corriendo]);

  const centrar = () => {
    if (posicion) mapaApi.current?.centrar(posicion.lat, posicion.lng);
  };

  const comoLlegar = () => {
    if (elegido.lat == null) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${elegido.lat},${elegido.lng}`).catch(() => {});
  };

  const estadoTxt = !corriendo
    ? (grupo ? 'Todos en pausa' : 'Paseo en pausa')
    : grupo
      ? `En vivo · ${paseosActivos.length} mascotas${enPausa ? ` (${enPausa} en pausa)` : ''}`
      : 'En vivo · el dueño ve tu recorrido';

  return (
    <View style={{ flex: 1 }}>
      <MapaPaseo
        style={StyleSheet.absoluteFill}
        posicion={posicion}
        destino={elegido.lat != null ? { lat: elegido.lat, lng: elegido.lng } : null}
        centro={elegido.lat != null ? { lat: elegido.lat, lng: elegido.lng } : undefined}
        ruta={ruta}
        seguir={corriendo}
        apiRef={mapaApi}
      />

      {/* Arriba: estado en vivo + controles del mapa */}
      <View style={s.topBar} pointerEvents="box-none">
        {/* Sin header en pantalla completa: el menú flota sobre el mapa */}
        <TouchableOpacity style={[s.mapBtn, { marginRight: 10 }]} onPress={abrirMenu} accessibilityLabel="Abrir menú">
          <Ionicons name="menu" size={24} color="#0A0A0A" />
        </TouchableOpacity>
        <View style={[s.vivo, !corriendo && { backgroundColor: '#F1F1F1' }]}>
          <View style={[s.vivoPunto, !corriendo && { backgroundColor: C.gris }]} />
          <Text style={s.vivoTxt}>{estadoTxt}</Text>
        </View>
        <View style={{ gap: 10 }}>
          <TouchableOpacity style={s.mapBtn} onPress={centrar} accessibilityLabel="Centrar en mi ubicación">
            <Ionicons name="locate" size={22} color={C.teal} />
          </TouchableOpacity>
          {elegido.lat != null && (
            <TouchableOpacity style={s.mapBtn} onPress={comoLlegar}
              accessibilityLabel={`Cómo llegar a la casa de ${elegido.mascota.nombre}`}>
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
        {grupo ? (
          <>
            <View style={s.grupoHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.grupoTitulo}>Paseando {paseosActivos.length} mascotas</Text>
                <Text style={s.mascotaSub}>Cada una se pausa y se finaliza por separado</Text>
              </View>
              <PillButton titulo={corriendo ? 'Pausar todos' : 'Reanudar todos'} icono={corriendo ? 'pause' : 'play'}
                variante="secundario" chico onPress={pausarOReanudarTodos} cargando={ocupado === 'todos'} />
            </View>
            <ScrollView style={s.grupoLista} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {paseosActivos.map((p) => (
                <FilaPaseo key={p.id} paseo={p} elegido={p.id === elegido.id} onElegir={() => setElegidoId(p.id)}
                  ocupado={ocupado === p.id || ocupado === 'todos'} onPausa={() => pausarOReanudar(p)}
                  onFinalizar={() => finalizar(p)} onChat={() => abrirChat(p)} />
              ))}
            </ScrollView>
          </>
        ) : (
          <PaseoUnico paseo={elegido} ocupado={ocupado === elegido.id} onPausa={() => pausarOReanudar(elegido)}
            onFinalizar={() => finalizar(elegido)} onChat={() => abrirChat(elegido)} />
        )}

        {puedeSumar && (
          <TouchableOpacity style={s.sumar} onPress={() => setVerSumar(true)} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={18} color={C.teal} />
            <Text style={s.sumarTxt}>Sumar otra mascota al paseo</Text>
          </TouchableOpacity>
        )}
      </View>

      <SumarMascotaModal visible={verSumar} onCerrar={() => setVerSumar(false)}
        onIniciar={async (p) => { setVerSumar(false); await empezarPaseo(p); }} ocupado={ocupado} />
    </View>
  );
}

/** Card de una sola mascota: timer y distancia grandes, como siempre. */
function PaseoUnico({ paseo, ocupado, onPausa, onFinalizar, onChat }) {
  const corriendo = !!paseo.reanudadoEn;
  const segundos = segundosDePaseo(paseo);
  const progreso = Math.min(1, segundos / (paseo.duracionMin * 60));
  return (
    <>
      <View style={s.mascotaRow}>
        <Avatar fuente={paseo.mascota.visual} nombre={paseo.mascota.nombre} size={48} borde />
        <View style={{ flex: 1 }}>
          <Text style={s.mascota}>{paseo.mascota.nombre}</Text>
          <Text style={s.mascotaSub} numberOfLines={1}>
            {paseo.duracionMin} minutos pactados · {formatoPlata(paseo.precio)}
          </Text>
        </View>
        <TouchableOpacity style={s.chat} onPress={onChat} accessibilityLabel="Chat con el dueño">
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
          <Text style={s.distancia}>{formatoDistancia(paseo.distanciaMetros)}</Text>
          <Text style={s.numEtiqueta}>distancia</Text>
        </View>
      </View>

      <View style={s.barra}>
        <View style={[s.barraFill, { width: `${progreso * 100}%` }, progreso >= 1 && { backgroundColor: C.amarillo }]} />
      </View>
      <Text style={s.barraTxt}>
        {progreso >= 1
          ? '¡Cumpliste el tiempo pactado!'
          : `Faltan ${formatoTiempoPaseado(paseo.duracionMin * 60 - segundos)}`}
      </Text>

      <View style={s.acciones}>
        <PillButton
          titulo={corriendo ? 'Pausar' : 'Reanudar'}
          icono={corriendo ? 'pause' : 'play'}
          variante="secundario"
          onPress={onPausa}
          disabled={ocupado}
          style={{ flex: 1 }}
        />
        <PillButton titulo="Finalizar" icono="flag" onPress={onFinalizar} cargando={ocupado} style={{ flex: 1.3 }} />
      </View>
    </>
  );
}

/** Una mascota del grupo: su tiempo, distancia, progreso y sus propios botones. */
export function FilaPaseo({ paseo, elegido = false, onElegir, ocupado, onPausa, onFinalizar, onChat }) {
  const corriendo = !!paseo.reanudadoEn;
  const segundos = segundosDePaseo(paseo);
  const progreso = Math.min(1, segundos / (paseo.duracionMin * 60));
  // Sin onElegir (en Inicio) la fila es un View: un Touchable deshabilitado
  // alrededor puede tragarse los toques de los botones en web
  const Contenedor = onElegir ? TouchableOpacity : View;
  const tocable = onElegir ? { onPress: onElegir, activeOpacity: 0.8 } : {};
  return (
    <Contenedor style={[s.fila, elegido && s.filaElegida]} {...tocable}
      accessibilityLabel={`${paseo.mascota.nombre}: ${corriendo ? 'caminando' : 'en pausa'}`}>
      <Avatar fuente={paseo.mascota.visual} nombre={paseo.mascota.nombre} size={40} />
      <View style={{ flex: 1 }}>
        <View style={s.filaTop}>
          <Text style={s.filaNombre} numberOfLines={1}>{paseo.mascota.nombre}</Text>
          {!corriendo && <Text style={s.filaPausa}>En pausa</Text>}
        </View>
        <Text style={[s.filaNumeros, !corriendo && { color: C.texto2 }]}>
          {formatoTimer(segundos)} · {formatoDistancia(paseo.distanciaMetros)}
        </Text>
        <View style={s.filaBarra}>
          <View style={[s.barraFill, { width: `${progreso * 100}%` }, progreso >= 1 && { backgroundColor: C.amarillo }]} />
        </View>
      </View>
      {onChat && (
        <TouchableOpacity style={s.filaBtn} onPress={onChat} accessibilityLabel={`Chat con el dueño de ${paseo.mascota.nombre}`}>
          <Ionicons name="chatbubble-ellipses" size={18} color={C.teal} />
        </TouchableOpacity>
      )}
      <TouchableOpacity style={s.filaBtn} onPress={onPausa} disabled={ocupado}
        accessibilityLabel={`${corriendo ? 'Pausar' : 'Reanudar'} a ${paseo.mascota.nombre}`}>
        {ocupado
          ? <ActivityIndicator size="small" color={C.teal} />
          : <Ionicons name={corriendo ? 'pause' : 'play'} size={18} color={C.teal} />}
      </TouchableOpacity>
      <TouchableOpacity style={[s.filaBtn, s.filaFin]} onPress={onFinalizar} disabled={ocupado}
        accessibilityLabel={`Finalizar el paseo de ${paseo.mascota.nombre}`}>
        <Ionicons name="flag" size={18} color={C.texto} />
      </TouchableOpacity>
    </Contenedor>
  );
}

/** Lista de la agenda para sumar otra mascota al paseo que está en curso. */
function SumarMascotaModal({ visible, onCerrar, onIniciar, ocupado }) {
  const [agenda, setAgenda] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setAgenda(null);
    fetchMisPaseos(['aceptado']).then(setAgenda).catch(() => setAgenda([]));
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <TouchableOpacity style={s.sheetFondo} activeOpacity={1} onPress={onCerrar}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitulo}>Sumar al paseo</Text>
            <TouchableOpacity onPress={onCerrar} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={C.texto} />
            </TouchableOpacity>
          </View>
          {agenda == null ? (
            <ActivityIndicator color={C.teal} style={{ marginVertical: 30 }} />
          ) : agenda.length ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
              {agenda.map((p) => (
                <PaseoCard key={p.id} paseo={p} mostrarNotas={false}>
                  <PillButton titulo="Iniciar y sumar" icono="play" chico onPress={() => onIniciar(p)}
                    cargando={ocupado === p.id} style={{ flex: 1 }} />
                </PaseoCard>
              ))}
            </ScrollView>
          ) : (
            <Vacio icono="calendar-outline" titulo="No tenés otros paseos aceptados"
              texto="Cuando aceptes otra solicitud, la vas a poder sumar acá." />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN DEL PASEO TERMINADO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `enGrupo` = cuántas mascotas siguen en curso (0 si era la única): en ese caso
 * se muestra encima del paseo y el botón principal vuelve al grupo.
 */
export function Resumen({ paseo, onCerrar, onRetomado, irA, avisar, enGrupo = 0 }) {
  const [cuenta, setCuenta] = useState(null);
  const [retomando, setRetomando] = useState(false);
  const [puedeRetomar, setPuedeRetomar] = useState(() => sePuedeRetomar(paseo));

  // El botón "Retomar paseo" se va solo cuando pasa el plazo
  useEffect(() => {
    if (!puedeRetomar) return undefined;
    const t = setInterval(() => setPuedeRetomar(sePuedeRetomar(paseo)), 15000);
    return () => clearInterval(t);
  }, [paseo, puedeRetomar]);

  const retomar = async () => {
    const ok = await confirmar(
      `¿Retomar el paseo de ${paseo.mascota.nombre}?`,
      'Sigue contando desde el tiempo y la distancia que llevabas. Le avisamos al dueño que el paseo sigue en curso.',
      { textoOk: 'Retomar paseo' },
    );
    if (!ok) return;
    setRetomando(true);
    try {
      onRetomado(await retomarPaseo(paseo));
      avisar?.('Paseo retomado', 'play-circle');
    } catch {
      setRetomando(false);
      avisar?.('No se pudo retomar el paseo. Probá de nuevo.', 'alert-circle');
    }
  };
  const [cobro, setCobro] = useState(null); // null · 'pagado' · 'despues'
  const [verForm, setVerForm] = useState(false);

  const cargarCuenta = useCallback(() => {
    fetchCuentaCorriente(paseo.idDueno).then(setCuenta).catch(() => {});
  }, [paseo.idDueno]);
  useEffect(() => { cargarCuenta(); }, [cargarCuenta]);

  const pactado = paseo.precioPactado ?? paseo.precio;
  const proporcional = paseo.precio < pactado;
  const comision = paseo.comision ?? 0;
  const saldo = cuenta?.saldo ?? paseo.precio;

  const guardarPago = async (datos) => {
    await registrarPago({ ...datos, idDueno: paseo.idDueno });
    setVerForm(false);
    setCobro('pagado');
    avisar?.('Pago registrado');
    cargarCuenta();
  };

  const cambiarModalidad = async (modalidad) => {
    try {
      await guardarModalidadCobro(paseo.idDueno, modalidad);
      cargarCuenta();
    } catch (err) {
      avisar?.(err?.message === 'migracion_pendiente'
        ? 'Es necesario correr la migración 045 en Supabase.'
        : 'No se pudo guardar. Probá de nuevo.', 'alert-circle');
    }
  };

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.resumenTop}>
        <Avatar fuente={paseo.mascota.visual} nombre={paseo.mascota.nombre} size={88} borde />
        <Text style={s.resumenTitulo}>¡{paseo.mascota.nombre} ya volvió a casa!</Text>
        <Text style={s.resumenSub}>Le avisamos a {paseo.dueno.nombre}.</Text>
      </View>
      {puedeRetomar && (
        <TouchableOpacity style={s.retomar} onPress={retomar} disabled={retomando} activeOpacity={0.85}
          accessibilityRole="button" accessibilityLabel="Retomar paseo">
          <Ionicons name="arrow-undo" size={18} color={C.teal} />
          <View style={{ flex: 1 }}>
            <Text style={s.retomarTitulo}>{retomando ? 'Retomando…' : '¿Lo finalizaste sin querer? Retomar paseo'}</Text>
            <Text style={s.retomarSub}>Podés hacerlo durante {RETOMAR_MINUTOS} minutos.</Text>
          </View>
        </TouchableOpacity>
      )}
      <Card>
        <Text style={s.cobradoLabel}>Ganaste</Text>
        <Text style={s.cobrado}>{formatoPlata(paseo.precio)}</Text>
        <Text style={s.tarifa}>
          {proporcional
            ? `${formatoTiempoPaseado(paseo.segundosAcumulados)} de ${paseo.duracionMin} minutos · tarifa ${formatoPlata(pactado)}`
            : `Paseo completo de ${paseo.duracionMin} minutos`}
        </Text>
        {comision > 0 && (
          <View style={s.comision}>
            <View style={s.comisionFila}>
              <Text style={s.comisionTxt}>Comisión Zooni ({Math.round(COMISION_ZOONI * 100)} %)</Text>
              <Text style={s.comisionTxt}>−{formatoPlata(comision)}</Text>
            </View>
            <View style={s.comisionFila}>
              <Text style={s.netoTxt}>Te queda</Text>
              <Text style={s.netoTxt}>{formatoPlata(paseo.precio - comision)}</Text>
            </View>
          </View>
        )}
        <View style={s.stats}>
          <Stat valor={formatoTimer(paseo.segundosAcumulados)} etiqueta="tiempo" icono="time" />
          <Stat valor={formatoDistancia(paseo.distanciaMetros)} etiqueta="distancia" icono="footsteps" />
        </View>
      </Card>

      {/* Cobro: ¿le pagó ahora o lo anota en la cuenta corriente? */}
      <Card style={{ marginTop: 14 }}>
        {cobro === 'pagado' ? (
          <View style={s.cobroOk}>
            <Ionicons name="checkmark-circle" size={22} color={C.teal} />
            <Text style={s.cobroOkTxt}>
              Pago registrado · {saldo > 0 ? `todavía te debe ${formatoPlata(saldo)}` : saldo < 0 ? `tiene ${formatoPlata(-saldo)} a favor` : 'está al día'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.cobroTitulo}>¿{paseo.dueno.nombre} te pagó este paseo?</Text>
            {cuenta && saldo > paseo.precio ? (
              <Text style={s.cobroSub}>Con este paseo te debe {formatoPlata(saldo)} en total.</Text>
            ) : null}
            <View style={s.cobroBotones}>
              <PillButton titulo="Me pagó" icono="cash-outline" chico variante="teal"
                onPress={() => setVerForm(true)} style={{ flex: 1 }} />
              <PillButton titulo="Me paga después" icono="time-outline" chico
                variante={cobro === 'despues' ? 'primario' : 'secundario'}
                onPress={() => setCobro('despues')} style={{ flex: 1 }} />
            </View>
            {cobro === 'despues' && (
              <>
                <Text style={s.cobroSub}>Queda anotado en su cuenta corriente: te debe {formatoPlata(saldo)}.</Text>
                <ModalidadCobro modalidad={cuenta?.modalidad} proximoCierre={cuenta?.proximoCierre}
                  onCambiar={cambiarModalidad} />
              </>
            )}
          </>
        )}
      </Card>

      {enGrupo > 0 ? (
        <PillButton titulo={`Seguir paseando · ${enGrupo} ${enGrupo === 1 ? 'mascota' : 'mascotas'}`} icono="walk"
          style={{ marginTop: 20 }} onPress={() => { onCerrar(); irA('paseo'); }} />
      ) : (
        <PillButton titulo="Volver al inicio" style={{ marginTop: 20 }} onPress={() => { onCerrar(); irA('inicio'); }} />
      )}
      <PillButton titulo="Ver cuenta corriente" variante="secundario" style={{ marginTop: 12 }}
        onPress={() => { onCerrar(); irA('pagos'); }} />

      <PagoFormModal
        visible={verForm}
        dueno={paseo.dueno}
        saldo={saldo}
        montoInicial={paseo.precio}
        medioSugerido={cuenta?.medioPreferido}
        pago={null}
        onGuardar={guardarPago}
        onCerrar={() => setVerForm(false)}
      />
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
    flexDirection: 'row', alignItems: 'flex-start',
  },
  vivo: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 1, flex: 1, marginRight: 10, marginTop: 4, ...sombra,
  },
  vivoPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.rojo },
  vivoTxt: { fontSize: 12, fontWeight: '800', color: C.texto, flexShrink: 1 },
  mapBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', ...sombra,
  },
  gps: {
    position: 'absolute', top: 70, left: 70, right: 74, flexDirection: 'row', alignItems: 'center', gap: 6,
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

  grupoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  grupoTitulo: { fontSize: 18, fontWeight: '800', color: C.texto },
  grupoLista: { maxHeight: 290 },
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 14, borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
  },
  filaElegida: { backgroundColor: '#F2FBF5' },
  filaTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filaNombre: { fontSize: 15, fontWeight: '800', color: C.texto, flexShrink: 1 },
  filaPausa: {
    fontSize: 11, fontWeight: '800', color: C.texto2, backgroundColor: '#F1F1F1',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden',
  },
  filaNumeros: { fontSize: 14, fontWeight: '800', color: C.teal, marginTop: 1, fontVariant: ['tabular-nums'] },
  filaBarra: { height: 5, borderRadius: 3, backgroundColor: C.menta, marginTop: 5, overflow: 'hidden' },
  filaBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.menta,
    alignItems: 'center', justifyContent: 'center',
  },
  filaFin: { backgroundColor: C.amarillo },
  sumar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, minHeight: 32 },
  sumarTxt: { fontSize: 14, fontWeight: '800', color: C.teal },

  sheetFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.fondo, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitulo: { fontSize: 19, fontWeight: '800', color: C.texto },

  resumenTop: { alignItems: 'center', marginVertical: 18 },
  resumenTitulo: { fontSize: 22, fontWeight: '900', color: C.texto, marginTop: 14, textAlign: 'center' },
  resumenSub: { fontSize: 14, color: C.texto2, marginTop: 4 },
  retomar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1.5, borderColor: C.teal, borderStyle: 'dashed', padding: 12, marginBottom: 14,
  },
  retomarTitulo: { fontSize: 14, fontWeight: '800', color: C.teal },
  retomarSub: { fontSize: 12, color: C.texto2, marginTop: 1 },
  cobradoLabel: { fontSize: 13, fontWeight: '700', color: C.texto2 },
  cobrado: { fontSize: 44, fontWeight: '900', color: C.teal, marginTop: 2 },
  tarifa: { fontSize: 13, fontWeight: '600', color: C.texto2, marginTop: 2 },
  comision: { marginTop: 12, gap: 4 },
  comisionFila: { flexDirection: 'row', justifyContent: 'space-between' },
  comisionTxt: { fontSize: 13, color: C.texto2, fontWeight: '600' },
  netoTxt: { fontSize: 14, color: C.texto, fontWeight: '800' },

  cobroTitulo: { fontSize: 16, fontWeight: '800', color: C.texto },
  cobroSub: { fontSize: 13, color: C.texto2, marginTop: 6 },
  cobroBotones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cobroOk: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cobroOkTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: C.texto },
  stats: { flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
});
