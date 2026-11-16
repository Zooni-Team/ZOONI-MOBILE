/**
 * paseador/chat.js — Chat entre dueño y paseador (tabla paseo_mensajes) y el
 * inbox, que muestra una conversación por persona aunque haya varios paseos.
 * Los mensajes nuevos llegan por Realtime (hooks/useRecargaEnVivo).
 */

import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { errorApp } from '../comun';
import { notificarPaseo, notificarDueno } from './avisos';
import { COLUMNAS_PASEO, enriquecer } from './paseos';

/**
 * Mensajes de una conversación.
 *
 * Acepta un id suelto o una LISTA de ids: como el inbox agrupa por persona, el
 * chat tiene que mostrar todo lo hablado con ella, aunque haya sido repartido
 * entre varios paseos. Antes cada paseo era un chat aparte y al empezar uno
 * nuevo la conversación arrancaba vacía, con lo anterior en otra fila del inbox.
 */
export async function getMensajesPaseo(idPaseo) {
  const yo = getCurrentUserId();
  const ids = (Array.isArray(idPaseo) ? idPaseo : [idPaseo]).filter((x) => x != null);
  if (!ids.length) return [];

  const { data, error } = await supabase.from('paseo_mensajes')
    .select('*').in('id_paseo', ids).order('fecha', { ascending: true });
  if (error) throw errorApp('error_base', error);
  return (data ?? []).map((m) => ({
    id: m.id, idPaseo: m.id_paseo, texto: m.texto, fecha: m.fecha, leido: m.leido,
    autor: m.id_user === yo ? 'yo' : 'otro',
  }));
}

export async function enviarMensajePaseo(paseo, texto) {
  const limpio = texto.trim().slice(0, 1000);
  if (!limpio) return getMensajesPaseo(paseo.id);
  const { error } = await supabase.from('paseo_mensajes').insert({
    id_paseo: paseo.id, id_user: getCurrentUserId(), texto: limpio, fecha: new Date().toISOString(),
  });
  if (error) throw error;
  const resumen = limpio.length > 80 ? `${limpio.slice(0, 80)}…` : limpio;
  if (getCurrentUserId() === paseo.idDueno) {
    notificarPaseo(paseo.idWalker, `Mensaje del dueño de ${paseo.mascota.nombre}`, resumen, 'chats');
  } else {
    notificarDueno(paseo, `Mensaje del paseador de ${paseo.mascota.nombre}`, resumen);
  }
  return getMensajesPaseo(paseo.id);
}

/** Marca leídos los mensajes recibidos. Acepta un id o una lista (ver getMensajesPaseo). */
export async function marcarLeidosPaseo(idPaseo) {
  const ids = (Array.isArray(idPaseo) ? idPaseo : [idPaseo]).filter((x) => x != null);
  if (!ids.length) return;
  await supabase.from('paseo_mensajes').update({ leido: true })
    .in('id_paseo', ids).neq('id_user', getCurrentUserId()).eq('leido', false);
}

/**
 * Una conversación por paseo, con el último mensaje y cuántos no leí.
 * rol 'paseador' → paseos donde soy el paseador (incluye solicitudes que me
 * llegaron); rol 'dueno' → paseos que pedí. Primero las que tienen mensajes
 * más recientes; después las activas sin mensajes todavía.
 */
