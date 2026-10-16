/**
 * negocioApi.js — Datos de Zooni Negocios (migración 046)
 *
 * Veterinarias, peluquerías y pet shops con cuenta propia. Cada negocio es una
 * fila de negocio_perfil (una por cuenta y tipo) y tiene su pin en el mapa de
 * Comunidad (servicios.id_negocio), que se mantiene sincronizado acá.
 *
 *   Veterinaria / peluquería → TURNOS que piden los dueños:
 *       pendiente → confirmado → completado (con informe)  ·  ↘ rechazado / cancelado / ausente
 *   Pet shop → PEDIDOS:
 *       nuevo → preparando → listo (retiro) / en_camino (envío) → entregado  ·  ↘ rechazado / cancelado
 *
 * El chat reusa la tabla "Mensaje" de la 011: el hilo es (idServicio, dueño) y
 * "deNegocio" dice quién escribió cada mensaje.
 *
 * Todo cambio de estado le llega al otro lado como Notificacion: al dueño con
 * Tipo 'turno' / 'pedido' / 'mensaje' (su campana lo lleva a Turnos y pedidos o
 * al chat) y al negocio con DataExtra.destino = la sección de su app.
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId, setCurrentUserId, setModo, modoNegocio } from '../config/session';
import { hashPassword } from './authApi';
import { marcarPresencia } from './presenciaApi';
import { resolveMascotaVisual } from '../constants/petImages';
import { subirImagenPublica } from '../utils/imagenStorage';
import {
  DIA_DE_JS, HORARIOS_NEGOCIO_DEFAULT, TAMANOS, configNegocio, tamanoPorPeso,
} from '../constants/negocios';
import { aCentavos, formatoPlata } from './paseadorApi';

// ─────────────────────────────────────────────
// ERRORES
// ─────────────────────────────────────────────

function esEsquemaFaltante(error) {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = String(error.message ?? '');
  return ['42P01', '42703', 'PGRST205', 'PGRST204', 'PGRST202'].includes(code)
    || /does not exist|schema cache|sin configurar/i.test(msg);
}

/** Error con código para la pantalla + el mensaje real de Supabase en `detalle`. */
function errorApp(codigo, original) {
  const e = new Error(codigo);
  e.detalle = original
    ? [original.message, original.details, original.hint, original.code && `código ${original.code}`]
      .filter(Boolean).join(' · ')
    : null;
  return e;
}

const errorBase = (error) => errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);

/** Avisa a alguien (tabla Notificacion). Nunca rompe el flujo. */
async function notificar(idUser, titulo, mensaje, { tipo = 'negocio', destino = null, extra = null } = {}) {
  if (!idUser) return;
  try {
    await supabase.from('Notificacion').insert({
      Id_User: idUser, Titulo: titulo, Mensaje: mensaje, Tipo: tipo, Leido: false,
      DataExtra: destino || extra ? { ...(extra ?? {}), ...(destino ? { destino } : {}) } : null,
    });
  } catch {
    // La notificación es un extra: el cambio ya quedó guardado.
  }
}

// ─────────────────────────────────────────────
// FORMATO
// ─────────────────────────────────────────────

export { formatoPlata };

