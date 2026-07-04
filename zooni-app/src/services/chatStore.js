/**
 * chatStore.js — Chat de Match sobre Supabase (tabla Mensaje)
 *
 * `chatId` es directamente el id de la fila en la tabla Match. Reemplaza el
 * storage local (una sola clave gigante en SecureStore/localStorage) que
 * usaba antes.
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';

function mapRow(row) {
  return {
    id: row.id,
    texto: row.texto,
    autor: row.idUsuario === getCurrentUserId() ? 'yo' : 'otro',
    fecha: row.fecha,
  };
}

/** Devuelve los mensajes de un chat (id de Match), ordenados del más viejo al más nuevo. */
export async function getMensajes(chatId) {
  if (!chatId) return [];
  const { data, error } = await supabase
    .from('Mensaje')
    .select('*')
    .eq('idMatch', chatId)
    .order('fecha', { ascending: true });
  if (error || !data) return [];
  return data.map(mapRow);
}

async function resolverOtroUsuario(chatId) {
  const { data } = await supabase.from('Match').select('*').eq('id', chatId).single();
  if (!data) return getCurrentUserId();
  return data.idUsuarioUno === getCurrentUserId() ? data.idUsuarioDos : data.idUsuarioUno;
}

/**
 * Agrega un mensaje a un chat y devuelve la lista actualizada.
 * `mensaje.autor` ('yo' | 'otro') se resuelve al usuario real del otro lado
 * del Match para poblar idUsuario correctamente.
 */
export async function agregarMensaje(chatId, mensaje) {
  const idUsuario = mensaje.autor === 'yo' ? getCurrentUserId() : await resolverOtroUsuario(chatId);

  const { error } = await supabase.from('Mensaje').insert({
    idMatch: chatId,
    idUsuario,
    texto: mensaje.texto,
    fecha: mensaje.fecha,
  });
  if (error) throw error;

  return getMensajes(chatId);
}
