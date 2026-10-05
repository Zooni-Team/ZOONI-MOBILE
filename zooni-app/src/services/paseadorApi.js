/**
 * paseadorApi.js — Datos de Zooni Paseadores (migración 035)
 *
 * Una solicitud de paseo ES una fila de "Paseo" en estado 'pendiente'. El
 * ciclo de vida completo vive en esa misma fila:
 *
 *   pendiente → aceptado → en_curso → finalizado
 *             ↘ rechazado / cancelado
 *
 * Solicitudes abiertas (Id_Walker NULL) las ve cualquier paseador; rechazar
 * una abierta sólo la oculta para mí (paseo_rechazos). Rechazar una dirigida
 * a mí la pasa a 'rechazado' para que el dueño se entere.
 *
 * MODO DEMO: si la 035 todavía no se corrió (faltan tablas/columnas) o no hay
 * Supabase configurado, todo cae a un set de datos en memoria. Así la app se
 * puede recorrer igual, y la pantalla de Inicio avisa que está en demo.
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId, setCurrentUserId, setModo, MODO_PASEADOR } from '../config/session';
import { hashPassword } from './authApi';
import { marcarPresencia } from './presenciaApi';
import { resolveMascotaVisual } from '../constants/petImages';
import { subirArchivoPublico } from '../utils/imagenStorage';
import { rpcSocial } from './socialAuthApi';

// ─────────────────────────────────────────────
// MODO DEMO
// ─────────────────────────────────────────────

let modoDemo = false;
export function enModoDemo() {
  return modoDemo;
}

/** ¿El error es "esto no existe en la base" (035 sin correr / sin .env)? */
function esEsquemaFaltante(error) {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = String(error.message ?? '');
  return ['42P01', '42703', 'PGRST205', 'PGRST204', 'PGRST202'].includes(code)
    || /does not exist|schema cache|sin configurar/i.test(msg);
}

/**
 * Error con código para la pantalla + el mensaje real de Supabase en
 * `detalle`, para mostrar QUÉ falló en vez de un texto genérico.
 */
function errorApp(codigo, original) {
  const e = new Error(codigo);
  e.detalle = original
    ? [original.message, original.details, original.hint, original.code && `código ${original.code}`]
      .filter(Boolean).join(' · ')
    : null;
  return e;
}

/** Si el error es de esquema → activa demo y devuelve true. Si es otro, lo tira. */
function caerADemo(error) {
  if (esEsquemaFaltante(error)) {
    modoDemo = true;
    return true;
  }
  throw error;
}