export const horaTexto = (d) => {
  const f = d instanceof Date ? d : new Date(d);
  return `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;
};

/** "Hoy", "Mañana", "Vie 16/10" */
export function diaTexto(d, ahora = new Date()) {
  const f = d instanceof Date ? d : new Date(d);
  const mismo = (a, b) => a.toDateString() === b.toDateString();
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 1);
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (mismo(f, ahora)) return 'Hoy';
  if (mismo(f, manana)) return 'Mañana';
  if (mismo(f, ayer)) return 'Ayer';
  const dia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][f.getDay()];
  return `${dia} ${f.getDate()}/${f.getMonth() + 1}`;
}

export const cuandoTexto = (d) => `${diaTexto(d)} ${horaTexto(d)}`;

// ─────────────────────────────────────────────
// HORARIOS Y TURNOS LIBRES
// ─────────────────────────────────────────────

/** "09:30" → 570 */
export function minutosDe(hhmm) {
  const [h, m] = String(hhmm ?? '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null;
}

export function horarioDelDia(horarios, fecha) {
  const key = DIA_DE_JS[(fecha instanceof Date ? fecha : new Date(fecha)).getDay()];
  return { ...HORARIOS_NEGOCIO_DEFAULT()[key], ...(horarios?.[key] ?? {}) };
}

/** ¿Está abierto en este momento según su horario? */
export function abiertoAhora(horarios, ahora = new Date()) {
  const h = horarioDelDia(horarios, ahora);
  if (!h.activo) return false;
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  return min >= minutosDe(h.desde) && min < minutosDe(h.hasta);
}

/** "Lun a Vie 09:00–19:00 · Sáb 09:00–13:00 · Dom cerrado" (agrupa días iguales seguidos) */
export function resumenHorarios(horarios) {
  const orden = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
  const cortos = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' };
  const base = HORARIOS_NEGOCIO_DEFAULT();
  const txt = (k) => {
    const h = { ...base[k], ...(horarios?.[k] ?? {}) };
    return h.activo ? `${h.desde}–${h.hasta}` : 'cerrado';
  };
  const grupos = [];
  orden.forEach((k) => {
    const t = txt(k);
    const ult = grupos[grupos.length - 1];
    if (ult && ult.t === t) ult.hasta = k;
    else grupos.push({ desde: k, hasta: k, t });
  });
  return grupos.map((g) => `${cortos[g.desde]}${g.hasta !== g.desde ? ` a ${cortos[g.hasta]}` : ''} ${g.t}`).join(' · ');
}

/**
 * Horarios libres de un día para un turno de `duracion` minutos.
 *   · Dentro del horario del negocio ese día (el turno tiene que terminar
 *     antes del cierre).
 *   · Sin pisarse con turnos ya pedidos o confirmados (`ocupados`).
 *   · Si es hoy, desde dentro de `anticipacionMin` minutos.
 * Cada `paso` minutos (30 por defecto; 15 para servicios cortos).
 */
export function turnosLibres({
  horarios, dia, duracion, ocupados = [], ahora = new Date(), anticipacionMin = 60, paso,
}) {
  const h = horarioDelDia(horarios, dia);
  if (!h.activo || !(duracion > 0)) return [];
  const abre = minutosDe(h.desde);
  const cierra = minutosDe(h.hasta);
  if (abre == null || cierra == null || cierra <= abre) return [];
  const salto = paso ?? (duracion < 30 ? 15 : 30);

  const base = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
  const minimo = ahora.getTime() + anticipacionMin * 60000;
  const tomados = ocupados.map((o) => {
    const ini = new Date(o.fecha).getTime();
    return [ini, ini + (o.duracionMin ?? 30) * 60000];
  });

  const libres = [];
  for (let m = abre; m + duracion <= cierra; m += salto) {
    const ini = base.getTime() + m * 60000;
    const fin = ini + duracion * 60000;
    if (ini < minimo) continue;
    if (tomados.some(([a, b]) => ini < b && fin > a)) continue;
    libres.push(new Date(ini));
  }
  return libres;
}

// ─────────────────────────────────────────────
// AUTENTICACIÓN
// ─────────────────────────────────────────────

async function entrarComoNegocio(id, mail, tipo) {
  await setCurrentUserId(id, mail);
  await setModo(modoNegocio(tipo));
  marcarPresencia(true);
}

/**
 * Login de un negocio. Si la cuenta existe pero todavía no tiene un negocio de
 * este tipo, NO entra: devuelve { necesitaActivar, email, hash, nombre } para
 * ofrecer sumarlo a la misma cuenta. Error('credenciales') si no coinciden.
 */
export async function loginNegocio(email, password, tipo) {
  const mail = email.trim().toLowerCase();
  const hash = await hashPassword(password);
  const { data: usuario, error } = await supabase.rpc('login_user', { p_mail: mail, p_hash: hash });
  if (error) throw error;
  if (!usuario) throw new Error('credenciales');

  const { data: negocio, error: errNeg } = await supabase.from('negocio_perfil')
    .select('id').eq('id_user', usuario.id).eq('tipo', tipo).maybeSingle();
  if (errNeg) throw errorBase(errNeg);
  if (!negocio) return { necesitaActivar: true, email: mail, hash, nombre: usuario.nombre };

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
  if (msg.includes('credenciales')) return new Error('credenciales');
  if (msg.includes('ubicacion_invalida')) return errorApp('ubicacion_invalida', error);
  if (msg.includes('nombre_invalido')) return errorApp('nombre_invalido', error);
  return errorBase(error);
}

/** Cuenta nueva con su negocio. Entra directo a trabajar. */
export async function registrarNegocio({ usuario, negocio }) {
  if ((usuario.password ?? '').length < 7) throw new Error('password_corta');
  const hash = await hashPassword(usuario.password);
  const { data, error } = await supabase.rpc('registrar_negocio', {
    p_usuario: {
      nombre: usuario.nombre.trim(),
      apellido: usuario.apellido.trim(),
      email: usuario.email.trim().toLowerCase(),
      telefono: usuario.telefono?.trim() || null,
    },
    p_hash: hash,
    p_negocio: negocioParaRpc(negocio),
  });
  if (error) throw errorDeAlta(error);
  await entrarComoNegocio(data.id, data.email ?? usuario.email, negocio.tipo);
  return data;
}

/** Cuenta que ya existe (dueño, paseador u otro negocio) y suma este negocio. */
export async function activarNegocio({ email, hash, negocio }) {
  const { data, error } = await supabase.rpc('activar_negocio', {
    p_mail: email, p_hash: hash, p_negocio: negocioParaRpc(negocio),
  });
  if (error) throw errorDeAlta(error);
  await entrarComoNegocio(data.id, email, negocio.tipo);
  return data;
}

// ─────────────────────────────────────────────
// PERFIL DEL NEGOCIO
// ─────────────────────────────────────────────

function mapNegocio(r, idServicio = null) {
  return {
    id: r.id,
    idUser: r.id_user,
    tipo: r.tipo,
    nombre: r.nombre,
    descripcion: r.descripcion ?? '',
    direccion: r.direccion ?? '',
    barrio: r.barrio ?? '',
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    telefono: r.telefono ?? '',
    logo: r.logo ?? null,
    horarios: { ...HORARIOS_NEGOCIO_DEFAULT(), ...(r.horarios ?? {}) },
    abierto: r.abierto !== false,
    datos: r.datos ?? {},
    creadoEn: r.creado_en,
    idServicio,
  };
}

async function servicioDe(idNegocio) {
  const { data } = await supabase.from('servicios').select('id').eq('id_negocio', idNegocio).maybeSingle();
  return data?.id ?? null;
}

/** Mi negocio de este tipo (o null si la cuenta no tiene uno). */
export async function fetchMiNegocio(tipo) {
  const { data, error } = await supabase.from('negocio_perfil').select('*')
    .eq('id_user', getCurrentUserId()).eq('tipo', tipo).maybeSingle();
  if (error) throw errorBase(error);
  if (!data) return null;
  return mapNegocio(data, await servicioDe(data.id));
}

/** [{ id, tipo, nombre }] de los negocios de una cuenta (para los roles). */
export async function fetchMisNegocios(id = getCurrentUserId()) {
  if (id == null) return [];
  const { data, error } = await supabase.from('negocio_perfil').select('id, tipo, nombre').eq('id_user', id);
  if (error) return [];
  return data ?? [];
}

const COLUMNAS_NEGOCIO = {
  nombre: 'nombre', descripcion: 'descripcion', direccion: 'direccion', barrio: 'barrio',
  lat: 'lat', lng: 'lng', telefono: 'telefono', logo: 'logo', horarios: 'horarios',
  abierto: 'abierto', datos: 'datos',
};
// Lo que también se ve en el pin de Comunidad
const COLUMNAS_PIN = ['nombre', 'direccion', 'lat', 'lng', 'telefono', 'descripcion'];

/** Guarda cambios del negocio (camelCase) y los copia al pin de Comunidad. */
export async function actualizarNegocio(negocio, campos) {
  const fila = { actualizado_en: new Date().toISOString() };
  Object.entries(campos).forEach(([k, v]) => { if (COLUMNAS_NEGOCIO[k]) fila[COLUMNAS_NEGOCIO[k]] = v; });
  const { error } = await supabase.from('negocio_perfil').update(fila)
    .eq('id', negocio.id).eq('id_user', getCurrentUserId());
  if (error) throw errorBase(error);

  const pin = {};
  COLUMNAS_PIN.forEach((k) => { if (k in campos) pin[k] = campos[k]; });
  if (Object.keys(pin).length) {
    await supabase.from('servicios').update(pin).eq('id_negocio', negocio.id);
  }
  return { ...negocio, ...campos };
}

/** Actualiza sólo lo propio del tipo (matrícula, envíos, galería…). */
export function actualizarDatos(negocio, cambios) {
  return actualizarNegocio(negocio, { datos: { ...(negocio.datos ?? {}), ...cambios } });
}

export async function subirLogoNegocio(negocio, uri) {
  const url = await subirImagenPublica(uri, 'negocios');
  return actualizarNegocio(negocio, { logo: url });
}

export function setAbiertoNegocio(negocio, abierto) {
  return actualizarNegocio(negocio, { abierto });
}

// ─── Galería (peluquería): fotos de trabajos en datos.galeria ───────────────
export const GALERIA_MAX = 30;

export async function agregarFotoGaleria(negocio, uri, nota = '') {
  const url = await subirImagenPublica(uri, 'negocios');
  const galeria = [{ url, nota: nota.trim(), fecha: new Date().toISOString() }, ...(negocio.datos?.galeria ?? [])]
    .slice(0, GALERIA_MAX);
  return actualizarDatos(negocio, { galeria });
}

export function borrarFotoGaleria(negocio, url) {
  return actualizarDatos(negocio, { galeria: (negocio.datos?.galeria ?? []).filter((f) => f.url !== url) });
}

// ─────────────────────────────────────────────
// LO QUE OFRECE: servicios con precio / productos
// ─────────────────────────────────────────────

function mapItem(r) {
  return {
    id: r.id,
    idNegocio: r.id_negocio,
    clase: r.clase,
    nombre: r.nombre,
    descripcion: r.descripcion ?? '',
    categoria: r.categoria ?? 'Otros',
    precio: Number(r.precio ?? 0),
    precios: r.precios ?? null,
    duracionMin: r.duracion_min ?? null,
    stock: r.stock,
    foto: r.foto ?? null,
    activo: r.activo !== false,
    orden: r.orden ?? 0,
  };
}

export async function fetchItems(idNegocio, { soloActivos = false } = {}) {
  let q = supabase.from('negocio_items').select('*').eq('id_negocio', idNegocio);
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q.order('categoria').order('orden').order('nombre');
  if (error) throw errorBase(error);
  return (data ?? []).map(mapItem);
}

/** Precio de un servicio para un tamaño (peluquería) o el precio único. */
export function precioItem(item, tamano) {
  if (item?.precios && typeof item.precios === 'object') {
    const v = item.precios[tamano];
    if (Number(v) > 0) return Number(v);
    const valores = Object.values(item.precios).map(Number).filter((x) => x > 0);
    return valores.length ? Math.min(...valores) : Number(item.precio ?? 0);
  }
  return Number(item?.precio ?? 0);
}

/** "$12.000" o "desde $12.000" si el precio depende del tamaño. */
export function textoPrecioItem(item) {
  if (item?.precios) {
    const valores = TAMANOS.map((t) => Number(item.precios[t.key])).filter((x) => x > 0);
    if (!valores.length) return formatoPlata(item.precio);
    const min = Math.min(...valores);
    return valores.every((v) => v === min) ? formatoPlata(min) : `desde ${formatoPlata(min)}`;
  }
  return formatoPlata(item?.precio);
}

/** Valida un item antes de guardarlo. Devuelve el mensaje del problema o null. */
export function validarItem(item, tipo) {
  const cfg = configNegocio(tipo);
  if ((item.nombre ?? '').trim().length < 2) return 'Es necesario el nombre';
  if (cfg.preciosPorTamano) {
    const ok = TAMANOS.some((t) => Number(item.precios?.[t.key]) > 0);
    if (!ok) return 'Es necesario al menos un precio (chico, mediano o grande)';
  } else if (!(Number(item.precio) > 0)) {
    return 'Es necesario el precio';
  }
  if (cfg.clase === 'servicio') {
    const d = Number(item.duracionMin);
    if (!(d >= 5 && d <= 600)) return 'La duración tiene que estar entre 5 y 600 minutos';
  }
  if (cfg.clase === 'producto' && item.stock !== null && item.stock !== '' && item.stock !== undefined) {
    if (!(Number(item.stock) >= 0)) return 'El stock no puede ser negativo';
  }
  return null;
}

function filaItem(idNegocio, item, tipo) {
  const cfg = configNegocio(tipo);
  const precios = cfg.preciosPorTamano
    ? Object.fromEntries(TAMANOS.map((t) => [t.key, Number(item.precios?.[t.key]) > 0 ? Number(item.precios[t.key]) : null]))
    : null;
  const precio = cfg.preciosPorTamano
    ? Math.min(...Object.values(precios).filter((x) => x > 0))
    : Number(item.precio);
  const stock = item.stock === '' || item.stock === null || item.stock === undefined ? null : Math.round(Number(item.stock));
  return {
    id_negocio: idNegocio,
    clase: cfg.clase,
    nombre: item.nombre.trim().slice(0, 120),
    descripcion: item.descripcion?.trim().slice(0, 400) || null,
    categoria: item.categoria || 'Otros',
    precio: aCentavos(precio),
    precios,
    duracion_min: cfg.clase === 'servicio' ? Math.round(Number(item.duracionMin)) : null,
    stock: cfg.clase === 'producto' ? stock : null,
    foto: item.foto ?? null,
    activo: item.activo !== false,
  };
}

/** Crea (sin id) o actualiza un item. La foto (uri local) se sube primero. */
export async function guardarItem(negocio, item) {
  const err = validarItem(item, negocio.tipo);
  if (err) throw new Error(err);
  let foto = item.foto ?? null;
  if (foto && !/^https?:\/\//.test(foto)) foto = await subirImagenPublica(foto, 'negocios');
  const fila = filaItem(negocio.id, { ...item, foto }, negocio.tipo);
  const q = item.id
    ? supabase.from('negocio_items').update(fila).eq('id', item.id).eq('id_negocio', negocio.id)
    : supabase.from('negocio_items').insert(fila);
  const { error } = await q;
  if (error) throw errorBase(error);
}

export async function borrarItem(negocio, id) {
  const { error } = await supabase.from('negocio_items').delete().eq('id', id).eq('id_negocio', negocio.id);
  if (error) {
    // Con turnos que lo referencian igual se puede (ON DELETE SET NULL); si
    // falla por otra cosa, se desactiva para que no se ofrezca más
    const { error: e2 } = await supabase.from('negocio_items').update({ activo: false })
      .eq('id', id).eq('id_negocio', negocio.id);
    if (e2) throw errorBase(error);
  }
}

export async function setItemActivo(negocio, id, activo) {
  const { error } = await supabase.from('negocio_items').update({ activo }).eq('id', id).eq('id_negocio', negocio.id);
  if (error) throw errorBase(error);
}

export async function ajustarStock(negocio, item, delta) {
  const stock = Math.max(0, (item.stock ?? 0) + delta);
  const { error } = await supabase.from('negocio_items').update({ stock }).eq('id', item.id).eq('id_negocio', negocio.id);
  if (error) throw errorBase(error);
  return stock;
}

/** Carga de una los servicios sugeridos que eligió (los que todavía no tiene). */
export async function agregarSugeridos(negocio, sugeridos, existentes = []) {
  const tiene = new Set(existentes.map((i) => i.nombre.trim().toLowerCase()));
  const filas = sugeridos
    .filter((x) => !tiene.has(x.nombre.trim().toLowerCase()))
    .map((x, i) => ({
      ...filaItem(negocio.id, {
        nombre: x.nombre, categoria: x.categoria, precio: x.precio, precios: x.precios,
        duracionMin: x.duracion, activo: true,
      }, negocio.tipo),
      orden: i,
    }));
  if (!filas.length) return 0;
  const { error } = await supabase.from('negocio_items').insert(filas);
  if (error) throw errorBase(error);
  return filas.length;
}

// ─────────────────────────────────────────────
// ENRIQUECER: mascotas, dueños y negocios de una lista de filas
// ─────────────────────────────────────────────

async function mascotasPorId(ids) {
  const lista = [...new Set(ids.filter(Boolean))];
  if (!lista.length) return {};
  const { data } = await supabase.from('Mascota')
    .select('Id_Mascota, Id_User, Nombre, Especie, Raza, Peso, Foto, ImagenAsset, MostrarFoto, FechaNacimiento')
    .in('Id_Mascota', lista);
  return Object.fromEntries((data ?? []).map((m) => [m.Id_Mascota, {
    id: m.Id_Mascota,
    nombre: m.Nombre ?? 'Mascota',
    especie: m.Especie,
    raza: m.Raza,
    peso: m.Peso != null ? Number(m.Peso) : null,
    nacimiento: m.FechaNacimiento ?? null,
    visual: resolveMascotaVisual({
      fotoUrl: m.Foto, imagenAsset: m.ImagenAsset, especie: m.Especie, raza: m.Raza, mostrarFoto: m.MostrarFoto,
    }),
  }]));
}

async function usuariosPorId(ids) {
  const lista = [...new Set(ids.filter(Boolean))];
  if (!lista.length) return {};
  const { data } = await supabase.from('User').select('Id_User, Nombre, Apellido, FotoPerfil, Telefono').in('Id_User', lista);
  return Object.fromEntries((data ?? []).map((u) => [u.Id_User, {
    id: u.Id_User,
    nombre: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim() || 'Cliente',
    foto: u.FotoPerfil ?? null,
    telefono: u.Telefono ?? null,
  }]));
}

async function negociosPorId(ids) {
  const lista = [...new Set(ids.filter(Boolean))];
  if (!lista.length) return {};
  const [{ data }, { data: pines }] = await Promise.all([
    supabase.from('negocio_perfil').select('*').in('id', lista),
    supabase.from('servicios').select('id, id_negocio').in('id_negocio', lista),
  ]);
  const pinDe = Object.fromEntries((pines ?? []).map((p) => [p.id_negocio, p.id]));
  return Object.fromEntries((data ?? []).map((n) => [n.id, mapNegocio(n, pinDe[n.id] ?? null)]));
}

// ─────────────────────────────────────────────
// TURNOS (veterinaria / peluquería)
// ─────────────────────────────────────────────

function mapTurno(r, mascotas = {}, usuarios = {}, negocios = {}) {
  return {
    id: r.id,
    idNegocio: r.id_negocio,
    idDueno: r.id_dueno,
    idMascota: r.id_mascota,
    idItem: r.id_item,
    servicio: r.servicio,
    fecha: r.fecha,
    duracionMin: r.duracion_min ?? 30,
    precio: Number(r.precio ?? 0),
    urgencia: !!r.urgencia,
    aDomicilio: !!r.a_domicilio,
    direccion: r.direccion ?? null,
    estado: r.estado,
    notas: r.notas_dueno ?? '',
    informe: r.informe ?? null,
    creadoEn: r.creado_en,
    mascota: mascotas[r.id_mascota] ?? { id: r.id_mascota, nombre: 'Mascota', visual: null },
    dueno: usuarios[r.id_dueno] ?? { id: r.id_dueno, nombre: 'Cliente', foto: null },
    negocio: negocios[r.id_negocio] ?? null,
  };
}

async function enriquecerTurnos(rows, { conNegocio = false } = {}) {
  const [mascotas, usuarios, negocios] = await Promise.all([
    mascotasPorId(rows.map((r) => r.id_mascota)),
    usuariosPorId(rows.map((r) => r.id_dueno)),
    conNegocio ? negociosPorId(rows.map((r) => r.id_negocio)) : {},
  ]);
  return rows.map((r) => mapTurno(r, mascotas, usuarios, negocios));
}

/** Turnos del negocio. `desde`/`hasta` son Date; `estados` filtra. */
export async function fetchTurnosNegocio(idNegocio, { desde, hasta, estados } = {}) {
  let q = supabase.from('negocio_turnos').select('*').eq('id_negocio', idNegocio);
  if (desde) q = q.gte('fecha', desde.toISOString());
  if (hasta) q = q.lt('fecha', hasta.toISOString());
  if (estados?.length) q = q.in('estado', estados);
  const { data, error } = await q.order('fecha', { ascending: true }).limit(500);
  if (error) throw errorBase(error);
  return enriquecerTurnos(data ?? []);
}

/** Lo ya ocupado de un día: turnos pedidos o confirmados → [{ fecha, duracionMin }]. */
export async function fetchOcupados(idNegocio, dia) {
  const desde = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 1);
  const { data, error } = await supabase.from('negocio_turnos').select('fecha, duracion_min')
    .eq('id_negocio', idNegocio).in('estado', ['pendiente', 'confirmado'])
    .gte('fecha', desde.toISOString()).lt('fecha', hasta.toISOString());
  if (error) throw errorBase(error);
  return (data ?? []).map((r) => ({ fecha: r.fecha, duracionMin: r.duracion_min }));
}

/** Transiciones válidas de un turno, desde el lado del negocio. */
export const ACCIONES_TURNO = {
  pendiente: ['confirmado', 'rechazado'],
  confirmado: ['completado', 'ausente', 'cancelado'],
};

/**
 * El negocio cambia el estado de un turno y le avisa al dueño.
 * `informe` (al completar): veterinaria → { motivo, diagnostico, tratamiento,
 * peso, temperatura, proximoControl, notas }; peluquería → { notas, fotos }.
 */
export async function cambiarEstadoTurno(negocio, turno, estado, { informe, motivo } = {}) {
  if (!ACCIONES_TURNO[turno.estado]?.includes(estado)) throw new Error('transicion_invalida');
  const fila = { estado, actualizado_en: new Date().toISOString() };
  if (informe) fila.informe = informe;
  const { data, error } = await supabase.from('negocio_turnos').update(fila)
    .eq('id', turno.id).eq('id_negocio', negocio.id).eq('estado', turno.estado)
    .select('id');
  if (error) throw errorBase(error);
  if (!data?.length) throw new Error('turno_cambiado'); // lo canceló el dueño mientras tanto

  const quien = turno.mascota?.nombre ?? 'tu mascota';
  const cuando = cuandoTexto(turno.fecha);
  const avisos = {
    confirmado: [`Turno confirmado ✅`, `${negocio.nombre} confirmó el turno de ${quien}: ${turno.servicio}, ${cuando}.`],
    rechazado: ['Turno no disponible', `${negocio.nombre} no puede atender a ${quien} ${cuando}.${motivo ? ` "${motivo}"` : ''} Probá con otro horario.`],
    cancelado: ['Turno cancelado', `${negocio.nombre} canceló el turno de ${quien} (${cuando}).${motivo ? ` "${motivo}"` : ''}`],
    completado: negocio.tipo === 'veterinaria'
      ? ['Consulta finalizada 🩺', `${quien} ya fue atendido en ${negocio.nombre}. Mirá el informe en Turnos y pedidos.`]
      : ['¡Listo! 🛁', `${quien} ya está listo en ${negocio.nombre}.`],
  };
  if (avisos[estado]) {
    notificar(turno.idDueno, avisos[estado][0], avisos[estado][1], { tipo: 'turno', extra: { idTurno: turno.id } });
  }
  return { ...turno, estado, informe: informe ?? turno.informe };
}

/** Guarda / corrige el informe de un turno ya atendido (sin cambiar el estado). */
export async function guardarInforme(negocio, turno, informe) {
  const { error } = await supabase.from('negocio_turnos')
    .update({ informe, actualizado_en: new Date().toISOString() })
    .eq('id', turno.id).eq('id_negocio', negocio.id);
  if (error) throw errorBase(error);
  return { ...turno, informe };
}

/**
 * El dueño pide un turno. El precio sale del servicio elegido (y del tamaño de
 * la mascota en peluquería). Antes de guardar se vuelve a chequear que el
 * horario siga libre: dos dueños pueden estar mirando el mismo.
 */
export async function crearTurno({
  negocio, item, mascota, fecha, tamano, urgencia = false, aDomicilio = false, direccion = null, notas = '',
}) {
  if (!negocio.abierto) throw new Error('negocio_cerrado');
  const ocupados = await fetchOcupados(negocio.id, fecha);
  const ini = fecha.getTime();
  const fin = ini + item.duracionMin * 60000;
  const pisa = ocupados.some((o) => {
    const a = new Date(o.fecha).getTime();
    return ini < a + o.duracionMin * 60000 && fin > a;
  });
  if (pisa) throw new Error('horario_ocupado');

  const precio = precioItem(item, tamano ?? tamanoPorPeso(mascota?.peso));
  const { data, error } = await supabase.from('negocio_turnos').insert({
    id_negocio: negocio.id,
    id_dueno: getCurrentUserId(),
    id_mascota: mascota?.id ?? null,
    id_item: item.id,
    servicio: item.nombre,
    fecha: fecha.toISOString(),
    duracion_min: item.duracionMin,
    precio,
    urgencia,
    a_domicilio: aDomicilio,
    direccion: aDomicilio ? direccion?.trim() || null : null,
    notas_dueno: notas?.trim().slice(0, 500) || null,
  }).select('id').single();
  if (error) throw errorBase(error);

  notificar(negocio.idUser,
    urgencia ? '🚨 Pedido de turno URGENTE' : 'Nuevo pedido de turno',
    `${mascota?.nombre ?? 'Una mascota'} · ${item.nombre} · ${cuandoTexto(fecha)}${aDomicilio ? ' · a domicilio' : ''}`,
    { destino: 'turnos' });
  return data.id;
}

/** Mis turnos como dueño (los más nuevos primero). */
export async function fetchMisTurnos() {
  const { data, error } = await supabase.from('negocio_turnos').select('*')
    .eq('id_dueno', getCurrentUserId()).order('fecha', { ascending: false }).limit(100);
  if (error) throw errorBase(error);
  return enriquecerTurnos(data ?? [], { conNegocio: true });
}

/** El dueño cancela un turno pedido o confirmado y le avisa al negocio. */
export async function cancelarTurnoDueno(turno) {
  const { error } = await supabase.from('negocio_turnos')
    .update({ estado: 'cancelado', actualizado_en: new Date().toISOString() })
    .eq('id', turno.id).eq('id_dueno', getCurrentUserId()).in('estado', ['pendiente', 'confirmado']);
  if (error) throw errorBase(error);
  notificar(turno.negocio?.idUser, 'Turno cancelado por el cliente',
    `${turno.mascota?.nombre ?? 'Mascota'} · ${turno.servicio} · ${cuandoTexto(turno.fecha)}`, { destino: 'turnos' });
}

// ─────────────────────────────────────────────
// PACIENTES (veterinaria) / CLIENTES (peluquería)
// ─────────────────────────────────────────────

/**
 * Una ficha por mascota atendida (o con turno), armada con sus turnos:
 * visitas del más nuevo al más viejo, próximo turno, último informe y cuánto
 * se facturó. Ordenadas por la última actividad.
 */
export async function fetchPacientes(idNegocio) {
  const turnos = await fetchTurnosNegocio(idNegocio, { estados: ['pendiente', 'confirmado', 'completado', 'ausente'] });
  const ahora = Date.now();
  const fichas = new Map();
  turnos.forEach((t) => {
    if (t.idMascota == null) return;
    if (!fichas.has(t.idMascota)) fichas.set(t.idMascota, { mascota: t.mascota, dueno: t.dueno, turnos: [] });
    fichas.get(t.idMascota).turnos.push(t);
  });
  return [...fichas.values()].map((f) => {
    const visitas = f.turnos.filter((t) => t.estado === 'completado')
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const proximo = f.turnos.filter((t) => ['pendiente', 'confirmado'].includes(t.estado) && new Date(t.fecha).getTime() > ahora)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))[0] ?? null;
    const ultimo = visitas[0] ?? null;
    const controles = visitas.map((v) => v.informe?.proximoControl).filter(Boolean)
      .filter((d) => new Date(d).getTime() > ahora).sort();
    return {
      ...f,
      visitas,
      ausencias: f.turnos.filter((t) => t.estado === 'ausente').length,
      proximo,
      ultimaVisita: ultimo?.fecha ?? null,
      ultimoInforme: visitas.find((v) => v.informe)?.informe ?? null,
      proximoControl: controles[0] ?? null,
      facturado: aCentavos(visitas.reduce((a, v) => a + v.precio, 0)),
      actividad: proximo?.fecha ?? ultimo?.fecha ?? f.turnos[0]?.fecha,
    };
  }).sort((a, b) => new Date(b.actividad) - new Date(a.actividad));
}

// ─────────────────────────────────────────────
// PEDIDOS (pet shop)
// ─────────────────────────────────────────────

function mapPedido(r, usuarios = {}, negocios = {}) {
  return {
    id: r.id,
    idNegocio: r.id_negocio,
    idDueno: r.id_dueno,
    items: Array.isArray(r.items) ? r.items : [],
    subtotal: Number(r.subtotal ?? 0),
    envio: Number(r.envio ?? 0),
    total: Number(r.total ?? 0),
    entrega: r.entrega,
    direccion: r.direccion ?? null,
    medioPago: r.medio_pago ?? null,
    notas: r.notas ?? '',
    estado: r.estado,
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
    dueno: usuarios[r.id_dueno] ?? { id: r.id_dueno, nombre: 'Cliente', foto: null },
    negocio: negocios[r.id_negocio] ?? null,
  };
}

export const unidadesDe = (pedido) => pedido.items.reduce((a, x) => a + (Number(x.cantidad) || 0), 0);

export async function fetchPedidosNegocio(idNegocio) {
  const { data, error } = await supabase.from('negocio_pedidos').select('*')
    .eq('id_negocio', idNegocio).order('creado_en', { ascending: false }).limit(300);
  if (error) throw errorBase(error);
  const usuarios = await usuariosPorId((data ?? []).map((r) => r.id_dueno));
  return (data ?? []).map((r) => mapPedido(r, usuarios));
}

/** Próximo paso de un pedido según cómo se entrega. */
export function siguienteEstadoPedido(pedido) {
  if (pedido.estado === 'nuevo') return 'preparando';
  if (pedido.estado === 'preparando') return pedido.entrega === 'envio' ? 'en_camino' : 'listo';
  if (pedido.estado === 'listo' || pedido.estado === 'en_camino') return 'entregado';
  return null;
}

/**
 * El pet shop avanza (o rechaza) un pedido y le avisa al dueño. Al aceptarlo
 * (nuevo → preparando) se descuenta el stock de cada producto.
 */
export async function cambiarEstadoPedido(negocio, pedido, estado, { motivo } = {}) {
  const permitido = estado === 'rechazado' ? pedido.estado === 'nuevo'
    : estado === 'cancelado' ? ['preparando', 'listo'].includes(pedido.estado)
      : siguienteEstadoPedido(pedido) === estado;
  if (!permitido) throw new Error('transicion_invalida');

  const { data, error } = await supabase.from('negocio_pedidos')
    .update({ estado, actualizado_en: new Date().toISOString() })
    .eq('id', pedido.id).eq('id_negocio', negocio.id).eq('estado', pedido.estado)
    .select('id');
  if (error) throw errorBase(error);
  if (!data?.length) throw new Error('pedido_cambiado');

  if (estado === 'preparando') {
    const ids = pedido.items.map((x) => x.idItem).filter(Boolean);
    if (ids.length) {
      const { data: actuales } = await supabase.from('negocio_items').select('id, stock').in('id', ids);
      await Promise.all((actuales ?? []).filter((it) => it.stock != null).map((it) => {
        const pedidoItem = pedido.items.find((x) => x.idItem === it.id);
        const nuevo = Math.max(0, it.stock - (Number(pedidoItem?.cantidad) || 0));
        return supabase.from('negocio_items').update({ stock: nuevo }).eq('id', it.id);
      }));
    }
  }

  const n = `#${pedido.id}`;
  const avisos = {
    preparando: ['Pedido confirmado 🛍️', `${negocio.nombre} está preparando tu pedido ${n}.`],
    listo: ['¡Tu pedido está listo!', `Ya podés retirar el pedido ${n} en ${negocio.nombre} (${negocio.direccion}).`],
    en_camino: ['Tu pedido va en camino 🛵', `${negocio.nombre} despachó el pedido ${n}.`],
    entregado: ['Pedido entregado ✅', `¡Gracias por comprar en ${negocio.nombre}!`],
    rechazado: ['Pedido no disponible', `${negocio.nombre} no puede tomar el pedido ${n}.${motivo ? ` "${motivo}"` : ''}`],
    cancelado: ['Pedido cancelado', `${negocio.nombre} canceló el pedido ${n}.${motivo ? ` "${motivo}"` : ''}`],
  };
  if (avisos[estado]) {
    notificar(pedido.idDueno, avisos[estado][0], avisos[estado][1], { tipo: 'pedido', extra: { idPedido: pedido.id } });
  }
  return { ...pedido, estado };
}

