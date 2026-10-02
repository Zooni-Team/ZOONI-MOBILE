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
    mensajes: {
      3: [
        { id: 1, idUser: 901, texto: '¡Hola! Titán ya está listo, te espera en la puerta 🐶', fecha: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
      ],
    },
    perfil: {
      idUser: null, nombre: 'Paseador', apellido: 'Demo', foto: null,
      bio: 'Amo a los perros. Paseos tranquilos por plazas de Caballito.',
      zona: 'Caballito', zonas: ['Almagro', 'Flores'], radioKm: 3,
      precio30: 5000, precio60: 9000, maxPerros: 3, tamanos: ['chico', 'mediano', 'grande'],
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

async function entrarComoPaseador(id) {
  await setCurrentUserId(id);
  await setModo(MODO_PASEADOR);
  marcarPresencia(true);
}

/**
 * Login del paseador. A diferencia del login de dueños, NO guarda la sesión
 * hasta confirmar que la cuenta tiene perfil de paseador: si no lo tiene,
 * devuelve { necesitaActivar: true, email, hash } para ofrecer sumarlo.
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
    await entrarComoPaseador(usuario.id);
    return { usuario };
  }
  if (!perfil) return { necesitaActivar: true, email: mail, hash, nombre: usuario.nombre };

  await entrarComoPaseador(usuario.id);
  return { usuario };
}

function perfilParaRpc(perfil) {
  return {
    bio: perfil.bio?.trim() || null,
    zona: perfil.zona?.trim() || null,
    radioKm: perfil.radioKm ?? 3,
    precio30: perfil.precio30 ?? 0,
    precio60: perfil.precio60 ?? 0,
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
    },
    p_hash: hash,
    p_perfil: perfilParaRpc(perfil),
  });

  if (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('email_existente') || error.code === '23505') throw new Error('email_existente');
    if (esEsquemaFaltante(error)) throw new Error('migracion_pendiente');
    throw error;
  }
  await entrarComoPaseador(data.id);
  return data;
}

/** Cuenta de dueño existente que se suma como paseador (pide su contraseña). */
export async function activarPaseador({ email, hash, perfil }) {
  const { data, error } = await supabase.rpc('activar_paseador', {
    p_mail: email, p_hash: hash, p_perfil: perfilParaRpc(perfil),
  });
  if (error) {
    if (String(error.message ?? '').includes('credenciales')) throw new Error('credenciales');
    if (esEsquemaFaltante(error)) throw new Error('migracion_pendiente');
    throw error;
  }
  await entrarComoPaseador(data.id);
  return data;
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
    radioKm: Number(row.radio_km ?? 3),
    precio30: Number(row.precio_30 ?? 0),
    precio60: Number(row.precio_60 ?? 0),
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
    bio: 'bio', zona: 'zona', zonas: 'zonas', radioKm: 'radio_km',
    precio30: 'precio_30', precio60: 'precio_60', maxPerros: 'max_perros',
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
  const { data: duenos } = idsDueno.length
    ? await supabase.from('User').select('Id_User, Nombre, Apellido, FotoPerfil, Telefono').in('Id_User', idsDueno)
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

/** Avisa al dueño (tabla Notificacion de la app de dueños). Nunca rompe el flujo. */
async function notificarDueno(paseo, titulo, mensaje) {
  if (modoDemo || !paseo?.idDueno) return;
  try {
    await supabase.from('Notificacion').insert({
      Id_User: paseo.idDueno, Titulo: titulo, Mensaje: mensaje, Tipo: 'paseo', Leido: false,
    });
  } catch {
    // La notificación es un extra: el cambio de estado ya quedó guardado.
  }
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
    `Paseo de ${Math.round(segundos / 60)} min · ${formatoDistancia(metros)}. ¡Dejale una reseña al paseador!`);
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
export async function fetchGanancias(periodo) {
  const desde = inicioDePeriodo(periodo);
  const lista = await fetchMisPaseos(['finalizado'], desde ? { desde } : {});
  return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

export async function fetchResenas() {
  const lista = await fetchMisPaseos(['finalizado']);
  const conRating = lista.filter((p) => p.rating != null);
  const promedio = conRating.length
    ? conRating.reduce((acc, p) => acc + p.rating, 0) / conRating.length
    : null;
  return {
    promedio,
    cantidad: conRating.length,
    totalPaseos: lista.length,
    resenas: conRating
      .filter((p) => p.resena)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
  };
}

// ─────────────────────────────────────────────
// CHAT DEL PASEO
// ─────────────────────────────────────────────

export async function getMensajesPaseo(idPaseo) {
  const yo = getCurrentUserId();
  if (modoDemo) {
    return (getDemo().mensajes[idPaseo] ?? []).map((m) => ({
      id: m.id, texto: m.texto, fecha: m.fecha, autor: m.idUser === 'yo' ? 'yo' : 'otro',
    }));
  }
  const { data, error } = await supabase.from('paseo_mensajes')
    .select('*').eq('id_paseo', idPaseo).order('fecha', { ascending: true });
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
  notificarDueno(paseo, `Mensaje del paseador de ${paseo.mascota.nombre}`,
    limpio.length > 80 ? `${limpio.slice(0, 80)}…` : limpio);
  return getMensajesPaseo(paseo.id);
}

export async function marcarLeidosPaseo(idPaseo) {
  if (modoDemo) return;
  await supabase.from('paseo_mensajes').update({ leido: true })
    .eq('id_paseo', idPaseo).neq('id_user', getCurrentUserId()).eq('leido', false);
}

// ─────────────────────────────────────────────
// NOTIFICACIONES DEL PASEADOR
// ─────────────────────────────────────────────

export async function fetchNotificacionesPaseador() {
  if (modoDemo) return getDemo().notificaciones;
  const { data } = await supabase.from('Notificacion')
    .select('Id, Titulo, Mensaje, Fecha, Leido')
    .eq('Id_User', getCurrentUserId())
    .order('Fecha', { ascending: false })
    .limit(20);
  return (data ?? []).map((n) => ({
    id: n.Id, titulo: n.Titulo, mensaje: n.Mensaje, fecha: n.Fecha, leido: n.Leido,
  }));
}

export async function marcarNotificacionesLeidas() {
  if (modoDemo) {
    getDemo().notificaciones.forEach((n) => { n.leido = true; });
    return;
  }
  await supabase.from('Notificacion').update({ Leido: true })
    .eq('Id_User', getCurrentUserId()).eq('Leido', false);
}
