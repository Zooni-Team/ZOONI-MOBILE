import { supabase } from '../lib/supabase';

export function esEsquemaFaltante(error) {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = String(error.message ?? '');
  return ['42P01', '42703', 'PGRST205', 'PGRST204', 'PGRST202'].includes(code)
    || /does not exist|schema cache|sin configurar/i.test(msg);
}

export function esFuncionInexistente(error) {
  return error?.code === 'PGRST202' || /function .* does not exist/i.test(error?.message ?? '');
}

export function esSinPermiso(error) {
  return error?.code === '42501' || /row-level security|permission denied/i.test(String(error?.message ?? ''));
}

export function errorApp(codigo, original) {
  const e = new Error(codigo);
  e.detalle = original
    ? [original.message, original.details, original.hint, original.code && `código ${original.code}`]
      .filter(Boolean).join(' · ')
    : null;
  return e;
}

export const errorBase = (error) =>
  errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);

export const resumir = (texto, max = 80) => (texto.length > max ? `${texto.slice(0, max)}…` : texto);

const DESTINOS_PASEADOR = ['solicitudes', 'chats', 'pagos', 'perfil'];
const TITULOS_PASEADOR = /^(tenés una solicitud|paseo cancelado por el dueño|mensaje del dueño|nueva reseña|recordatorio de cobro)/i;
export function esNotificacionDePaseador(n) {
  const extra = n?.DataExtra ?? n?.dataExtra ?? null;
  if (extra?.modo) return extra.modo === 'paseador';
  const tipo = n?.Tipo ?? n?.tipo;
  if (tipo !== 'paseo' && tipo !== 'mensaje') return false;
  return DESTINOS_PASEADOR.includes(extra?.destino)
    || TITULOS_PASEADOR.test(String(n?.Titulo ?? n?.titulo ?? ''));
}

export async function notificar(idUser, titulo, mensaje, { tipo = 'general', destino = null, extra = null, idMascota = null } = {}) {
  if (!idUser) return;
  try {
    const dataExtra = destino || extra ? { ...(extra ?? {}), ...(destino ? { destino } : {}) } : null;
    const { error } = await supabase.rpc('crear_notificacion', {
      p_destino: idUser,
      p_mascota: idMascota,
      p_titulo: titulo,
      p_mensaje: mensaje,
      p_tipo: tipo,
      p_data_extra: dataExtra,
    });
    if (error && __DEV__) console.warn('[notificar]', error.message);
  } catch {
  }
}