/** Costo de envío según la configuración del pet shop (gratis desde cierto monto). */
export function costoEnvio(negocio, subtotal) {
  const d = negocio?.datos ?? {};
  if (!d.envios) return null;
  const gratisDesde = Number(d.envioGratisDesde) || 0;
  if (gratisDesde > 0 && subtotal >= gratisDesde) return 0;
  return Number(d.envioCosto) || 0;
}

/**
 * El dueño hace un pedido. `carrito` = [{ item, cantidad }]. Se revisa el
 * stock y el pedido mínimo con los datos del momento (no los de la pantalla).
 */
export async function crearPedido({ negocio, carrito, entrega, direccion, medioPago, notas }) {
  if (!negocio.abierto) throw new Error('negocio_cerrado');
  const lineas = carrito.filter((x) => x.cantidad > 0);
  if (!lineas.length) throw new Error('carrito_vacio');

  const { data: actuales, error: errItems } = await supabase.from('negocio_items')
    .select('id, nombre, precio, stock, activo').in('id', lineas.map((x) => x.item.id));
  if (errItems) throw errorBase(errItems);
  const porId = Object.fromEntries((actuales ?? []).map((x) => [x.id, x]));
  const sinStock = lineas.filter((x) => {
    const it = porId[x.item.id];
    return !it || !it.activo || (it.stock != null && it.stock < x.cantidad);
  });
  if (sinStock.length) {
    const e = new Error('sin_stock');
    e.productos = sinStock.map((x) => x.item.nombre);
    throw e;
  }

  const items = lineas.map((x) => ({
    idItem: x.item.id, nombre: porId[x.item.id].nombre, precio: Number(porId[x.item.id].precio), cantidad: x.cantidad,
  }));
  const subtotal = aCentavos(items.reduce((a, x) => a + x.precio * x.cantidad, 0));
  const minimo = Number(negocio.datos?.pedidoMinimo) || 0;
  if (minimo > 0 && subtotal < minimo) throw new Error('pedido_minimo');
  const envio = entrega === 'envio' ? (costoEnvio(negocio, subtotal) ?? 0) : 0;
  if (entrega === 'envio' && !negocio.datos?.envios) throw new Error('sin_envios');

  const { data, error } = await supabase.from('negocio_pedidos').insert({
    id_negocio: negocio.id,
    id_dueno: getCurrentUserId(),
    items,
    subtotal,
    envio,
    total: aCentavos(subtotal + envio),
    entrega,
    direccion: entrega === 'envio' ? direccion?.trim() || null : null,
    medio_pago: medioPago ?? null,
    notas: notas?.trim().slice(0, 500) || null,
  }).select('id').single();
  if (error) throw errorBase(error);

  const unidades = items.reduce((a, x) => a + x.cantidad, 0);
  notificar(negocio.idUser, `Nuevo pedido #${data.id} 🛍️`,
    `${unidades} ${unidades === 1 ? 'producto' : 'productos'} · ${formatoPlata(subtotal + envio)} · ${entrega === 'envio' ? 'envío a domicilio' : 'retira en el local'}`,
    { destino: 'pedidos' });
  return data.id;
}