export async function fetchConversacionesPaseo(rol = 'paseador') {
  const yo = getCurrentUserId();
  const columna = rol === 'paseador' ? 'Id_Walker' : 'Id_Dueno';
  const { data: filas, error } = await supabase.from('Paseo').select(COLUMNAS_PASEO)
    .eq(columna, yo)
    .in('Estado', ['pendiente', 'aceptado', 'en_curso', 'finalizado'])
    .order('CreadoEn', { ascending: false })
    .limit(40);
  if (error) return [];
  const paseos = await enriquecer(filas ?? []);
  if (!paseos.length) return [];

  const { data: msjs } = await supabase.from('paseo_mensajes')
    .select('id_paseo, id_user, texto, fecha, leido')
    .in('id_paseo', paseos.map((p) => p.id))
    .order('fecha', { ascending: false })
    .limit(500);
  const mensajes = msjs ?? [];

  const porPaseo = {};
  mensajes.forEach((m) => {
    if (!porPaseo[m.id_paseo]) porPaseo[m.id_paseo] = { ultimo: null, noLeidos: 0 };
    const c = porPaseo[m.id_paseo];
    if (!c.ultimo || new Date(m.fecha) > new Date(c.ultimo.fecha)) c.ultimo = m;
    if (m.id_user !== yo && !m.leido) c.noLeidos += 1;
  });

  const conversaciones = paseos
    .map((p) => {
      const c = porPaseo[p.id];
      return {
        paseo: p,
        ultimoMensaje: c?.ultimo?.texto ?? null,
        ultimoEsMio: c?.ultimo ? c.ultimo.id_user === yo : false,
        fecha: c?.ultimo?.fecha ?? p.creadoEn,
        noLeidos: c?.noLeidos ?? 0,
      };
    })
    // Sin mensajes y ya terminado: no hace falta en el inbox
    .filter((c) => c.ultimoMensaje || ['pendiente', 'aceptado', 'en_curso'].includes(c.paseo.estado));

  return agruparPorPersona(conversaciones, rol);
}

/*
  Una conversación POR PERSONA, no por paseo.

  El inbox salía de la tabla Paseo, así que cada paseo abría su propia fila:
  con el mismo dueño aparecían dos "perr perr", una por el paseo en curso y
  otra por la solicitud anterior. En un chat uno espera una entrada por
  persona, con todo el historial adentro.

  De cada persona se conserva el paseo MÁS VIVO como representante (es el que
  define el estado que se muestra y el que se abre al tocar), se suman los no
  leídos de todos sus paseos y se toma el mensaje más reciente entre todos.
  `idsPaseos` viaja al chat para poder mostrar el historial completo.
*/
const PRIORIDAD_ESTADO = { en_curso: 0, aceptado: 1, pendiente: 2, finalizado: 3 };

function agruparPorPersona(conversaciones, rol) {
  // El "otro" es el dueño si soy paseador, y el paseador si soy dueño.
  const idOtro = (p) => (rol === 'paseador' ? p.idDueno : p.idWalker);

  const porPersona = new Map();
  for (const c of conversaciones) {
    const clave = idOtro(c.paseo) ?? `paseo-${c.paseo.id}`; // sin contraparte: queda solo
    const previa = porPersona.get(clave);
    if (!previa) { porPersona.set(clave, { ...c, idsPaseos: [c.paseo.id] }); continue; }

    previa.idsPaseos.push(c.paseo.id);
    previa.noLeidos += c.noLeidos;

    // El último mensaje es el más nuevo de TODOS los paseos con esa persona
    if (c.ultimoMensaje && (!previa.ultimoMensaje || new Date(c.fecha) > new Date(previa.fecha))) {
      previa.ultimoMensaje = c.ultimoMensaje;
      previa.ultimoEsMio = c.ultimoEsMio;
      previa.fecha = c.fecha;
    }

    // Representante: el paseo más "vivo"; a igual estado, el más reciente
    const mejor = PRIORIDAD_ESTADO[c.paseo.estado] ?? 9;
    const actual = PRIORIDAD_ESTADO[previa.paseo.estado] ?? 9;
    if (mejor < actual
      || (mejor === actual && new Date(c.paseo.creadoEn) > new Date(previa.paseo.creadoEn))) {
      previa.paseo = c.paseo;
    }
  }

  return [...porPersona.values()].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

/** Total de mensajes sin leer en mis chats de paseo (para badges). */
export async function contarNoLeidosPaseo(rol = 'paseador') {
  const convs = await fetchConversacionesPaseo(rol).catch(() => []);
  return convs.reduce((acc, c) => acc + c.noLeidos, 0);
}
