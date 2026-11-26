import { supabase } from '../../lib/supabase';
import { setCurrentUserId, setModo, modoNegocio } from '../../config/session';
import { crearCuentaConPassword, iniciarSesionConPassword } from '../authApi';
import { marcarPresencia } from '../presenciaApi';
import { HORARIOS_NEGOCIO_DEFAULT } from '../../constants/negocios';
import { errorApp, errorBase, esFuncionInexistente } from '../comun';

async function entrarComoNegocio(id, mail, tipo) {
  await setCurrentUserId(id, mail);
  await setModo(modoNegocio(tipo));
  marcarPresencia(true);
}

export async function loginNegocio(email, password, tipo) {
  const mail = email.trim().toLowerCase();
  const usuario = await iniciarSesionConPassword(mail, password);

  const { data: negocio, error: errNeg } = await supabase.from('negocio_perfil')
    .select('id').eq('id_user', usuario.id).eq('tipo', tipo).maybeSingle();
  if (errNeg) throw errorBase(errNeg);
  if (!negocio) return { necesitaActivar: true, email: mail, nombre: usuario.nombre };

  await entrarComoNegocio(usuario.id, mail, tipo);
  return { usuario };
}

function negocioParaRpc(n) {
  return {
    tipo: n.tipo,
    nombre: n.nombre?.trim(),
    descripcion: n.descripcion?.trim() || null,
    direccion: n.direccion?.trim(),
    barrio: n.barrio?.trim() || null,
    lat: n.lat,
    lng: n.lng,
    telefono: n.telefono?.trim() || null,
    horarios: n.horarios ?? HORARIOS_NEGOCIO_DEFAULT(),
    datos: n.datos ?? {},
  };
}

function errorDeAlta(error) {
  const msg = String(error?.message ?? '');
  if (msg.includes('email_existente') || error?.code === '23505') return new Error('email_existente');
  if (esFuncionInexistente(error) || /sin_sesion_social|JWT|token/i.test(msg)) return errorApp('migracion_pendiente', error);
  if (msg.includes('credenciales')) return new Error('credenciales');
  if (msg.includes('ubicacion_invalida')) return errorApp('ubicacion_invalida', error);
  if (msg.includes('nombre_invalido')) return errorApp('nombre_invalido', error);
  return errorBase(error);
}

export async function registrarNegocio({ usuario, negocio }) {
  await crearCuentaConPassword(usuario.email, usuario.password);
  const { data, error } = await supabase.rpc('registrar_negocio_sesion', {
    p_usuario: {
      nombre: usuario.nombre.trim(),
      apellido: usuario.apellido.trim(),
      telefono: usuario.telefono?.trim() || null,
    },
    p_negocio: negocioParaRpc(negocio),
  });
  if (error) throw errorDeAlta(error);
  await entrarComoNegocio(data.id, data.email ?? usuario.email, negocio.tipo);
  return data;
}

export async function activarNegocio({ email, negocio }) {
  const { data, error } = await supabase.rpc('activar_negocio_sesion', {
    p_negocio: negocioParaRpc(negocio),
  });
  if (error) throw errorDeAlta(error);
  await entrarComoNegocio(data.id, email, negocio.tipo);
  return data;
}