export async function fetchMisPedidos() {
  const { data, error } = await supabase.from('negocio_pedidos').select('*')
    .eq('id_dueno', getCurrentUserId()).order('creado_en', { ascending: false }).limit(100);
  if (error) throw errorBase(error);
  const negocios = await negociosPorId((data ?? []).map((r) => r.id_negocio));
  return (data ?? []).map((r) => mapPedido(r, {}, negocios));
}

/** El dueño cancela un pedido que el pet shop todavía no aceptó. */
export async function cancelarPedidoDueno(pedido) {
  const { data, error } = await supabase.from('negocio_pedidos')
    .update({ estado: 'cancelado', actualizado_en: new Date().toISOString() })
    .eq('id', pedido.id).eq('id_dueno', getCurrentUserId()).eq('estado', 'nuevo')
    .select('id');
  if (error) throw errorBase(error);
  if (!data?.length) throw new Error('pedido_cambiado');
  notificar(pedido.negocio?.idUser, `Pedido #${pedido.id} cancelado`, 'El cliente canceló el pedido antes de que lo prepararas.',
    { destino: 'pedidos' });
}

/** Clientes del pet shop: uno por dueño, con sus pedidos y cuánto compró. */
export async function fetchClientesPetshop(idNegocio) {
  const pedidos = await fetchPedidosNegocio(idNegocio);
  const porDueno = new Map();
  pedidos.forEach((p) => {
    if (!porDueno.has(p.idDueno)) porDueno.set(p.idDueno, { dueno: p.dueno, pedidos: [] });
    porDueno.get(p.idDueno).pedidos.push(p);
  });
  return [...porDueno.values()].map((c) => {
    const entregados = c.pedidos.filter((p) => p.estado === 'entregado');
    const productos = new Map();
    entregados.forEach((p) => p.items.forEach((x) => productos.set(x.nombre, (productos.get(x.nombre) ?? 0) + x.cantidad)));
    return {
      ...c,
      comprado: aCentavos(entregados.reduce((a, p) => a + p.total, 0)),
      compras: entregados.length,
      ultimo: c.pedidos[0]?.creadoEn ?? null,
      favoritos: [...productos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nombre]) => nombre),
    };
  }).sort((a, b) => new Date(b.ultimo) - new Date(a.ultimo));
}