const HORA = 3600 * 1000;
const hoyA = (h, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const haceDias = (dias, h = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

function crearDemo() {
  const duenos = {
    901: { id: 901, nombre: 'Sofía García', foto: null, telefono: '11 5555-1234' },
    902: { id: 902, nombre: 'Martín López', foto: null, telefono: '11 4444-9876' },
    903: { id: 903, nombre: 'Lucía Fernández', foto: null, telefono: null },
    904: { id: 904, nombre: 'Tomás Ruiz', foto: null, telefono: null },
  };
  const mascotas = {
    801: { id: 801, nombre: 'Titán', especie: 'perro', raza: 'Golden Retriever', peso: 30, idDueno: 901 },
    802: { id: 802, nombre: 'Luna', especie: 'perro', raza: 'Border Collie', peso: 18, idDueno: 902 },
    803: { id: 803, nombre: 'Rocco', especie: 'perro', raza: 'Bulldog Francés', peso: 12, idDueno: 903 },
    804: { id: 804, nombre: 'Nala', especie: 'perro', raza: 'Labrador', peso: 27, idDueno: 904 },
  };
  const base = (id, idMascota, extra) => ({
    id, idMascota, idDueno: mascotas[idMascota].idDueno, idWalker: null,
    duracionMin: 30, precio: 5000, direccion: null, lat: null, lng: null, notas: null,
    distanciaMetros: 0, segundosAcumulados: 0, reanudadoEn: null,
    horaInicio: null, horaFin: null, rating: null, resena: null,
    creadoEn: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    ...extra,
  });
  const paseos = [
    base(1, 802, { estado: 'pendiente', fecha: hoyA(17, 30), duracionMin: 60, precio: 9000,
      direccion: 'Av. Rivadavia 5200, Caballito', lat: -34.6187, lng: -58.4370,
      notas: 'Tira un poco de la correa. Llaves con el portero.' }),
    base(2, 803, { estado: 'pendiente', fecha: hoyA(19), precio: 5000,
      direccion: 'Acoyte 300, Caballito', lat: -34.6140, lng: -58.4366,
      notas: 'No le gustan los perros grandes.', creadoEn: new Date(Date.now() - 3 * 60 * 1000).toISOString() }),
    base(3, 801, { estado: 'aceptado', idWalker: 'yo', fecha: hoyA(15), duracionMin: 60, precio: 9000,
      direccion: 'Pedro Goyena 900, Caballito', lat: -34.6260, lng: -58.4410 }),
    base(10, 804, { estado: 'finalizado', idWalker: 'yo', fecha: haceDias(0, 9), duracionMin: 30, precio: 5000,
      horaInicio: haceDias(0, 9), horaFin: haceDias(0, 9), distanciaMetros: 2100, segundosAcumulados: 1860,
      rating: 5, resena: 'Nala volvió feliz y cansada. ¡Gracias!' }),
    base(11, 801, { estado: 'finalizado', idWalker: 'yo', fecha: haceDias(1), duracionMin: 60, precio: 9000,
      horaInicio: haceDias(1), horaFin: haceDias(1, 11), distanciaMetros: 4300, segundosAcumulados: 3640,
      rating: 5, resena: 'Súper puntual y me mandó fotos del paseo.' }),
    base(12, 802, { estado: 'finalizado', idWalker: 'yo', fecha: haceDias(2), duracionMin: 60, precio: 9000,
      horaInicio: haceDias(2), horaFin: haceDias(2, 11), distanciaMetros: 3900, segundosAcumulados: 3600, rating: 4 }),
    base(13, 803, { estado: 'finalizado', idWalker: 'yo', fecha: haceDias(4), precio: 5000,
      horaInicio: haceDias(4), horaFin: haceDias(4), distanciaMetros: 1800, segundosAcumulados: 1800 }),
    base(14, 804, { estado: 'finalizado', idWalker: 'yo', fecha: haceDias(9), precio: 5000,
      horaInicio: haceDias(9), horaFin: haceDias(9), distanciaMetros: 2000, segundosAcumulados: 1900, rating: 5,
      resena: 'Muy buena onda con Nala.' }),
    base(15, 801, { estado: 'finalizado', idWalker: 'yo', fecha: haceDias(16), duracionMin: 60, precio: 9000,
      horaInicio: haceDias(16), horaFin: haceDias(16, 11), distanciaMetros: 4100, segundosAcumulados: 3700 }),
  ];
  return {
    duenos, mascotas, paseos,
    rechazados: new Set(),
    pagos: [],
    mensajes: {
      3: [
        { id: 1, idUser: 901, texto: '¡Hola! Titán ya está listo, te espera en la puerta 🐶', fecha: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
      ],
    },
    perfil: {
      idUser: null, nombre: 'Paseador', apellido: 'Demo', foto: null,
      bio: 'Amo a los perros. Paseos tranquilos por plazas de Caballito.',
      zona: 'Caballito', zonas: ['Almagro', 'Flores'], lat: -34.6189, lng: -58.4380, radioKm: 3,
      servicios: [{ minutos: 30, precio: 5000 }, { minutos: 60, precio: 9000 }], maxPerros: 3, tamanos: ['chico', 'mediano', 'grande'],
      experienciaAnios: 2, disponible: true, horarios: HORARIOS_DEFAULT(), verificado: false,
    },
    notificaciones: [
      { id: 1, titulo: 'Tenés una solicitud nueva', mensaje: 'Rocco (Bulldog Francés) para hoy a las 19:00', fecha: new Date(Date.now() - 3 * 60 * 1000).toISOString(), leido: false },
    ],
  };
}

let demo = null;
function getDemo() {
  if (!demo) demo = crearDemo();
  return demo;
}

function mapDemoPaseo(p) {
  const d = getDemo();
  const m = d.mascotas[p.idMascota];
  const du = d.duenos[p.idDueno];
  return {
    ...p,
    abierta: p.idWalker == null,
    mascota: { ...m, visual: resolveMascotaVisual({ especie: m.especie, raza: m.raza }) },
    dueno: du,
  };
}

// ─────────────────────────────────────────────
// HELPERS DE FORMATO (compartidos por las pantallas)
// ─────────────────────────────────────────────

export const DIAS = [
  { key: 'lun', label: 'Lunes' }, { key: 'mar', label: 'Martes' },
  { key: 'mie', label: 'Miércoles' }, { key: 'jue', label: 'Jueves' },
  { key: 'vie', label: 'Viernes' }, { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

export function HORARIOS_DEFAULT() {
  const h = {};
  DIAS.forEach(({ key }) => {
    const finde = key === 'sab' || key === 'dom';
    h[key] = { activo: !finde, desde: '08:00', hasta: '19:00' };
  });
  return h;
}

/** $12.500 — separador de miles manual (Hermes no siempre trae locale es-AR). */
export function formatoPlata(n) {
  const entero = Math.round(Number(n) || 0);
  return `$${String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// ─────────────────────────────────────────────
// SERVICIOS: cada paseador define sus tiempos de paseo y el precio de cada uno
// ─────────────────────────────────────────────

export const SERVICIO_MIN_MINUTOS = 10;
export const SERVICIO_MAX_MINUTOS = 240;
export const SERVICIOS_MAX = 4;

/** 45 → "45 minutos" · 90 → "90 minutos" (mismo formato que el resto de la app) */
export const formatoDuracion = (min) => `${min} minutos`;

/**
 * Lista ordenada [{ minutos, precio }] de un perfil. Los perfiles anteriores a
 * la 040 no tienen `servicios`: se arman con los viejos precio_30 / precio_60.
 */
export function serviciosDe(p) {
  const lista = Array.isArray(p?.servicios) && p.servicios.length
    ? p.servicios
    : [{ minutos: 30, precio: p?.precio30 }, { minutos: 60, precio: p?.precio60 }];
  return lista
    .map((x) => ({ minutos: Number(x.minutos), precio: Number(x.precio) }))
    .filter((x) => x.minutos > 0 && x.precio > 0)
    .sort((a, b) => a.minutos - b.minutos);
}

/** Precio que cobra el paseador por un paseo de `minutos` (null si no lo ofrece). */
export function precioPara(paseador, minutos) {
  return serviciosDe(paseador).find((x) => x.minutos === Number(minutos))?.precio ?? null;
}

/**
 * Valida lo que cargó el paseador ([{ minutos, precio }] con strings o números).
 * Devuelve el mensaje del primer problema o null si está todo bien.
 */
export function validarServicios(lista) {
  if (!lista?.length) return 'Es necesario cargar al menos un tiempo de paseo con su precio';
  for (const x of lista) {
    const m = Number(x.minutos);
    if (!(m >= SERVICIO_MIN_MINUTOS && m <= SERVICIO_MAX_MINUTOS)) {
      return `Cada paseo tiene que durar entre ${SERVICIO_MIN_MINUTOS} y ${SERVICIO_MAX_MINUTOS} minutos`;
    }
    if (!(Number(x.precio) > 0)) return `Es necesario el precio del paseo de ${m} minutos`;
  }
  const minutos = lista.map((x) => Number(x.minutos));
  if (new Set(minutos).size !== minutos.length) return 'Hay dos paseos con la misma duración';
  return null;
}

/** 1.234 m → "1,2 km"; menos de 1 km → "850 m". */
export function formatoDistancia(metros) {
  const m = Math.max(0, Math.round(Number(metros) || 0));
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** 3725 s → "1:02:05"; 125 s → "02:05". */
export function formatoTimer(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function horaDe(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Hoy 17:30" / "Mañana 09:00" / "Vie 12/10 18:00" */
export function cuandoDe(iso) {
  if (!iso) return 'Sin horario';
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date();
  manana.setDate(hoy.getDate() + 1);
  const mismo = (a, b) => a.toDateString() === b.toDateString();
  if (mismo(d, hoy)) return `Hoy ${horaDe(iso)}`;
  if (mismo(d, manana)) return `Mañana ${horaDe(iso)}`;
  const dia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  return `${dia} ${d.getDate()}/${d.getMonth() + 1} ${horaDe(iso)}`;
}

/** Segundos caminados del paseo, contando el tramo que está corriendo ahora. */
export function segundosDePaseo(paseo, ahora = Date.now()) {
  if (!paseo) return 0;
  const tramo = paseo.reanudadoEn ? (ahora - new Date(paseo.reanudadoEn).getTime()) / 1000 : 0;
  return (paseo.segundosAcumulados ?? 0) + Math.max(0, tramo);
}

/** Distancia en metros entre dos coordenadas (haversine). */
export function distanciaMetros(a, b) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ─────────────────────────────────────────────
// AUTENTICACIÓN DEL PASEADOR
// ─────────────────────────────────────────────

async function entrarComoPaseador(id, mail) {
  await setCurrentUserId(id, mail);
  await setModo(MODO_PASEADOR);
  marcarPresencia(true);
}

/**
 * Login del paseador. A diferencia del login de dueños, NO guarda la sesión
 * hasta confirmar que la cuenta tiene perfil de paseador: si no lo tiene,
 * devuelve { necesitaActivar: true, email, hash } para ofrecer sumarlo. Si
 * tiene el rol pero no el perfil, devuelve { necesitaCompletar: true }.
 * Lanza Error('credenciales') si mail/contraseña no coinciden.
 */
export async function loginPaseador(email, password) {
  const mail = email.trim().toLowerCase();
  const hash = await hashPassword(password);

  const { data: usuario, error } = await supabase.rpc('login_user', { p_mail: mail, p_hash: hash });
  if (error) throw error;
  if (!usuario) throw new Error('credenciales');

  const { data: perfil, error: errPerfil } = await supabase
    .from('paseador_perfil').select('id_user').eq('id_user', usuario.id).maybeSingle();

  if (errPerfil) {
    // Sin la 035 no hay forma de saber si es paseador: se entra en demo.
    caerADemo(errPerfil);
    await entrarComoPaseador(usuario.id, mail);
    return { usuario };
  }
  if (!perfil) {
    // ¿Ya tiene el rol de paseador (ej. asignado a mano) y sólo le falta el
    // perfil? Entonces entra y lo completa, sin "activar" de nuevo.
    const { data: rol } = await supabase.from('UserRole').select('Id_Role')
      .eq('Id_User', usuario.id).eq('Id_Role', 2).maybeSingle();
    if (rol) {
      await setCurrentUserId(usuario.id, mail);
      return { necesitaCompletar: true };
    }
    return { necesitaActivar: true, email: mail, hash, nombre: usuario.nombre, fotoPerfil: usuario.fotoPerfil ?? null };
  }

  await entrarComoPaseador(usuario.id, mail);
  return { usuario };
}

function perfilParaRpc(perfil) {
  return {
    bio: perfil.bio?.trim() || null,
    zona: perfil.zona?.trim() || null,
    lat: perfil.lat ?? null,
    lng: perfil.lng ?? null,
    radioKm: perfil.radioKm ?? 3,
    servicios: serviciosDe(perfil),
    maxPerros: perfil.maxPerros ?? 3,
    tamanos: perfil.tamanos ?? ['chico', 'mediano', 'grande'],
    experienciaAnios: perfil.experienciaAnios ?? 0,
    horarios: perfil.horarios ?? HORARIOS_DEFAULT(),
  };
}

/**
 * Cuenta nueva de paseador. A diferencia del registro de dueños, entra
 * directo: el paseador viene a trabajar y no tiene sentido mandarlo de nuevo
 * al login.
 * Lanza Error('email_existente') si el mail ya tiene cuenta.
 */
export async function registrarPaseador({ usuario, perfil }) {
  if ((usuario.password ?? '').length < 7) throw new Error('password_corta');
  const hash = await hashPassword(usuario.password);

  const { data, error } = await supabase.rpc('registrar_paseador', {
    p_usuario: {
      nombre: usuario.nombre.trim(),
      apellido: usuario.apellido.trim(),
      email: usuario.email.trim().toLowerCase(),
      telefono: usuario.telefono?.trim() || null,
      genero: usuario.genero,
      fechaNacimiento: usuario.fechaNacimiento, // "YYYY-MM-DD"
    },
    p_hash: hash,
    p_perfil: perfilParaRpc(perfil),
  });

  if (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('email_existente') || error.code === '23505') throw new Error('email_existente');
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }
  await entrarComoPaseador(data.id, data.email ?? usuario.email);
  return data;
}

/**
 * Alta de paseador que vino de Google / Facebook / Apple: sin contraseña. El
 * mail lo toma el servidor de la sesión del proveedor (043) y `fotoPerfil` es
 * la foto del proveedor (si no eligió otra).
 */
export async function registrarPaseadorSocial({ usuario, perfil, fotoPerfil }) {
  let data;
  try {
    data = await rpcSocial('registrar_paseador_social', {
      p_usuario: {
        nombre: usuario.nombre.trim(),
        apellido: usuario.apellido.trim(),
        telefono: usuario.telefono?.trim() || null,
        genero: usuario.genero,
        fechaNacimiento: usuario.fechaNacimiento,
        fotoPerfil: fotoPerfil ?? null,
      },
      p_perfil: perfilParaRpc(perfil),
    });
  } catch (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('email_existente')) throw new Error('email_existente');
    if (error.message === 'sesion_social_vencida') throw error;
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }
  await entrarComoPaseador(data.id, data.email);
  return data;
}

/** Cuenta de dueño existente que entró con su proveedor y se suma como paseador. */
export async function activarPaseadorSocial(perfil) {
  let data;
  try {
    data = await rpcSocial('activar_paseador_social', { p_perfil: perfilParaRpc(perfil) });
  } catch (error) {
    if (error.message === 'sesion_social_vencida') throw error;
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }
  await entrarComoPaseador(data.id, data.email);
  return data;
}

/** Cuenta de dueño existente que se suma como paseador (pide su contraseña). */
export async function activarPaseador({ email, hash, perfil }) {
  const { data, error } = await supabase.rpc('activar_paseador', {
    p_mail: email, p_hash: hash, p_perfil: perfilParaRpc(perfil),
  });
  if (error) {
    if (String(error.message ?? '').includes('credenciales')) throw new Error('credenciales');
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }
  await entrarComoPaseador(data.id, email);
  return data;
}

/**
 * Cuenta con rol WALKER (UserRole 2) pero sin fila en paseador_perfil (ej. el
 * rol se asignó a mano en la base): completa el perfil sin pedir contraseña.
 * La RPC verifica en el servidor que el rol exista.
 */
export async function completarPerfilPaseador(perfil) {
  const { error } = await supabase.rpc('completar_perfil_paseador', {
    p_id_user: getCurrentUserId(), p_perfil: perfilParaRpc(perfil),
  });
  if (error) {
    if (String(error.message ?? '').includes('no_es_paseador')) throw new Error('no_es_paseador');
    if (!esEsquemaFaltante(error)) throw errorApp('error_base', error);
    // La 036 todavía no se corrió: el rol ya existe en UserRole, así que se
    // guarda el perfil directo en la tabla (la 035 la deja escribible).
    const f = perfilParaRpc(perfil);
    const { error: errDirecto } = await supabase.from('paseador_perfil').upsert({
      id_user: getCurrentUserId(), bio: f.bio, zona: f.zona, lat: f.lat, lng: f.lng,
      radio_km: f.radioKm, servicios: f.servicios,
      max_perros: f.maxPerros, tamanos: f.tamanos, experiencia_anios: f.experienciaAnios,
      horarios: f.horarios,
    });
    if (errDirecto) throw errorApp(esEsquemaFaltante(errDirecto) ? 'migracion_pendiente' : 'error_base', errDirecto);
  }
  await setModo(MODO_PASEADOR);
}

/** Foto de perfil que ya tiene la cuenta logueada (o null). */
export async function fetchMiFotoPerfil() {
  const { data } = await supabase.from('User').select('FotoPerfil').eq('Id_User', getCurrentUserId()).maybeSingle();
  return data?.FotoPerfil ?? null;
}

// ─────────────────────────────────────────────
// ROLES DE LA CUENTA (¿dueño, paseador o las dos?)
// ─────────────────────────────────────────────

/**
 * Qué "apps" puede usar la cuenta logueada:
 *   esDueno       → rol OWNER o tiene alguna mascota
 *   esPaseador    → rol WALKER o tiene perfil de paseador
 *   tienePerfil   → ya existe su fila en paseador_perfil (si es paseador
 *                   por rol pero sin perfil, hay que completarlo)
 * Devuelve null si no se pudo consultar (sin red): quien llama decide.
 */
export async function fetchRolesCuenta(id = getCurrentUserId()) {
  if (id == null) return null;
  const [roles, mascotas, perfil] = await Promise.all([
    supabase.from('UserRole').select('Id_Role').eq('Id_User', id),
    supabase.from('Mascota').select('Id_Mascota').eq('Id_User', id).limit(1),
    supabase.from('paseador_perfil').select('id_user').eq('id_user', id).maybeSingle(),
  ]);
  if (roles.error && mascotas.error) return null;
  const ids = new Set((roles.data ?? []).map((r) => r.Id_Role));
  const tienePerfil = !perfil.error && !!perfil.data;
  return {
    esDueno: ids.has(1) || (mascotas.data?.length ?? 0) > 0,
    esPaseador: ids.has(2) || tienePerfil,
    tienePerfil,
  };
}

// ─────────────────────────────────────────────
// GEOCODIFICACIÓN (Nominatim / OpenStreetMap)
// ─────────────────────────────────────────────
// Para la zona de atención: buscar un barrio y ponerle nombre al punto donde
// se suelta el círculo. Gratis y sin clave; si falla, la zona queda sin nombre
// automático y el paseador la escribe.

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/*
  Nominatim pide un User-Agent que identifique la aplicación; sin él responde
  429 o directamente bloquea. (En el navegador no se puede fijar —es un
  "forbidden header"— pero ahí va el del navegador, que le sirve igual.)
*/
const CABECERAS_NOMINATIM = {
  Accept: 'application/json',
  'User-Agent': 'ZooniApp/1.0 (app de mascotas; contacto en la app)',
};

/**
 * Busca lugares y devuelve VARIAS opciones para que el usuario elija.
 *
 * El buscador viejo pedía `limit=1` con el país como único filtro y se quedaba
 * con el primer resultado, sin mostrarlo. Con nombres de barrio repetidos en
 * Argentina eso mandaba a cualquier lado, en silencio:
 *
 *     "Belgrano" → Estación de Trenes Manuel Belgrano, Candioti Norte, Santa Fe
 *     "Nuñez"    → Nuñez, Güer Aike, Santa Cruz
 *
 * Son barrios de CABA y terminabas a 400 km. Acá se devuelven hasta 6
 * resultados con su nombre completo ("Belgrano, Comuna 13, CABA" vs "…Santa
 * Fe"), así la ambigüedad la resuelve quien sabe: el paseador.
 *
 * @param {string} texto
 * @param {{cerca?: {lat, lng}}} [opciones] prioriza resultados cerca de un punto
 * @returns {Promise<Array<{nombre, detalle, lat, lng}>>}
 */
export async function buscarLugares(texto, { cerca } = {}) {
  const q = (texto ?? '').trim();
  if (q.length < 3) return [];
  try {
    const params = new URLSearchParams({
      format: 'json', limit: '6', addressdetails: '1',
      'accept-language': 'es', countrycodes: 'ar', q,
    });
    // viewbox + bounded=0: no excluye nada, solo empuja hacia arriba lo cercano
    if (cerca?.lat != null) {
      const d = 0.6; // ~65 km
      params.set('viewbox', `${cerca.lng - d},${cerca.lat + d},${cerca.lng + d},${cerca.lat - d}`);
    }
    const res = await fetch(`${NOMINATIM}/search?${params}`, { headers: CABECERAS_NOMINATIM });
    if (!res.ok) return [];
    const lista = await res.json();
    return (lista ?? []).map((l) => {
      const a = l.address ?? {};
      const nombre = a.suburb || a.neighbourhood || a.quarter || a.city_district
        || a.town || a.village || a.city || l.name || q;
      // Lo que desambigua: partido/provincia. Sin esto, dos "Belgrano" se ven igual.
      const detalle = [a.city_district, a.city || a.town, a.state]
        .filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
      return { nombre, detalle, lat: Number(l.lat), lng: Number(l.lon) };
    });
  } catch {
    return [];
  }
}

/** Compatibilidad: el primer resultado de buscarLugares (solo coordenadas). */
export async function buscarLugar(texto, opciones) {
  const [primero] = await buscarLugares(texto, opciones);
  return primero ? { lat: primero.lat, lng: primero.lng } : null;
}

export async function barrioDe(lat, lng) {
  try {
    const url = `${NOMINATIM}/reverse?format=json&zoom=14&accept-language=es&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const a = (await res.json())?.address ?? {};
    return a.suburb || a.neighbourhood || a.quarter || a.city_district || a.town || a.city || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// PERFIL
// ─────────────────────────────────────────────

function mapPerfil(row, user) {
  return {
    idUser: row.id_user,
    nombre: user?.Nombre ?? '',
    apellido: user?.Apellido ?? '',
    foto: user?.FotoPerfil ?? null,
    telefono: user?.Telefono ?? null,
    bio: row.bio ?? '',
    zona: row.zona ?? '',
    zonas: row.zonas ?? [],
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    radioKm: Number(row.radio_km ?? 3),
    servicios: serviciosDe({
      servicios: row.servicios, precio30: row.precio_30, precio60: row.precio_60,
    }),
    maxPerros: row.max_perros ?? 3,
    tamanos: row.tamanos ?? [],
    experienciaAnios: row.experiencia_anios ?? 0,
    disponible: !!row.disponible,
    horarios: { ...HORARIOS_DEFAULT(), ...(row.horarios ?? {}) },
    verificado: !!row.verificado,
  };
}

export async function fetchPerfilPaseador() {
  const id = getCurrentUserId();
  const [{ data: row, error }, { data: user }] = await Promise.all([
    supabase.from('paseador_perfil').select('*').eq('id_user', id).maybeSingle(),
    supabase.from('User').select('Nombre, Apellido, FotoPerfil, Telefono').eq('Id_User', id).maybeSingle(),
  ]);
  if (error && caerADemo(error)) {
    const p = getDemo().perfil;
    if (user) Object.assign(p, { nombre: user.Nombre, apellido: user.Apellido, foto: user.FotoPerfil });
    return { ...p, idUser: id };
  }
  if (!row) return null;
  return mapPerfil(row, user);
}

/** Actualiza campos del perfil (camelCase → columnas). */
export async function actualizarPerfilPaseador(campos) {
  const columnas = {
    bio: 'bio', zona: 'zona', zonas: 'zonas', radioKm: 'radio_km', lat: 'lat', lng: 'lng',
    servicios: 'servicios', maxPerros: 'max_perros',
    tamanos: 'tamanos', experienciaAnios: 'experiencia_anios',
    disponible: 'disponible', horarios: 'horarios',
  };
  if (modoDemo) {
    Object.assign(getDemo().perfil, campos);
    return;
  }
  const fila = { actualizado_en: new Date().toISOString() };
  Object.entries(campos).forEach(([k, v]) => { if (columnas[k]) fila[columnas[k]] = v; });
  const { error } = await supabase.from('paseador_perfil').update(fila).eq('id_user', getCurrentUserId());
  if (error && !caerADemo(error)) throw error;
  if (error) Object.assign(getDemo().perfil, campos);
}

export function setDisponible(disponible) {
  return actualizarPerfilPaseador({ disponible });
}

// ─────────────────────────────────────────────
// PASEOS (lectura)
// ─────────────────────────────────────────────

const COLUMNAS_PASEO = '"Id_Paseo","Id_Mascota","Id_Walker","Id_Dueno","Estado","FechaProgramada","DuracionMin","Precio","Direccion","Lat","Lng","Notas","DistanciaMetros","SegundosAcumulados","ReanudadoEn","HoraInicio","HoraFin","Rating","Resena","CreadoEn"'
  .replace(/"/g, '');

/** Le agrega mascota y dueño a cada paseo (dos queries en lote, sin embeds). */
async function enriquecer(rows) {
  if (!rows?.length) return [];
  const idsMascota = [...new Set(rows.map((r) => r.Id_Mascota))];
  const { data: mascotas } = await supabase
    .from('Mascota')
    .select('Id_Mascota, Id_User, Nombre, Especie, Raza, Peso, Foto, ImagenAsset, MostrarFoto')
    .in('Id_Mascota', idsMascota);
  const porMascota = Object.fromEntries((mascotas ?? []).map((m) => [m.Id_Mascota, m]));

  const idsDueno = [...new Set(rows.map((r) => r.Id_Dueno ?? porMascota[r.Id_Mascota]?.Id_User).filter(Boolean))];
  const idsWalker = rows.map((r) => r.Id_Walker).filter(Boolean);
  const idsUsuarios = [...new Set([...idsDueno, ...idsWalker])];
  const { data: duenos } = idsUsuarios.length
    ? await supabase.from('User').select('Id_User, Nombre, Apellido, FotoPerfil, Telefono').in('Id_User', idsUsuarios)
    : { data: [] };
  const porDueno = Object.fromEntries((duenos ?? []).map((u) => [u.Id_User, u]));

  return rows.map((r) => {
    const m = porMascota[r.Id_Mascota] ?? {};
    const idDueno = r.Id_Dueno ?? m.Id_User ?? null;
    const u = porDueno[idDueno] ?? {};
    return {
      id: r.Id_Paseo,
      estado: r.Estado,
      abierta: r.Id_Walker == null,
      idWalker: r.Id_Walker,
      idDueno,
      fecha: r.FechaProgramada,
      duracionMin: r.DuracionMin ?? 30,
      precio: Number(r.Precio ?? 0),
      direccion: r.Direccion,
      lat: r.Lat != null ? Number(r.Lat) : null,
      lng: r.Lng != null ? Number(r.Lng) : null,
      notas: r.Notas,
      distanciaMetros: r.DistanciaMetros ?? 0,
      segundosAcumulados: r.SegundosAcumulados ?? 0,
      reanudadoEn: r.ReanudadoEn,
      horaInicio: r.HoraInicio,
      horaFin: r.HoraFin,
      rating: r.Rating,
      resena: r.Resena,
      creadoEn: r.CreadoEn,
      mascota: {
        id: m.Id_Mascota ?? r.Id_Mascota,
        nombre: m.Nombre ?? 'Mascota',
        especie: m.Especie,
        raza: m.Raza,
        peso: m.Peso != null ? Number(m.Peso) : null,
        visual: resolveMascotaVisual({
          fotoUrl: m.Foto, imagenAsset: m.ImagenAsset, especie: m.Especie,
          raza: m.Raza, mostrarFoto: m.MostrarFoto,
        }),
      },
      dueno: {
        id: idDueno,
        nombre: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim() || 'Dueño',
        foto: u.FotoPerfil ?? null,
        telefono: u.Telefono ?? null,
      },
      paseador: r.Id_Walker ? {
        id: r.Id_Walker,
        nombre: `${porDueno[r.Id_Walker]?.Nombre ?? ''} ${porDueno[r.Id_Walker]?.Apellido ?? ''}`.trim() || 'Paseador',
        foto: porDueno[r.Id_Walker]?.FotoPerfil ?? null,
      } : null,
    };
  });
}

function demoPaseos(filtro) {
  return getDemo().paseos.filter(filtro).map(mapDemoPaseo);
}

/** Solicitudes pendientes que puedo tomar: dirigidas a mí o abiertas. */
export async function fetchSolicitudes() {
  const yo = getCurrentUserId();
  const { data, error } = await supabase
    .from('Paseo').select(COLUMNAS_PASEO)
    .eq('Estado', 'pendiente')
    .or(`Id_Walker.is.null,Id_Walker.eq.${yo}`)
    .order('FechaProgramada', { ascending: true });

  if (error && caerADemo(error)) {
    const d = getDemo();
    return demoPaseos((p) => p.estado === 'pendiente' && !d.rechazados.has(p.id));
  }

  const { data: rechazos } = await supabase.from('paseo_rechazos').select('id_paseo').eq('id_walker', yo);
  const ocultas = new Set((rechazos ?? []).map((r) => r.id_paseo));
  // Una solicitud cuya hora ya pasó no se puede cumplir: no se ofrece.
  const limite = Date.now() - HORA;
  // Si el paseador también es dueño, sus propios pedidos no le aparecen.
  const vigentes = (data ?? []).filter((r) =>
    !ocultas.has(r.Id_Paseo) && r.Id_Dueno !== yo
    && (!r.FechaProgramada || new Date(r.FechaProgramada).getTime() > limite));
  return enriquecer(vigentes);
}

/** Mis paseos en ciertos estados (aceptado, en_curso, finalizado…). */
export async function fetchMisPaseos(estados, { desde } = {}) {
  const yo = getCurrentUserId();
  let q = supabase.from('Paseo').select(COLUMNAS_PASEO)
    .eq('Id_Walker', yo).in('Estado', estados)
    .order('FechaProgramada', { ascending: true });
  if (desde) q = q.gte('FechaProgramada', desde.toISOString());
  const { data, error } = await q;
  if (error && caerADemo(error)) {
    return demoPaseos((p) => p.idWalker === 'yo' && estados.includes(p.estado)
      && (!desde || new Date(p.fecha) >= desde));
  }
  return enriquecer(data ?? []);
}

/** El paseo que está en curso ahora (o null). */
export async function fetchPaseoEnCurso() {
  const lista = await fetchMisPaseos(['en_curso']);
  return lista[0] ?? null;
}

export async function fetchPaseo(id) {
  const { data, error } = await supabase.from('Paseo').select(COLUMNAS_PASEO).eq('Id_Paseo', id).maybeSingle();
  if (error && caerADemo(error)) {
    const p = getDemo().paseos.find((x) => x.id === id);
    return p ? mapDemoPaseo(p) : null;
  }
  if (!data) return null;
  return (await enriquecer([data]))[0];
}

/** Recorrido guardado del paseo: [{lat, lng}] en orden. */
export async function fetchRecorrido(idPaseo) {
  if (modoDemo) return [];
  const { data } = await supabase.from('PaseoTrack')
    .select('Lat, Lng').eq('Id_Paseo', idPaseo).order('Timestamp', { ascending: true });
  return (data ?? []).map((p) => ({ lat: Number(p.Lat), lng: Number(p.Lng) }));
}

// ─────────────────────────────────────────────
// PASEOS (acciones)
// ─────────────────────────────────────────────

/**
 * Avisa al dueño (tabla Notificacion de la app de dueños). Nunca rompe el flujo.
 *
 * `destino` queda guardado en DataExtra para que al tocar la notificación se
 * pueda abrir la pantalla correcta. Sin esto había que adivinar por el título
 * (ver destinoNotificacionPaseador, que sigue cubriendo las viejas).
 */
async function notificar(idUser, titulo, mensaje, destino = null) {
  if (modoDemo || !idUser) return;
  try {
    await supabase.from('Notificacion').insert({
      Id_User: idUser, Titulo: titulo, Mensaje: mensaje, Tipo: 'paseo', Leido: false,
      DataExtra: destino ? { destino } : null,
    });
  } catch {
    // La notificación es un extra: el cambio de estado ya quedó guardado.
  }
}

function notificarDueno(paseo, titulo, mensaje) {
  return notificar(paseo?.idDueno, titulo, mensaje);
}

function demoUpdate(id, cambios) {
  const p = getDemo().paseos.find((x) => x.id === id);
  if (p) Object.assign(p, cambios);
  return p ? mapDemoPaseo(p) : null;
}

async function updatePaseo(id, fila) {
  const { error } = await supabase.from('Paseo').update(fila).eq('Id_Paseo', id);
  if (error) throw error;
}

/** Devuelve false si otro paseador la tomó antes. */
export async function aceptarSolicitud(paseo) {
  if (modoDemo) {
    demoUpdate(paseo.id, { estado: 'aceptado', idWalker: 'yo' });
    return true;
  }
  const { data, error } = await supabase.rpc('aceptar_solicitud_paseo', {
    p_id_paseo: paseo.id, p_id_walker: getCurrentUserId(),
  });
  if (error) throw error;
  if (data) {
    notificarDueno(paseo, '¡Tu paseo fue aceptado! 🐾',
      `Un paseador va a pasear a ${paseo.mascota.nombre} (${cuandoDe(paseo.fecha)}).`);
  }
  return !!data;
}

export async function rechazarSolicitud(paseo) {
  if (modoDemo) {
    getDemo().rechazados.add(paseo.id);
    return;
  }
  if (paseo.abierta) {
    const { error } = await supabase.from('paseo_rechazos')
      .upsert({ id_paseo: paseo.id, id_walker: getCurrentUserId() });
    if (error) throw error;
    return;
  }
  await updatePaseo(paseo.id, { Estado: 'rechazado' });
  notificarDueno(paseo, 'Solicitud de paseo rechazada',
    `El paseador no puede pasear a ${paseo.mascota.nombre} en ese horario. Probá con otro.`);
}

/** Cancela un paseo ya aceptado (antes de empezar). */
export async function cancelarPaseo(paseo) {
  if (modoDemo) {
    demoUpdate(paseo.id, { estado: 'cancelado' });
    return;
  }
  await updatePaseo(paseo.id, { Estado: 'cancelado' });
  notificarDueno(paseo, 'Paseo cancelado',
    `El paseador canceló el paseo de ${paseo.mascota.nombre} (${cuandoDe(paseo.fecha)}).`);
}

export async function iniciarPaseo(paseo) {
  const ahora = new Date().toISOString();
  const cambios = { estado: 'en_curso', horaInicio: ahora, reanudadoEn: ahora, segundosAcumulados: 0, distanciaMetros: 0 };
  if (modoDemo) return demoUpdate(paseo.id, cambios);
  await updatePaseo(paseo.id, {
    Estado: 'en_curso', HoraInicio: ahora, ReanudadoEn: ahora, SegundosAcumulados: 0, DistanciaMetros: 0,
  });
  notificarDueno(paseo, `${paseo.mascota.nombre} salió a pasear 🦮`, 'Podés seguir el paseo en vivo desde la app.');
  return { ...paseo, ...cambios };
}

export async function pausarPaseo(paseo) {
  const segundos = Math.round(segundosDePaseo(paseo));
  const cambios = { segundosAcumulados: segundos, reanudadoEn: null };
  if (modoDemo) return demoUpdate(paseo.id, cambios);
  await updatePaseo(paseo.id, { SegundosAcumulados: segundos, ReanudadoEn: null });
  return { ...paseo, ...cambios };
}

export async function reanudarPaseo(paseo) {
  const ahora = new Date().toISOString();
  if (modoDemo) return demoUpdate(paseo.id, { reanudadoEn: ahora });
  await updatePaseo(paseo.id, { ReanudadoEn: ahora });
  return { ...paseo, reanudadoEn: ahora };
}

export async function finalizarPaseo(paseo, distancia) {
  const ahora = new Date().toISOString();
  const segundos = Math.round(segundosDePaseo(paseo));
  const metros = Math.round(distancia ?? paseo.distanciaMetros ?? 0);
  const cambios = {
    estado: 'finalizado', horaFin: ahora, reanudadoEn: null,
    segundosAcumulados: segundos, distanciaMetros: metros,
  };
  if (modoDemo) return demoUpdate(paseo.id, cambios);
  await updatePaseo(paseo.id, {
    Estado: 'finalizado', HoraFin: ahora, ReanudadoEn: null,
    SegundosAcumulados: segundos, DistanciaMetros: metros,
  });
  notificarDueno(paseo, `${paseo.mascota.nombre} ya volvió a casa 🏠`,
    `Paseo de ${Math.round(segundos / 60)} minutos · ${formatoDistancia(metros)}. ¡Dejale una reseña al paseador!`);
  return { ...paseo, ...cambios };
}

/** Guarda un punto del recorrido y la distancia acumulada. */
export async function registrarPunto(idPaseo, { lat, lng }, distanciaTotal) {
  if (modoDemo) {
    demoUpdate(idPaseo, { distanciaMetros: Math.round(distanciaTotal) });
    return;
  }
  await Promise.all([
    supabase.from('PaseoTrack').insert({ Id_Paseo: idPaseo, Lat: lat, Lng: lng, Timestamp: new Date().toISOString() }),
    supabase.from('Paseo').update({ DistanciaMetros: Math.round(distanciaTotal) }).eq('Id_Paseo', idPaseo),
  ]);
}

// ─────────────────────────────────────────────
// GANANCIAS Y RESEÑAS
// ─────────────────────────────────────────────

/** Inicio del período: 'semana' (desde el lunes), 'mes' (día 1) o 'todo'. */
export function inicioDePeriodo(periodo) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (periodo === 'semana') {
    const dow = (d.getDay() + 6) % 7; // lunes = 0
    d.setDate(d.getDate() - dow);
    return d;
  }
  if (periodo === 'mes') {
    d.setDate(1);
    return d;
  }
  return null;
}

/** Paseos finalizados del período, del más nuevo al más viejo. */
// ─────────────────────────────────────────────
// PAGOS: cuenta corriente del paseador con cada dueño (044)
// ─────────────────────────────────────────────

export const MEDIOS_PAGO = [
  { key: 'efectivo', label: 'Efectivo', icono: 'cash-outline' },
  { key: 'transferencia', label: 'Transferencia', icono: 'swap-horizontal-outline' },
  { key: 'mercadopago', label: 'Mercado Pago', icono: 'phone-portrait-outline' },
  { key: 'otro', label: 'Otro', icono: 'ellipsis-horizontal-circle-outline' },
];
export const medioDePago = (key) => MEDIOS_PAGO.find((m) => m.key === key) ?? null;

function mapPago(r) {
  return {
    id: r.id, idDueno: r.id_dueno, monto: Number(r.monto), medio: r.medio,
    fecha: r.fecha, nota: r.nota ?? '',
  };
}

async function leerPagos() {
  const { data, error } = await supabase.from('paseo_pagos').select('*')
    .eq('id_walker', getCurrentUserId()).order('fecha', { ascending: true });
  if (error) {
    if (modoDemo) return getDemo().pagos;
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }
  return (data ?? []).map(mapPago);
}

/**
 * Cuentas corrientes: una por dueño con el que hiciste paseos o que te pagó.
 *   cargos  = paseos finalizados (lo que te tiene que pagar)
 *   pagos   = lo que anotaste que te pagó
 *   saldo   = cargos - pagos (> 0 te debe, 0 al día, < 0 tiene saldo a favor)
 * Los pagos se imputan a los paseos más viejos primero: cada paseo queda
 * 'pagado', 'parcial' (con cuánto falta) o 'pendiente'.
 * Ordenadas: primero los que más deben; después los que están al día.
 */
export async function fetchCuentasCorrientes() {
  const [paseos, pagos] = await Promise.all([fetchMisPaseos(['finalizado']), leerPagos()]);

  // Medio de pago que eligió el dueño en cada paseo (columna de la 044; si no
  // está, la cuenta igual se arma sin ese dato)
  const medios = {};
  if (!modoDemo && paseos.length) {
    const { data } = await supabase.from('Paseo').select('"Id_Paseo","MedioPago"')
      .in('Id_Paseo', paseos.map((p) => p.id));
    (data ?? []).forEach((r) => { medios[r.Id_Paseo] = r.MedioPago; });
  }

  const cuentas = new Map();
  const cuentaDe = (idDueno, dueno) => {
    const key = String(idDueno);
    if (!cuentas.has(key)) {
      cuentas.set(key, { idDueno, dueno: dueno ?? { id: idDueno, nombre: 'Dueño', foto: null }, paseos: [], pagos: [], mascotas: new Set() });
    }
    const c = cuentas.get(key);
    if (dueno && c.dueno.nombre === 'Dueño') c.dueno = dueno;
    return c;
  };

  paseos.forEach((p) => {
    if (p.idDueno == null) return;
    const c = cuentaDe(p.idDueno, p.dueno);
    c.paseos.push({ ...p, medioPago: medios[p.id] ?? p.medioPago ?? null });
    c.mascotas.add(p.mascota.nombre);
  });
  pagos.forEach((pg) => cuentaDe(pg.idDueno).pagos.push(pg));

  const lista = [...cuentas.values()].map((c) => {
    c.paseos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    c.pagos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const totalCargos = c.paseos.reduce((a, p) => a + p.precio, 0);
    const totalPagado = c.pagos.reduce((a, pg) => a + pg.monto, 0);

    // Imputar los pagos a los paseos más viejos primero
    let disponible = totalPagado;
    const paseosEstado = c.paseos.map((p) => {
      const cubierto = Math.min(p.precio, Math.max(0, disponible));
      disponible -= cubierto;
      const estado = cubierto >= p.precio ? 'pagado' : cubierto > 0 ? 'parcial' : 'pendiente';
      return { ...p, cubierto, falta: p.precio - cubierto, estado };
    });

    const conMedio = [...paseosEstado].reverse().find((p) => p.medioPago);
    const fechas = [...c.paseos.map((p) => p.fecha), ...c.pagos.map((pg) => pg.fecha)];
    return {
      idDueno: c.idDueno,
      dueno: c.dueno,
      mascotas: [...c.mascotas],
      paseos: paseosEstado,
      pagos: c.pagos,
      totalCargos,
      totalPagado,
      saldo: Math.round((totalCargos - totalPagado) * 100) / 100,
      pendientes: paseosEstado.filter((p) => p.estado !== 'pagado').length,
      medioPreferido: conMedio?.medioPago ?? c.pagos[c.pagos.length - 1]?.medio ?? null,
      ultimoPago: c.pagos[c.pagos.length - 1]?.fecha ?? null,
      ultimoMovimiento: fechas.sort((a, b) => new Date(b) - new Date(a))[0] ?? null,
    };
  });

  return lista.sort((a, b) => {
    if ((a.saldo > 0) !== (b.saldo > 0)) return a.saldo > 0 ? -1 : 1;
    if (a.saldo > 0) return b.saldo - a.saldo;
    return new Date(b.ultimoMovimiento) - new Date(a.ultimoMovimiento);
  });
}

function filaPago({ idDueno, monto, medio, fecha, nota }) {
  return {
    id_dueno: idDueno,
    monto: Math.round(Number(monto) * 100) / 100,
    medio,
    fecha: (fecha instanceof Date ? fecha : new Date(fecha ?? Date.now())).toISOString(),
    nota: nota?.trim() || null,
  };
}

/** Anota un pago (total o parcial) de un dueño. Le avisa al dueño. */
export async function registrarPago(pago) {
  const fila = filaPago(pago);
  if (modoDemo) {
    getDemo().pagos.push(mapPago({ ...fila, id: Date.now() }));
    return;
  }
  const { error } = await supabase.from('paseo_pagos').insert({ ...fila, id_walker: getCurrentUserId() });
  if (error) throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  const medio = medioDePago(fila.medio);
  notificar(fila.id_dueno, 'Tu paseador registró un pago',
    `${formatoPlata(fila.monto)}${medio ? ` · ${medio.label}` : ''}. ¡Gracias!`);
}

/** Corrige un pago ya anotado (monto, medio, fecha o nota). */
export async function editarPago(id, pago) {
  const fila = filaPago(pago);
  if (modoDemo) {
    const i = getDemo().pagos.findIndex((x) => x.id === id);
    if (i >= 0) getDemo().pagos[i] = mapPago({ ...fila, id });
    return;
  }
  const { error } = await supabase.from('paseo_pagos')
    .update({ ...fila, actualizado_en: new Date().toISOString() })
    .eq('id', id).eq('id_walker', getCurrentUserId());
  if (error) throw errorApp('error_base', error);
}

export async function borrarPago(id) {
  if (modoDemo) {
    getDemo().pagos = getDemo().pagos.filter((x) => x.id !== id);
    return;
  }
  const { error } = await supabase.from('paseo_pagos').delete()
    .eq('id', id).eq('id_walker', getCurrentUserId());
  if (error) throw errorApp('error_base', error);
}

export async function fetchGanancias(periodo) {
  const desde = inicioDePeriodo(periodo);
  const lista = await fetchMisPaseos(['finalizado'], desde ? { desde } : {});
  return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

/**
 * Experiencia en Zooni: se cuenta sola desde el primer paseo terminado en la
 * app (no se pregunta al registrarse). → { valor, etiqueta } para un Stat.
 */
export function experienciaEnZooni(primerPaseo, ahora = new Date()) {
  if (!primerPaseo) return { valor: '–', etiqueta: 'de exp. en Zooni' };
  const desde = new Date(primerPaseo);
  let meses = (ahora.getFullYear() - desde.getFullYear()) * 12 + (ahora.getMonth() - desde.getMonth());
  if (ahora.getDate() < desde.getDate()) meses -= 1;
  if (meses < 1) return { valor: '<1', etiqueta: 'mes en Zooni' };
  if (meses < 12) return { valor: String(meses), etiqueta: meses === 1 ? 'mes en Zooni' : 'meses en Zooni' };
  const anios = Math.floor(meses / 12);
  return { valor: String(anios), etiqueta: anios === 1 ? 'año en Zooni' : 'años en Zooni' };
}

export async function fetchResenas() {
  const lista = await fetchMisPaseos(['finalizado']);
  const fechas = lista.map((p) => new Date(p.horaInicio ?? p.fecha).getTime()).filter(Number.isFinite);
  const conRating = lista.filter((p) => p.rating != null);
  const promedio = conRating.length
    ? conRating.reduce((acc, p) => acc + p.rating, 0) / conRating.length
    : null;
  return {
    promedio,
    cantidad: conRating.length,
    totalPaseos: lista.length,
    // Desde acá corre la experiencia (experienciaEnZooni)
    primerPaseo: fechas.length ? new Date(Math.min(...fechas)).toISOString() : null,
    resenas: conRating
      .filter((p) => p.resena)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
  };
}

// ─────────────────────────────────────────────
// CHAT DEL PASEO
// ─────────────────────────────────────────────

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

  if (modoDemo) {
    return ids
      .flatMap((id) => (getDemo().mensajes[id] ?? []))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .map((m) => ({
        id: m.id, texto: m.texto, fecha: m.fecha, autor: m.idUser === 'yo' ? 'yo' : 'otro',
      }));
  }
  const { data, error } = await supabase.from('paseo_mensajes')
    .select('*').in('id_paseo', ids).order('fecha', { ascending: true });
  if (error && caerADemo(error)) return getMensajesPaseo(idPaseo);
  return (data ?? []).map((m) => ({
    id: m.id, texto: m.texto, fecha: m.fecha, leido: m.leido, autor: m.id_user === yo ? 'yo' : 'otro',
  }));
}

export async function enviarMensajePaseo(paseo, texto) {
  const limpio = texto.trim().slice(0, 1000);
  if (!limpio) return getMensajesPaseo(paseo.id);
  if (modoDemo) {
    const d = getDemo();
    if (!d.mensajes[paseo.id]) d.mensajes[paseo.id] = [];
    d.mensajes[paseo.id].push({ id: Date.now(), idUser: 'yo', texto: limpio, fecha: new Date().toISOString() });
    return getMensajesPaseo(paseo.id);
  }
  const { error } = await supabase.from('paseo_mensajes').insert({
    id_paseo: paseo.id, id_user: getCurrentUserId(), texto: limpio, fecha: new Date().toISOString(),
  });
  if (error) throw error;
  const resumen = limpio.length > 80 ? `${limpio.slice(0, 80)}…` : limpio;
  if (getCurrentUserId() === paseo.idDueno) {
    notificar(paseo.idWalker, `Mensaje del dueño de ${paseo.mascota.nombre}`, resumen, 'chats');
  } else {
    notificarDueno(paseo, `Mensaje del paseador de ${paseo.mascota.nombre}`, resumen);
  }
  return getMensajesPaseo(paseo.id);
}

/** Marca leídos los mensajes recibidos. Acepta un id o una lista (ver getMensajesPaseo). */
export async function marcarLeidosPaseo(idPaseo) {
  if (modoDemo) return;
  const ids = (Array.isArray(idPaseo) ? idPaseo : [idPaseo]).filter((x) => x != null);
  if (!ids.length) return;
  await supabase.from('paseo_mensajes').update({ leido: true })
    .in('id_paseo', ids).neq('id_user', getCurrentUserId()).eq('leido', false);
}

// ─────────────────────────────────────────────
// NOTIFICACIONES DEL PASEADOR
// ─────────────────────────────────────────────

export async function fetchNotificacionesPaseador() {
  if (modoDemo) return getDemo().notificaciones;
  // Tipo y DataExtra se traen para poder navegar al tocar la notificación,
  // igual que en el panel del Home de dueños.
  const { data } = await supabase.from('Notificacion')
    .select('Id, Titulo, Mensaje, Fecha, Leido, Tipo, DataExtra')
    .eq('Id_User', getCurrentUserId())
    .order('Fecha', { ascending: false })
    .limit(20);
  return (data ?? []).map((n) => ({
    id: n.Id, titulo: n.Titulo, mensaje: n.Mensaje, fecha: n.Fecha, leido: n.Leido,
    tipo: n.Tipo ?? null, dataExtra: n.DataExtra ?? null,
  }));
}

/**
 * A dónde lleva una notificación del paseador al tocarla.
 *
 * Las notificaciones viejas se guardaron todas con Tipo 'paseo' y sin
 * DataExtra, así que para esas hay que mirar el título. Las nuevas traen
 * `DataExtra.destino` y entran por el primer caso.
 *
 * @returns {'chats'|'solicitudes'|'inicio'}
 */
export function destinoNotificacionPaseador(n) {
  if (n?.dataExtra?.destino) return n.dataExtra.destino;
  if (n?.tipo === 'mensaje') return 'chats';

  const titulo = String(n?.titulo ?? '').toLowerCase();
  if (titulo.includes('mensaje')) return 'chats';
  if (titulo.includes('solicitud')) return 'solicitudes';
  return 'inicio';
}

/** Marca UNA notificación como leída (al tocarla), sin tocar las demás. */
export async function marcarNotificacionPaseadorLeida(id) {
  if (modoDemo) {
    const n = getDemo().notificaciones.find((x) => x.id === id);
    if (n) n.leido = true;
    return;
  }
  await supabase.from('Notificacion').update({ Leido: true })
    .eq('Id', id).eq('Id_User', getCurrentUserId());
}

export async function marcarNotificacionesLeidas() {
  if (modoDemo) {
    getDemo().notificaciones.forEach((n) => { n.leido = true; });
    return;
  }
  await supabase.from('Notificacion').update({ Leido: true })
    .eq('Id_User', getCurrentUserId()).eq('Leido', false);
}

// ═════════════════════════════════════════════════════════════════════════════
// LADO DUEÑO: encontrar paseadores, pedir paseos, seguirlos y calificarlos
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Paseadores registrados en Zooni con zona cargada (los que dibujan su círculo
 * en Comunidad). Con bbox, sólo los que tienen el centro en el área visible
 * más un margen (el círculo puede asomar aunque el centro esté afuera).
 * Nunca se incluye a uno mismo.
 */
export async function fetchPaseadoresZona(bbox) {
  let q = supabase.from('paseador_perfil').select('*').not('lat', 'is', null);
  if (bbox) {
    const m = 0.05; // ~5 km de margen
    q = q.gte('lat', bbox.lat_min - m).lte('lat', bbox.lat_max + m)
      .gte('lng', bbox.lng_min - m).lte('lng', bbox.lng_max + m);
  }
  const { data, error } = await q.limit(100);
  if (error) return []; // sin la 035: Comunidad sigue como antes
  const yo = getCurrentUserId();
  const filas = (data ?? []).filter((r) => r.id_user !== yo);
  if (!filas.length) return [];

  const ids = filas.map((r) => r.id_user);
  const [{ data: usuarios }, { data: calificados }] = await Promise.all([
    supabase.from('User').select('Id_User, Nombre, Apellido, FotoPerfil').in('Id_User', ids),
    supabase.from('Paseo').select('Id_Walker, Rating').in('Id_Walker', ids).eq('Estado', 'finalizado'),
  ]);
  const porUser = Object.fromEntries((usuarios ?? []).map((u) => [u.Id_User, u]));
  const stats = {};
  (calificados ?? []).forEach((pz) => {
    if (!stats[pz.Id_Walker]) stats[pz.Id_Walker] = { paseos: 0, suma: 0, votos: 0 };
    const st = stats[pz.Id_Walker];
    st.paseos += 1;
    if (pz.Rating != null) { st.suma += pz.Rating; st.votos += 1; }
  });

  return filas.map((r) => {
    const u = porUser[r.id_user] ?? {};
    const st = stats[r.id_user] ?? { paseos: 0, suma: 0, votos: 0 };
    return {
      ...mapPerfil(r, u),
      id: r.id_user,
      nombreCompleto: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim() || 'Paseador',
      paseos: st.paseos,
      rating: st.votos ? st.suma / st.votos : null,
      votos: st.votos,
    };
  });
}

// Tope del radio de un paseador (CHECK paseador_radio_ok de la 035)
const RADIO_MAX_KM = 30;

function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Paseadores que hacen paseos EN TU ZONA: sólo los que tienen tu ubicación
 * dentro de su círculo de atención (centro + radio). Los que pasean en otro
 * lado no aparecen, aunque estén en la parte visible del mapa.
 *
 * `pos` es tu ubicación (GPS). Sin GPS se usa la última que guardó Comunidad
 * (ubicaciones_usuarios); si tampoco hay, no se muestra ninguno.
 */
export async function fetchPaseadoresParaMi(pos) {
  let yo = pos?.lat != null ? pos : null;
  if (!yo) {
    const { data } = await supabase.from('ubicaciones_usuarios')
      .select('lat, lng').eq('usuario_id', getCurrentUserId()).maybeSingle();
    if (data?.lat != null) yo = { lat: Number(data.lat), lng: Number(data.lng) };
  }
  if (!yo) return [];

  // Un paseador te cubre sólo si su centro está a menos de su radio (máx.
  // RADIO_MAX_KM): se buscan los de esa caja y se filtra por distancia real.
  const dLat = RADIO_MAX_KM / 111;
  const dLng = dLat / Math.cos((yo.lat * Math.PI) / 180);
  const cerca = await fetchPaseadoresZona({
    lat_min: yo.lat - dLat, lat_max: yo.lat + dLat, lng_min: yo.lng - dLng, lng_max: yo.lng + dLng,
  });
  return cerca
    .map((p) => ({ ...p, distanciaKm: distanciaKm(yo, p) }))
    .filter((p) => p.distanciaKm <= p.radioKm)
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
}

export async function fetchPaseadorPublico(idUser) {
  const { data: row } = await supabase.from('paseador_perfil').select('*').eq('id_user', idUser).maybeSingle();
  if (!row) return null;
  const lista = await fetchPaseadoresZona(null);
  return lista.find((x) => x.id === idUser)
    ?? { ...mapPerfil(row, {}), id: idUser, nombreCompleto: 'Paseador', paseos: 0, rating: null, votos: 0 };
}

/**
 * El dueño le pide un paseo a un paseador puntual. Queda 'pendiente' y le
 * llega en Solicitudes ("Para vos"). Devuelve el id del paseo.
 */
export async function crearSolicitudPaseo({
  paseador, mascota, fecha, duracionMin, direccion, lat, lng, notas, medioPago,
}) {
  const precio = precioPara(paseador, duracionMin);
  if (precio == null) throw new Error('servicio_inexistente');
  const fila = {
    Id_Mascota: mascota.id,
    Id_Dueno: getCurrentUserId(),
    Id_Walker: paseador.id,
    FechaProgramada: fecha.toISOString(),
    DuracionMin: duracionMin,
    Precio: precio,
    Direccion: direccion?.trim() || null,
    Lat: lat ?? null,
    Lng: lng ?? null,
    Notas: notas?.trim() || null,
    Estado: 'pendiente',
    MedioPago: medioPago ?? null,
  };
  let { data, error } = await supabase.from('Paseo').insert(fila).select('Id_Paseo').single();
  if (error && esEsquemaFaltante(error) && /MedioPago/i.test(String(error.message))) {
    // Sin la 044: la solicitud sale igual, sin el medio de pago
    const { MedioPago, ...sinMedio } = fila; // eslint-disable-line no-unused-vars
    ({ data, error } = await supabase.from('Paseo').insert(sinMedio).select('Id_Paseo').single());
  }
  if (error) throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);

  const medio = MEDIOS_PAGO.find((m) => m.key === medioPago);
  notificar(paseador.id, 'Tenés una solicitud nueva',
    `${mascota.nombre} · ${cuandoDe(fecha.toISOString())} · ${duracionMin} minutos · ${formatoPlata(precio)}${medio ? ` · paga con ${medio.label}` : ''}`,
    'solicitudes');
  return data.Id_Paseo;
}

/** Paseos que pedí como dueño (todos los estados), del más nuevo al más viejo. */
export async function fetchMisPaseosDueno() {
  const { data, error } = await supabase.from('Paseo').select(COLUMNAS_PASEO)
    .eq('Id_Dueno', getCurrentUserId())
    .order('CreadoEn', { ascending: false })
    .limit(50);
  if (error) throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  return enriquecer(data ?? []);
}

/** El dueño cancela su pedido (pendiente o aceptado) y le avisa al paseador. */
export async function cancelarPaseoDueno(paseo) {
  const { error } = await supabase.from('Paseo').update({ Estado: 'cancelado' })
    .eq('Id_Paseo', paseo.id).in('Estado', ['pendiente', 'aceptado']);
  if (error) throw error;
  notificar(paseo.idWalker, 'Paseo cancelado por el dueño',
    `${paseo.mascota.nombre} · ${cuandoDe(paseo.fecha)}`);
}

// ─────────────────────────────────────────────
// RESEÑAS (estilo Google Maps): estrellas + aspectos + preguntas + fotos/videos
// ─────────────────────────────────────────────

/** Aspectos que el dueño puede puntuar de 1 a 5 (opcionales). */
export const ASPECTOS_RESENA = [
  { key: 'puntualidad', label: 'Puntualidad' },
  { key: 'trato', label: 'Trato con tu mascota' },
  { key: 'comunicacion', label: 'Comunicación' },
];

/** Preguntas de sí / no (opcionales). `resumen` es como se muestra el % de "sí". */
export const PREGUNTAS_RESENA = [
  { key: 'fotos', pregunta: '¿Te mandó fotos o novedades durante el paseo?', resumen: 'manda novedades' },
  { key: 'contenta', pregunta: '¿Tu mascota volvió tranquila y contenta?', resumen: 'mascotas contentas' },
  { key: 'repetiria', pregunta: '¿Lo volverías a contratar?', resumen: 'lo volvería a contratar' },
];

export const MEDIA_RESENA_MAX = 6;

/**
 * Calificación del dueño al terminar. `media` son los archivos elegidos con
 * el picker ([{ uri, mimeType }]): se suben al bucket "resenas" y se guardan
 * sus URLs. Al paseador le llega una notificación que lo lleva a su Perfil.
 *
 * Devuelve { parcial: true } si la base no tiene la 042: se guardaron las
 * estrellas y el texto, pero no aspectos, respuestas ni fotos.
 */
export async function calificarPaseo(paseo, {
  rating, resena, aspectos = {}, respuestas = {}, media = [],
}) {
  const texto = resena?.trim() || null;
  const subidos = [];
  for (const m of media.slice(0, MEDIA_RESENA_MAX)) {
    // eslint-disable-next-line no-await-in-loop
    subidos.push(await subirArchivoPublico(m.uri, `paseo-${paseo.id}`, { bucket: 'resenas', mimeHint: m.mimeType }));
  }

  let parcial = false;
  const { error } = await supabase.from('Paseo').update({
    Rating: rating,
    Resena: texto,
    ResenaAspectos: Object.keys(aspectos).length ? aspectos : null,
    ResenaRespuestas: Object.keys(respuestas).length ? respuestas : null,
    ResenaMedia: subidos,
    ResenaFecha: new Date().toISOString(),
  }).eq('Id_Paseo', paseo.id).eq('Estado', 'finalizado');
  if (error) {
    if (!esEsquemaFaltante(error)) throw error;
    // Sin la 042: lo básico igual se guarda
    const { error: errBasico } = await supabase.from('Paseo')
      .update({ Rating: rating, Resena: texto })
      .eq('Id_Paseo', paseo.id).eq('Estado', 'finalizado');
    if (errBasico) throw errBasico;
    parcial = true;
  }

  const fotos = subidos.filter((x) => x.tipo === 'imagen').length;
  const videos = subidos.length - fotos;
  const adjuntos = [
    fotos ? `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}` : null,
    videos ? `${videos} ${videos === 1 ? 'video' : 'videos'}` : null,
  ].filter(Boolean).join(' y ');
  notificar(
    paseo.idWalker,
    `Nueva reseña: ${rating} ${rating === 1 ? 'estrella' : 'estrellas'}`,
    [texto ? `"${texto.slice(0, 80)}"` : `Paseo con ${paseo.mascota.nombre}`, adjuntos ? `con ${adjuntos}` : null]
      .filter(Boolean).join(' · '),
    'perfil',
  );
  return { parcial };
}

const COLUMNAS_RESENA = '"Id_Paseo","Id_Mascota","Id_Dueno","FechaProgramada","DuracionMin","Rating","Resena","ResenaAspectos","ResenaRespuestas","ResenaMedia","ResenaFecha"';

/**
 * Todas las reseñas de un paseador, con el resumen que se muestra arriba
 * (promedio, cuántas de cada estrella, promedio por aspecto, % de "sí" por
 * pregunta y todas las fotos/videos juntos).
 */
export async function fetchResenasPaseador(idWalker) {
  let { data, error } = await supabase.from('Paseo').select(COLUMNAS_RESENA)
    .eq('Id_Walker', idWalker).eq('Estado', 'finalizado').not('Rating', 'is', null);
  if (error && esEsquemaFaltante(error)) {
    // Sin la 042: sólo estrellas y texto
    ({ data, error } = await supabase.from('Paseo')
      .select('"Id_Paseo","Id_Mascota","Id_Dueno","FechaProgramada","DuracionMin","Rating","Resena"')
      .eq('Id_Walker', idWalker).eq('Estado', 'finalizado').not('Rating', 'is', null));
  }
  if (error) throw error;
  const filas = data ?? [];

  const idsDuenos = [...new Set(filas.map((r) => r.Id_Dueno).filter(Boolean))];
  const idsMascotas = [...new Set(filas.map((r) => r.Id_Mascota).filter(Boolean))];
  const [{ data: duenos }, { data: mascotas }] = await Promise.all([
    idsDuenos.length
      ? supabase.from('User').select('Id_User, Nombre, Apellido, FotoPerfil').in('Id_User', idsDuenos)
      : { data: [] },
    idsMascotas.length
      ? supabase.from('Mascota').select('Id_Mascota, Nombre, Especie, Raza, Foto, ImagenAsset, MostrarFoto').in('Id_Mascota', idsMascotas)
      : { data: [] },
  ]);
  const porDueno = Object.fromEntries((duenos ?? []).map((u) => [u.Id_User, u]));
  const porMascota = Object.fromEntries((mascotas ?? []).map((m) => [m.Id_Mascota, m]));

  const resenas = filas.map((r) => {
    const u = porDueno[r.Id_Dueno] ?? {};
    const m = porMascota[r.Id_Mascota] ?? {};
    return {
      id: r.Id_Paseo,
      rating: r.Rating,
      resena: r.Resena,
      fecha: r.ResenaFecha ?? r.FechaProgramada,
      duracionMin: r.DuracionMin,
      aspectos: r.ResenaAspectos ?? {},
      respuestas: r.ResenaRespuestas ?? {},
      media: Array.isArray(r.ResenaMedia) ? r.ResenaMedia : [],
      dueno: {
        nombre: `${u.Nombre ?? ''} ${(u.Apellido ?? '').slice(0, 1)}${u.Apellido ? '.' : ''}`.trim() || 'Dueño',
        foto: u.FotoPerfil ?? null,
      },
      mascota: {
        nombre: m.Nombre ?? 'Mascota',
        visual: resolveMascotaVisual({
          fotoUrl: m.Foto, imagenAsset: m.ImagenAsset, especie: m.Especie, raza: m.Raza, mostrarFoto: m.MostrarFoto,
        }),
      },
    };
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const distribucion = [5, 4, 3, 2, 1].map((n) => ({ estrellas: n, cantidad: resenas.filter((r) => r.rating === n).length }));
  const aspectos = ASPECTOS_RESENA.map((a) => {
    const vals = resenas.map((r) => Number(r.aspectos[a.key])).filter((v) => v >= 1);
    return { ...a, promedio: vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null, votos: vals.length };
  });
  const preguntas = PREGUNTAS_RESENA.map((p) => {
    const vals = resenas.map((r) => r.respuestas[p.key]).filter((v) => typeof v === 'boolean');
    return { ...p, porcentaje: vals.length ? Math.round((vals.filter(Boolean).length / vals.length) * 100) : null, votos: vals.length };
  });

  return {
    promedio: resenas.length ? resenas.reduce((a, r) => a + r.rating, 0) / resenas.length : null,
    cantidad: resenas.length,
    distribucion,
    aspectos,
    preguntas,
    media: resenas.flatMap((r) => r.media.map((x) => ({ ...x, idResena: r.id }))),
    resenas,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// INBOX DE CHATS (paseador y dueño)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Una conversación por paseo, con el último mensaje y cuántos no leí.
 * rol 'paseador' → paseos donde soy el paseador (incluye solicitudes que me
 * llegaron); rol 'dueno' → paseos que pedí. Primero las que tienen mensajes
 * más recientes; después las activas sin mensajes todavía.
 */
export async function fetchConversacionesPaseo(rol = 'paseador') {
  const yo = getCurrentUserId();
  let paseos;
  if (modoDemo && rol === 'paseador') {
    paseos = demoPaseos((p) => p.idWalker === 'yo' && ['aceptado', 'en_curso', 'finalizado'].includes(p.estado));
  } else {
    const columna = rol === 'paseador' ? 'Id_Walker' : 'Id_Dueno';
    const { data, error } = await supabase.from('Paseo').select(COLUMNAS_PASEO)
      .eq(columna, yo)
      .in('Estado', ['pendiente', 'aceptado', 'en_curso', 'finalizado'])
      .order('CreadoEn', { ascending: false })
      .limit(40);
    if (error) {
      if (rol === 'paseador' && caerADemo(error)) return fetchConversacionesPaseo(rol);
      return [];
    }
    paseos = await enriquecer(data ?? []);
  }
  if (!paseos.length) return [];

  let mensajes = [];
  if (modoDemo) {
    paseos.forEach((p) => (getDemo().mensajes[p.id] ?? []).forEach((m) => mensajes.push({
      id_paseo: p.id, id_user: m.idUser === 'yo' ? yo : m.idUser, texto: m.texto, fecha: m.fecha, leido: true,
    })));
  } else {
    const { data } = await supabase.from('paseo_mensajes')
      .select('id_paseo, id_user, texto, fecha, leido')
      .in('id_paseo', paseos.map((p) => p.id))
      .order('fecha', { ascending: false })
      .limit(500);
    mensajes = data ?? [];
  }

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

/** Dirección legible de unas coordenadas (para "Usar mi ubicación"). */
export async function direccionDe(lat, lng) {
  try {
    const url = `${NOMINATIM}/reverse?format=json&zoom=18&accept-language=es&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const a = (await res.json())?.address ?? {};
    const calle = [a.road, a.house_number].filter(Boolean).join(' ');
    const barrio = a.suburb || a.neighbourhood || a.city_district || a.city;
    return [calle, barrio].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}