// ─────────────────────────────────────────────
// RESUMEN PARA EL INICIO
// ─────────────────────────────────────────────

const inicioDelDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const inicioDelMes = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

export async function fetchResumenNegocio(negocio) {
  const hoy = inicioDelDia();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  const mes = inicioDelMes();
  const cfg = configNegocio(negocio.tipo);

  const items = await fetchItems(negocio.id).catch(() => []);
  const base = {
    items: items.length,
    itemsActivos: items.filter((i) => i.activo).length,
    stockBajo: items.filter((i) => i.activo && i.stock != null && i.stock <= 3),
  };

  if (cfg.usaPedidos) {
    const pedidos = await fetchPedidosNegocio(negocio.id);
    const delMes = pedidos.filter((p) => new Date(p.creadoEn) >= mes);
    const entregadosMes = delMes.filter((p) => p.estado === 'entregado');
    return {
      ...base,
      nuevos: pedidos.filter((p) => p.estado === 'nuevo'),
      enCurso: pedidos.filter((p) => ['preparando', 'listo', 'en_camino'].includes(p.estado)),
      ventasMes: aCentavos(entregadosMes.reduce((a, p) => a + p.total, 0)),
      pedidosMes: entregadosMes.length,
      ticketPromedio: entregadosMes.length
        ? aCentavos(entregadosMes.reduce((a, p) => a + p.total, 0) / entregadosMes.length) : 0,
      hoy: pedidos.filter((p) => new Date(p.creadoEn) >= hoy).length,
    };
  }

  const turnos = await fetchTurnosNegocio(negocio.id, { desde: mes > hoy ? hoy : mes });
  const deHoy = turnos.filter((t) => new Date(t.fecha) >= hoy && new Date(t.fecha) < manana
    && ['pendiente', 'confirmado', 'completado'].includes(t.estado));
  const completadosMes = turnos.filter((t) => t.estado === 'completado' && new Date(t.fecha) >= mes);
  const proximos = await fetchTurnosNegocio(negocio.id, { desde: new Date(), estados: ['pendiente', 'confirmado'] });
  return {
    ...base,
    hoy: deHoy,
    pendientes: proximos.filter((t) => t.estado === 'pendiente'),
    urgencias: proximos.filter((t) => t.urgencia && t.estado === 'pendiente'),
    proximos: proximos.filter((t) => t.estado === 'confirmado').slice(0, 5),
    ingresosMes: aCentavos(completadosMes.reduce((a, t) => a + t.precio, 0)),
    atendidosMes: completadosMes.length,
  };
}

// ─────────────────────────────────────────────
// CHAT CON LOS CLIENTES
// ─────────────────────────────────────────────

/** Conversaciones del negocio: una por dueño que le escribió, la más reciente arriba. */
export async function fetchConversacionesNegocio(idServicio) {
  if (!idServicio) return [];
  const { data, error } = await supabase.from('Mensaje').select('*')
    .eq('idServicio', idServicio).order('fecha', { ascending: false }).limit(500);
  if (error) throw errorBase(error);
  const hilos = new Map();
  (data ?? []).forEach((m) => {
    if (!hilos.has(m.idUsuario)) hilos.set(m.idUsuario, { idDueno: m.idUsuario, ultimo: m, sinLeer: 0 });
    if (!m.deNegocio && !m.leido) hilos.get(m.idUsuario).sinLeer += 1;
  });
  const usuarios = await usuariosPorId([...hilos.keys()]);
  return [...hilos.values()].map((h) => ({
    idDueno: h.idDueno,
    dueno: usuarios[h.idDueno] ?? { id: h.idDueno, nombre: 'Cliente', foto: null },
    ultimoTexto: h.ultimo.texto,
    ultimoMio: !!h.ultimo.deNegocio,
    fecha: h.ultimo.fecha,
    sinLeer: h.sinLeer,
  }));
}

export async function contarNoLeidosNegocio(idServicio) {
  if (!idServicio) return 0;
  const { count } = await supabase.from('Mensaje').select('id', { count: 'exact', head: true })
    .eq('idServicio', idServicio).eq('deNegocio', false).eq('leido', false);
  return count ?? 0;
}

export async function getMensajesNegocio(idServicio, idDueno) {
  const { data, error } = await supabase.from('Mensaje').select('*')
    .eq('idServicio', idServicio).eq('idUsuario', idDueno).order('fecha', { ascending: true });
  if (error) throw errorBase(error);
  return (data ?? []).map((m) => ({
    id: m.id, texto: m.texto, fecha: m.fecha, leido: !!m.leido, autor: m.deNegocio ? 'yo' : 'otro',
  }));
}

export async function marcarLeidosNegocio(idServicio, idDueno) {
  await supabase.from('Mensaje').update({ leido: true })
    .eq('idServicio', idServicio).eq('idUsuario', idDueno).eq('deNegocio', false).eq('leido', false);
}

/** El negocio le contesta a un dueño. Al dueño le llega la notificación al chat. */
export async function enviarMensajeNegocio(negocio, idDueno, texto) {
  const limpio = texto.trim().slice(0, 2000);
  if (!limpio) return;
  const { error } = await supabase.from('Mensaje').insert({
    idUsuario: idDueno, idServicio: negocio.idServicio, texto: limpio,
    fecha: new Date().toISOString(), deNegocio: true,
  });
  if (error) throw errorBase(error);
  notificar(idDueno, `Mensaje de ${negocio.nombre}`, limpio.length > 80 ? `${limpio.slice(0, 80)}…` : limpio, {
    tipo: 'mensaje',
    extra: { servicioId: negocio.idServicio, nombre: negocio.nombre, tipoServicio: configNegocio(negocio.tipo).label },
  });
}

// ─────────────────────────────────────────────
// LADO DUEÑO: ver un negocio
// ─────────────────────────────────────────────

/** Negocio + lo que ofrece (sólo lo activo), para la ficha que ve el dueño. */
export async function fetchNegocioPublico(idNegocio) {
  const { data, error } = await supabase.from('negocio_perfil').select('*').eq('id', idNegocio).maybeSingle();
  if (error) throw errorBase(error);
  if (!data) return null;
  const [idServicio, items] = await Promise.all([servicioDe(idNegocio), fetchItems(idNegocio, { soloActivos: true })]);
  // Cuántos atendió / vendió: lo que hace confiar en un negocio nuevo
  const tabla = data.tipo === 'petshop' ? 'negocio_pedidos' : 'negocio_turnos';
  const estado = data.tipo === 'petshop' ? 'entregado' : 'completado';
  const { count } = await supabase.from(tabla).select('id', { count: 'exact', head: true })
    .eq('id_negocio', idNegocio).eq('estado', estado);
  return { ...mapNegocio(data, idServicio), items, realizados: count ?? 0 };
}
