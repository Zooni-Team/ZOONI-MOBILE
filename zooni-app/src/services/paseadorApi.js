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
import { crearCuentaConPassword, iniciarSesionConPassword } from './authApi';
import { marcarPresencia } from './presenciaApi';
import { resolveMascotaVisual } from '../constants/petImages';
import { subirArchivoPublico } from '../utils/imagenStorage';
import { rpcSocial } from './socialAuthApi';
import { perfilesPorId } from './perfilesPublicos';
import { distanciaMetros } from '../utils/geo';
import { fechaHoraFija } from '../utils/fechaLocal';
import { estadoVigente, HORARIOS_DEFAULT, formatoPlata, aCentavos, serviciosDe, precioPara, formatoDistancia, segundosDePaseo, formatoTiempoPaseado, comisionDe, inicioDePeriodo, MEDIOS_PAGO, medioDePago, ultimoCierre, proximoCierre, ASPECTOS_RESENA, PREGUNTAS_RESENA, MEDIA_RESENA_MAX } from '../domain/paseos';
import { errorApp, esEsquemaFaltante, esNotificacionDePaseador, esSinPermiso, notificar } from './comun';

/**
 * Aviso de paseos. `modo` dice en qué modo de la app se muestra (una cuenta
 * puede ser dueña y paseadora); `destino` es la pestaña del paseador que abre.
 */
const notificarPaseo = (idUser, titulo, mensaje, destino = null, modo = 'paseador') =>
  notificar(idUser, titulo, mensaje, { tipo: 'paseo', destino, extra: { modo } });

// Reglas y formatos puros de paseos (re-exportados para no romper a quien ya
// los importaba desde acá). La distancia vive en utils/geo.
export * from '../domain/paseos';
export { distanciaMetros };

// ─────────────────────────────────────────────
// MODO DEMO
// ─────────────────────────────────────────────

const HORA = 3600 * 1000;

// ─────────────────────────────────────────────
// HELPERS DE FORMATO (compartidos por las pantallas)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// AUTENTICACIÓN DEL PASEADOR
// ─────────────────────────────────────────────

async function entrarComoPaseador(id, mail) {
  await setCurrentUserId(id, mail);
  await setModo(MODO_PASEADOR);
  marcarPresencia(true);
}

/**
 * Login del paseador. A diferencia del login de dueños, NO entra a la app
 * hasta confirmar que la cuenta tiene perfil de paseador: si no lo tiene,
 * devuelve { necesitaActivar: true, email } para ofrecer sumarlo (la sesión de
 * Auth queda abierta: activarPaseador la usa). Si tiene el rol pero no el
 * perfil, devuelve { necesitaCompletar: true }.
 * Lanza Error('credenciales') si mail/contraseña no coinciden.
 */
export async function loginPaseador(email, password) {
  const mail = email.trim().toLowerCase();
  const usuario = await iniciarSesionConPassword(mail, password);

  const { data: perfil, error: errPerfil } = await supabase
    .from('paseador_perfil').select('id_user').eq('id_user', usuario.id).maybeSingle();

  if (errPerfil) throw errorApp('error_base', errPerfil);
  if (!perfil) {
    // ¿Ya tiene el rol de paseador (ej. asignado a mano) y sólo le falta el
    // perfil? Entonces entra y lo completa, sin "activar" de nuevo.
    const { data: rol } = await supabase.from('UserRole').select('Id_Role')
      .eq('Id_User', usuario.id).eq('Id_Role', 2).maybeSingle();
    if (rol) {
      await setCurrentUserId(usuario.id, mail);
      return { necesitaCompletar: true };
    }
    return { necesitaActivar: true, email: mail, nombre: usuario.nombre, fotoPerfil: usuario.fotoPerfil ?? null };
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
  // Primero la sesión de Auth (contraseña con bcrypt del lado de Supabase);
  // después la misma RPC que el alta con Google/Facebook: toma el mail de la
  // sesión, no de lo que mande la app.
  await crearCuentaConPassword(usuario.email, usuario.password);

  const { data, error } = await supabase.rpc('registrar_paseador_social', {
    p_usuario: {
      nombre: usuario.nombre.trim(),
      apellido: usuario.apellido.trim(),
      telefono: usuario.telefono?.trim() || null,
      genero: usuario.genero,
      fechaNacimiento: usuario.fechaNacimiento, // "YYYY-MM-DD"
    },
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

/**
 * Cuenta de dueño existente que se suma como paseador. Usa la sesión que dejó
 * abierta loginPaseador (ya comprobó la contraseña).
 */
export async function activarPaseador({ email, perfil }) {
  const { data, error } = await supabase.rpc('activar_paseador_social', {
    p_perfil: perfilParaRpc(perfil),
  });
  if (error) {
    if (/sin_sesion_social|JWT|token/i.test(String(error.message ?? ''))) throw errorApp('migracion_pendiente', error);
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
    throw errorApp('error_base', error);
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
 *   negocios      → [{ id, tipo, nombre }] veterinaria / peluquería / pet
 *                   shop de la cuenta (046; sin la migración, [])
 * Devuelve null si no se pudo consultar (sin red): quien llama decide.
 */
export async function fetchRolesCuenta(id = getCurrentUserId()) {
  if (id == null) return null;
  const [roles, mascotas, perfil, negocios] = await Promise.all([
    supabase.from('UserRole').select('Id_Role').eq('Id_User', id),
    supabase.from('Mascota').select('Id_Mascota').eq('Id_User', id).limit(1),
    supabase.from('paseador_perfil').select('id_user').eq('id_user', id).maybeSingle(),
    supabase.from('negocio_perfil').select('id, tipo, nombre').eq('id_user', id),
  ]);
  if (roles.error && mascotas.error) return null;
  const ids = new Set((roles.data ?? []).map((r) => r.Id_Role));
  const tienePerfil = !perfil.error && !!perfil.data;
  return {
    esDueno: ids.has(1) || (mascotas.data?.length ?? 0) > 0,
    esPaseador: ids.has(2) || tienePerfil,
    tienePerfil,
    negocios: negocios.error ? [] : (negocios.data ?? []),
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

/**
 * ¿Existe esta dirección? Para no aceptar "gttt7tt" como lugar de encuentro.
 * Devuelve { lat, lng } si la encuentra, null si no existe, y tira
 * 'sin_geocodificador' si el servicio no responde (ahí decide quien llama).
 */
export async function ubicarDireccion(texto, { cerca } = {}) {
  const q = (texto ?? '').trim();
  if (q.length < 5 || !/[a-záéíóúñ]{3}/i.test(q)) return null;
  const params = new URLSearchParams({
    format: 'json', limit: '1', 'accept-language': 'es', countrycodes: 'ar', q,
  });
  if (cerca?.lat != null) {
    const d = 0.6;
    params.set('viewbox', `${cerca.lng - d},${cerca.lat + d},${cerca.lng + d},${cerca.lat - d}`);
  }
  let res;
  try {
    res = await fetch(`${NOMINATIM}/search?${params}`, { headers: CABECERAS_NOMINATIM });
  } catch {
    throw new Error('sin_geocodificador');
  }
  if (!res.ok) throw new Error('sin_geocodificador');
  const [l] = await res.json();
  return l ? { lat: Number(l.lat), lng: Number(l.lon) } : null;
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
    // Desde cuándo es paseador de Zooni (para la antigüedad del perfil)
    desde: row.creado_en ?? null,
  };
}

export async function fetchPerfilPaseador() {
  const id = getCurrentUserId();
  const [{ data: row, error }, { data: user }] = await Promise.all([
    supabase.from('paseador_perfil').select('*').eq('id_user', id).maybeSingle(),
    supabase.from('User').select('Nombre, Apellido, FotoPerfil, Telefono').eq('Id_User', id).maybeSingle(),
  ]);
  if (error) throw errorApp('error_base', error);
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
  const fila = { actualizado_en: new Date().toISOString() };
  Object.entries(campos).forEach(([k, v]) => { if (columnas[k]) fila[columnas[k]] = v; });
  const { error } = await supabase.from('paseador_perfil').update(fila).eq('id_user', getCurrentUserId());
  if (error) throw error;
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
  const duenos = await perfilesPorId(idsUsuarios, 'Id_User, Nombre, Apellido, FotoPerfil, Telefono');
  const porDueno = Object.fromEntries((duenos ?? []).map((u) => [u.Id_User, u]));

  return rows.map((r) => {
    const m = porMascota[r.Id_Mascota] ?? {};
    const idDueno = r.Id_Dueno ?? m.Id_User ?? null;
    const u = porDueno[idDueno] ?? {};
    return {
      id: r.Id_Paseo,
      // 'vencido' si ya pasó la hora y nadie lo hizo (domain/paseos)
      estado: estadoVigente({ estado: r.Estado, fecha: r.FechaProgramada, duracionMin: r.DuracionMin ?? 30 }),
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

/** Solicitudes pendientes que puedo tomar: dirigidas a mí o abiertas. */
export async function fetchSolicitudes() {
  const yo = getCurrentUserId();
  const { data, error } = await supabase
    .from('Paseo').select(COLUMNAS_PASEO)
    .eq('Estado', 'pendiente')
    .or(`Id_Walker.is.null,Id_Walker.eq.${yo}`)
    .order('FechaProgramada', { ascending: true });
  if (error) throw errorApp('error_base', error);

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
  if (error) throw errorApp('error_base', error);
  // Un 'aceptado' de hace días vuelve como 'vencido': no va a la agenda.
  return (await enriquecer(data ?? [])).filter((p) => estados.includes(p.estado));
}

/**
 * Los paseos que están en curso ahora: uno por mascota, así que si el
 * paseador saca a un grupo hay varios a la vez (en el orden en que arrancaron).
 */
export async function fetchPaseosEnCurso() {
  const lista = await fetchMisPaseos(['en_curso']);
  return lista.sort((a, b) => String(a.horaInicio ?? '').localeCompare(String(b.horaInicio ?? '')));
}

export async function fetchPaseo(id) {
  const { data, error } = await supabase.from('Paseo').select(COLUMNAS_PASEO).eq('Id_Paseo', id).maybeSingle();
  if (error) throw errorApp('error_base', error);
  if (!data) return null;
  return (await enriquecer([data]))[0];
}

/** Recorrido guardado del paseo: [{lat, lng}] en orden. */
export async function fetchRecorrido(idPaseo) {
  const { data } = await supabase.from('PaseoTrack')
    .select('Lat, Lng').eq('Id_Paseo', idPaseo).order('Timestamp', { ascending: true });
  return (data ?? []).map((p) => ({ lat: Number(p.Lat), lng: Number(p.Lng) }));
}

// ─────────────────────────────────────────────
// PASEOS (acciones)
// ─────────────────────────────────────────────

function notificarDueno(paseo, titulo, mensaje) {
  return notificarPaseo(paseo?.idDueno, titulo, mensaje, null, 'dueno');
}

async function updatePaseo(id, fila) {
  const { error } = await supabase.from('Paseo').update(fila).eq('Id_Paseo', id);
  if (error) throw error;
}

/** Devuelve false si otro paseador la tomó antes. */
export async function aceptarSolicitud(paseo) {
  const { data, error } = await supabase.rpc('aceptar_solicitud_paseo', {
    p_id_paseo: paseo.id, p_id_walker: getCurrentUserId(),
  });
  if (error) throw error;
  if (data) {
    notificarDueno(paseo, '¡Tu paseo fue aceptado! 🐾',
      `Un paseador va a pasear a ${paseo.mascota.nombre} (${fechaHoraFija(paseo.fecha)}).`);
  }
  return !!data;
}

export async function rechazarSolicitud(paseo) {
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
  await updatePaseo(paseo.id, { Estado: 'cancelado' });
  notificarDueno(paseo, 'Paseo cancelado',
    `El paseador canceló el paseo de ${paseo.mascota.nombre} (${fechaHoraFija(paseo.fecha)}).`);
}

export async function iniciarPaseo(paseo) {
  const ahora = new Date().toISOString();
  const cambios = { estado: 'en_curso', horaInicio: ahora, reanudadoEn: ahora, segundosAcumulados: 0, distanciaMetros: 0 };
  await updatePaseo(paseo.id, {
    Estado: 'en_curso', HoraInicio: ahora, ReanudadoEn: ahora, SegundosAcumulados: 0, DistanciaMetros: 0,
  });
  notificarDueno(paseo, `${paseo.mascota.nombre} salió a pasear 🦮`, 'Podés seguir el paseo en vivo desde la app.');
  return { ...paseo, ...cambios };
}

export async function pausarPaseo(paseo) {
  const segundos = Math.round(segundosDePaseo(paseo));
  const cambios = { segundosAcumulados: segundos, reanudadoEn: null };
  await updatePaseo(paseo.id, { SegundosAcumulados: segundos, ReanudadoEn: null });
  return { ...paseo, ...cambios };
}

export async function reanudarPaseo(paseo) {
  const ahora = new Date().toISOString();
  await updatePaseo(paseo.id, { ReanudadoEn: ahora });
  return { ...paseo, reanudadoEn: ahora };
}

/**
 * Termina el paseo. Se cobra el precio pactado, dure lo que dure: el tiempo
 * paseado queda registrado pero no cambia el monto. "Precio" y
 * "PrecioPactado" quedan iguales; la comisión de Zooni se calcula acá, una
 * vez por paseo.
 */
export async function finalizarPaseo(paseo, distancia) {
  const ahora = new Date().toISOString();
  const segundos = Math.round(segundosDePaseo(paseo));
  const metros = Math.round(distancia ?? paseo.distanciaMetros ?? 0);
  const precioPactado = paseo.precio;
  const precio = precioPactado;
  const comision = comisionDe(precio);
  const cambios = {
    estado: 'finalizado', horaFin: ahora, reanudadoEn: null,
    segundosAcumulados: segundos, distanciaMetros: metros,
    precio, precioPactado, comision,
  };
  const fila = {
    Estado: 'finalizado', HoraFin: ahora, ReanudadoEn: null,
    SegundosAcumulados: segundos, DistanciaMetros: metros,
    Precio: precio, PrecioPactado: precioPactado, Comision: comision,
  };
  // Precio y comisión los recalcula la base (trigger de 062): esto es lo que
  // se muestra mientras tanto.
  await updatePaseo(paseo.id, fila);
  notificarDueno(paseo, `${paseo.mascota.nombre} ya volvió a casa 🏠`,
    `Paseo de ${formatoTiempoPaseado(segundos)} · ${formatoDistancia(metros)} · ${formatoPlata(precio)}. ¡Dejale una reseña al paseador!`);
  return { ...paseo, ...cambios };
}

/**
 * Deshace un "Finalizar" tocado sin querer: el paseo vuelve a estar en curso
 * con el tiempo y la distancia que llevaba (el rato que estuvo finalizado no
 * cuenta, como una pausa) y vuelve al precio pactado; al finalizar de nuevo
 * se recalcula. Le avisa al dueño, que ya había recibido "volvió a casa".
 */
export async function retomarPaseo(paseo) {
  const ahora = new Date().toISOString();
  const precio = paseo.precioPactado ?? paseo.precio;
  const cambios = { estado: 'en_curso', horaFin: null, reanudadoEn: ahora, precio, comision: 0 };
  const fila = { Estado: 'en_curso', HoraFin: null, ReanudadoEn: ahora, Precio: precio, Comision: 0 };
  const actualizar = (f) => supabase.from('Paseo').update(f).eq('Id_Paseo', paseo.id).eq('Estado', 'finalizado');
  const { error } = await actualizar(fila);
  if (error) throw error;
  notificarDueno(paseo, `El paseo de ${paseo.mascota.nombre} sigue en curso 🦮`,
    'El paseador lo había finalizado sin querer. Podés seguirlo en vivo desde la app.');
  return { ...paseo, ...cambios };
}

/** Guarda un punto del recorrido y la distancia acumulada. */
export async function registrarPunto(idPaseo, { lat, lng }, distanciaTotal) {
  await Promise.all([
    supabase.from('PaseoTrack').insert({ Id_Paseo: idPaseo, Lat: lat, Lng: lng, Timestamp: new Date().toISOString() }),
    supabase.from('Paseo').update({ DistanciaMetros: Math.round(distanciaTotal) }).eq('Id_Paseo', idPaseo),
  ]);
}

// ─────────────────────────────────────────────
// GANANCIAS Y RESEÑAS
// ─────────────────────────────────────────────

/** Paseos finalizados del período, del más nuevo al más viejo. */
// ─────────────────────────────────────────────
// PAGOS: cuenta corriente del paseador con cada dueño (044)
// ─────────────────────────────────────────────

function mapPago(r) {
  return {
    id: r.id, idDueno: r.id_dueno, monto: Number(r.monto), medio: r.medio,
    fecha: r.fecha, nota: r.nota ?? '',
  };
}

async function leerPagos() {
  const { data, error } = await supabase.from('paseo_pagos').select('*')
    .eq('id_walker', getCurrentUserId()).order('fecha', { ascending: true });
  if (error) throw errorApp('error_base', error);
  return (data ?? []).map(mapPago);
}

// ── Cada cuánto le cobra el paseador a cada dueño (045) ─────────────────────

/** { [idDueno]: { modalidad, ultimoRecordatorio } }. Sin la 045 → {}. */
async function leerConfigCuentas() {
  const { data, error } = await supabase.from('paseo_cuenta_config')
    .select('id_dueno, modalidad, ultimo_recordatorio').eq('id_walker', getCurrentUserId());
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r) => [String(r.id_dueno), {
    modalidad: r.modalidad, ultimoRecordatorio: r.ultimo_recordatorio,
  }]));
}

/**
 * Elige cada cuánto le cobra a un dueño. Al pasar a semanal / mensual, el
 * período en curso no se avisa de nuevo: el próximo recordatorio es en el
 * próximo cierre.
 */
export async function guardarModalidadCobro(idDueno, modalidad) {
  const ultimoRecordatorio = ultimoCierre(modalidad);
  const { error } = await supabase.from('paseo_cuenta_config').upsert({
    id_walker: getCurrentUserId(), id_dueno: idDueno, modalidad,
    ultimo_recordatorio: ultimoRecordatorio, actualizado_en: new Date().toISOString(),
  });
  if (error) throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
}

/**
 * Recordatorios de cobro: a cada dueño que paga por semana / mes y debe
 * plata, cuando se cierra su período le llega al paseador una notificación
 * ("Sofía te debe $X") que lleva a Pagos. Uno por período (ultimo_recordatorio).
 *
 * No hay servidor que corra esto solo: se revisa cada vez que el paseador abre
 * la app. Devuelve cuántos recordatorios se mandaron. Nunca rompe el flujo.
 */
export async function revisarRecordatoriosCobro() {
  try {
    const config = await leerConfigCuentas();
    const pendientes = Object.entries(config).filter(([, c]) => {
      const cierre = ultimoCierre(c.modalidad);
      return cierre && (!c.ultimoRecordatorio || c.ultimoRecordatorio < cierre);
    });
    if (!pendientes.length) return 0;

    const cuentas = await fetchCuentasCorrientes();
    let enviados = 0;
    for (const [idDueno, c] of pendientes) {
      const cierre = ultimoCierre(c.modalidad);
      const cuenta = cuentas.find((x) => String(x.idDueno) === idDueno);
      if (cuenta?.saldo > 0) {
        const periodo = c.modalidad === 'semanal' ? 'la semana' : 'el mes';
        const titulo = `${cuenta.dueno.nombre} te debe ${formatoPlata(cuenta.saldo)}`;
        const mensaje = `Terminó ${periodo}: tiene ${cuenta.pendientes} ${cuenta.pendientes === 1 ? 'paseo' : 'paseos'} sin pagar. Tocá para ver su cuenta.`;
        await notificarPaseo(getCurrentUserId(), titulo, mensaje, 'pagos');
        enviados += 1;
      }
      await supabase.from('paseo_cuenta_config').update({ ultimo_recordatorio: cierre })
        .eq('id_walker', getCurrentUserId()).eq('id_dueno', Number(idDueno));
    }
    return enviados;
  } catch {
    return 0;
  }
}

/**
 * Cuentas corrientes: una por dueño con el que hiciste paseos o que te pagó.
 *   cargos  = paseos finalizados (lo que te tiene que pagar)
 *   pagos   = lo que anotaste que te pagó
 *   saldo   = cargos - pagos (> 0 te debe, 0 al día, < 0 tiene saldo a favor)
 * Los pagos se imputan a los paseos más viejos primero: cada paseo queda
 * 'pagado', 'parcial' (con cuánto falta) o 'pendiente'.
 * `modalidad` es cada cuánto paga (por_paseo / semanal / mensual, ver 045).
 * Ordenadas: primero los que más deben; después los que están al día.
 */
export async function fetchCuentasCorrientes() {
  const [paseos, pagos, config] = await Promise.all([
    fetchMisPaseos(['finalizado']), leerPagos(), leerConfigCuentas(),
  ]);

  // Medio de pago que eligió el dueño en cada paseo (columna de la 044; si no
  // está, la cuenta igual se arma sin ese dato)
  const medios = {};
  if (paseos.length) {
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
    const totalCargos = aCentavos(c.paseos.reduce((a, p) => a + p.precio, 0));
    const totalPagado = aCentavos(c.pagos.reduce((a, pg) => a + pg.monto, 0));

    // Imputar los pagos a los paseos más viejos primero (en centavos: con
    // paseos cobrados por tiempo hay montos como $166,66)
    let disponible = totalPagado;
    const paseosEstado = c.paseos.map((p) => {
      const cubierto = aCentavos(Math.min(p.precio, Math.max(0, disponible)));
      disponible = aCentavos(disponible - cubierto);
      const estado = cubierto >= p.precio ? 'pagado' : cubierto > 0 ? 'parcial' : 'pendiente';
      return { ...p, cubierto, falta: aCentavos(p.precio - cubierto), estado };
    });
    const modalidad = config[String(c.idDueno)]?.modalidad ?? 'por_paseo';

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
      saldo: aCentavos(totalCargos - totalPagado),
      modalidad,
      proximoCierre: proximoCierre(modalidad),
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

/** La cuenta corriente con un dueño (o null si todavía no hay movimientos). */
export async function fetchCuentaCorriente(idDueno) {
  const cuentas = await fetchCuentasCorrientes();
  return cuentas.find((c) => String(c.idDueno) === String(idDueno)) ?? null;
}

/** Error de paseo_pagos con un código que la pantalla sabe explicar. */
function errorDePagos(error) {
  console.error('[paseo_pagos]', error);
  return errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente'
    : esSinPermiso(error) ? 'sin_permiso' : 'error_base', error);
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
  const { error } = await supabase.from('paseo_pagos').insert({ ...fila, id_walker: getCurrentUserId() });
  if (error) throw errorDePagos(error);
  const medio = medioDePago(fila.medio);
  notificarPaseo(fila.id_dueno, 'Tu paseador registró un pago',
    `${formatoPlata(fila.monto)}${medio ? ` · ${medio.label}` : ''}. ¡Gracias!`, null, 'dueno');
}

/** Corrige un pago ya anotado (monto, medio, fecha o nota). */
export async function editarPago(id, pago) {
  const fila = filaPago(pago);
  const { error } = await supabase.from('paseo_pagos')
    .update({ ...fila, actualizado_en: new Date().toISOString() })
    .eq('id', id).eq('id_walker', getCurrentUserId());
  if (error) throw errorDePagos(error);
}

export async function borrarPago(id) {
  const { error } = await supabase.from('paseo_pagos').delete()
    .eq('id', id).eq('id_walker', getCurrentUserId());
  if (error) throw errorDePagos(error);
}

export async function fetchGanancias(periodo) {
  const desde = inicioDePeriodo(periodo);
  const lista = await fetchMisPaseos(['finalizado'], desde ? { desde } : {});
  return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

export async function fetchResenas() {
  const yo = getCurrentUserId();
  const [lista, opiniones] = await Promise.all([fetchMisPaseos(['finalizado']), leerOpiniones(yo)]);
  const fechas = lista.map((p) => new Date(p.horaInicio ?? p.fecha).getTime()).filter(Number.isFinite);
  const autores = [...new Set(opiniones.map((o) => o.id_autor))];
  const usuarios = await perfilesPorId(autores);
  const porUser = Object.fromEntries((usuarios ?? []).map((u) => [u.Id_User, u]));
  // Opiniones sin paseo (048), con la misma forma que un paseo calificado
  const libres = opiniones.map((o) => {
    const u = porUser[o.id_autor] ?? {};
    return {
      id: `op-${o.id}`, rating: o.rating, resena: o.resena, fecha: o.fecha, mascota: null,
      dueno: { nombre: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim() || 'Dueño', foto: u.FotoPerfil ?? null },
    };
  });
  const conRating = [...lista.filter((p) => p.rating != null), ...libres];
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

// ─────────────────────────────────────────────
// NOTIFICACIONES DEL PASEADOR
// ─────────────────────────────────────────────

export async function fetchNotificacionesPaseador() {
  // Tipo y DataExtra se traen para poder navegar al tocar la notificación,
  // igual que en el panel del Home de dueños.
  const { data } = await supabase.from('Notificacion')
    .select('Id, Titulo, Mensaje, Fecha, Leido, Tipo, DataExtra')
    .eq('Id_User', getCurrentUserId())
    .order('Fecha', { ascending: false })
    .limit(40);
  // Sólo las del modo paseador (las de dueño van al Home de dueños)
  return (data ?? []).filter(esNotificacionDePaseador).slice(0, 20).map((n) => ({
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
 * @returns {'chats'|'solicitudes'|'pagos'|'inicio'}
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
  await supabase.from('Notificacion').update({ Leido: true })
    .eq('Id', id).eq('Id_User', getCurrentUserId());
}

export async function marcarNotificacionesLeidas() {
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
  const [usuarios, { data: calificados }, opiniones] = await Promise.all([
    perfilesPorId(ids),
    supabase.from('Paseo').select('Id_Walker, Rating').in('Id_Walker', ids).eq('Estado', 'finalizado'),
    leerOpiniones(ids),
  ]);
  const porUser = Object.fromEntries((usuarios ?? []).map((u) => [u.Id_User, u]));
  const stats = {};
  (calificados ?? []).forEach((pz) => {
    if (!stats[pz.Id_Walker]) stats[pz.Id_Walker] = { paseos: 0, suma: 0, votos: 0 };
    const st = stats[pz.Id_Walker];
    st.paseos += 1;
    if (pz.Rating != null) { st.suma += pz.Rating; st.votos += 1; }
  });
  // Opiniones sin paseo (048): suman al promedio, no a los paseos hechos
  opiniones.forEach((o) => {
    if (!stats[o.id_walker]) stats[o.id_walker] = { paseos: 0, suma: 0, votos: 0 };
    stats[o.id_walker].suma += o.rating;
    stats[o.id_walker].votos += 1;
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

/**
 * Los paseadores que te pueden atender: los que tienen tu ubicación DENTRO de
 * su radio de cobertura (el círculo verde que dibujan en Comunidad), ordenados
 * del más cercano al más lejano. Al que no te cubre no le podés pedir un paseo,
 * así que tampoco aparece en el mapa ni en la lista.
 *
 * `pos` es tu ubicación (GPS). Sin GPS se usa la última que guardó Comunidad
 * (ubicaciones_usuarios). Si no hay ninguna no se puede saber quién te cubre:
 * en ese caso van todos y sin ordenar, mejor que un mapa vacío.
 */
export async function fetchPaseadoresParaMi(pos) {
  let yo = pos?.lat != null ? pos : null;
  if (!yo) {
    const { data } = await supabase.from('ubicaciones_usuarios')
      .select('lat, lng').eq('usuario_id', getCurrentUserId()).maybeSingle();
    if (data?.lat != null) yo = { lat: Number(data.lat), lng: Number(data.lng) };
  }
  const todos = await fetchPaseadoresZona(null);
  if (!yo) return todos;
  return todos
    // Sin coordenadas no se puede saber si te cubre: queda afuera (Infinity)
    .map((p) => ({ ...p, distanciaKm: (distanciaMetros(yo, p) ?? Infinity) / 1000 }))
    .filter((p) => p.radioKm > 0 && p.distanciaKm <= p.radioKm)
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
  const { data, error } = await supabase.from('Paseo').insert(fila).select('Id_Paseo').single();
  if (error) {
    // Reglas de la base (066): no en el pasado, ni dos a la vez para la misma mascota
    const regla = ['fecha_pasada', 'paseo_superpuesto', 'direccion_invalida']
      .find((r) => String(error.message ?? '').includes(r));
    if (regla) throw errorApp(regla, error);
    throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  }

  const medio = MEDIOS_PAGO.find((m) => m.key === medioPago);
  notificarPaseo(paseador.id, 'Tenés una solicitud nueva',
    `${mascota.nombre} · ${fechaHoraFija(fecha)} · ${duracionMin} minutos · ${formatoPlata(precio)}${medio ? ` · paga con ${medio.label}` : ''}`,
    'solicitudes');
  return data.Id_Paseo;
}

/** Paseos que pedí como dueño (todos los estados), del más nuevo al más viejo. */
export async function fetchMisPaseosDueno() {
  // Deja guardados como 'vencido' los que ya no se pueden hacer (066). No se
  // espera: la lista ya los muestra vencidos con estadoVigente.
  supabase.rpc('vencer_paseos').then(() => {}, () => {});
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
  notificarPaseo(paseo.idWalker, 'Paseo cancelado por el dueño',
    `${paseo.mascota.nombre} · ${fechaHoraFija(paseo.fecha)}`, 'inicio');
}

// ─────────────────────────────────────────────
// RESEÑAS (estilo Google Maps): estrellas + aspectos + preguntas + fotos/videos
// ─────────────────────────────────────────────

/** Código de app para un error de Postgres al guardar una reseña (ver CalificarPaseoModal). */
function codigoErrorResena(error) {
  if (esEsquemaFaltante(error)) return 'migracion_pendiente';
  if (error?.code === '42501' || /row-level security|permission denied/i.test(error?.message ?? '')) return 'sin_permiso';
  if (error?.code === '23502' || error?.code === '23503') return 'sin_sesion'; // id_autor nulo o inexistente
  return 'error_base';
}

/**
 * Sube las fotos/videos de una reseña al bucket "resenas" (042). Si falla,
 * tira un Error con código para que el formulario diga el motivo real:
 *   bucket_faltante · archivo_pesado · tipo_no_admitido · error_subida
 */
async function subirMediaResena(media, carpeta) {
  const subidos = [];
  for (const m of media.slice(0, MEDIA_RESENA_MAX)) {
    try {
       
      subidos.push(await subirArchivoPublico(m.uri, carpeta, { bucket: 'resenas', mimeHint: m.mimeType }));
    } catch (e) {
      const msg = String(e?.message ?? '');
      const estado = String(e?.statusCode ?? e?.status ?? '');
      const codigo = /bucket not found/i.test(msg) ? 'bucket_faltante'
        : estado === '413' || /exceeded|too large|maximum allowed size/i.test(msg) ? 'archivo_pesado'
        : estado === '415' || /mime type|not supported/i.test(msg) ? 'tipo_no_admitido'
        : 'error_subida';
      throw errorApp(codigo, e);
    }
  }
  return subidos;
}

/**
 * Calificación del dueño al terminar. `media` son los archivos elegidos con
 * el picker ([{ uri, mimeType }]): se suben al bucket "resenas" y se guardan
 * sus URLs. Al paseador le llega una notificación que lo lleva a su Perfil.
 */
export async function calificarPaseo(paseo, {
  rating, resena, aspectos = {}, respuestas = {}, media = [],
}) {
  const texto = resena?.trim() || null;
  const subidos = await subirMediaResena(media, `paseo-${paseo.id}`);

  const { error } = await supabase.from('Paseo').update({
    Rating: rating,
    Resena: texto,
    ResenaAspectos: Object.keys(aspectos).length ? aspectos : null,
    ResenaRespuestas: Object.keys(respuestas).length ? respuestas : null,
    ResenaMedia: subidos,
    ResenaFecha: new Date().toISOString(),
  }).eq('Id_Paseo', paseo.id).eq('Estado', 'finalizado');
  if (error) throw errorApp(codigoErrorResena(error), error);

  const fotos = subidos.filter((x) => x.tipo === 'imagen').length;
  const videos = subidos.length - fotos;
  const adjuntos = [
    fotos ? `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}` : null,
    videos ? `${videos} ${videos === 1 ? 'video' : 'videos'}` : null,
  ].filter(Boolean).join(' y ');
  notificarPaseo(
    paseo.idWalker,
    `Nueva reseña: ${rating} ${rating === 1 ? 'estrella' : 'estrellas'}`,
    [texto ? `"${texto.slice(0, 80)}"` : `Paseo con ${paseo.mascota.nombre}`, adjuntos ? `con ${adjuntos}` : null]
      .filter(Boolean).join(' · '),
    'perfil',
  );
}

/**
 * Para el botón "Escribir una opinión" de las Opiniones de un paseador: mis
 * paseos terminados con él que todavía no califiqué (el más nuevo primero) y
 * cuántos paseos terminados tengo con él en total. Si hay un paseo sin
 * calificar la reseña va atada a ese paseo; si no, es una opinión general
 * (opinarPaseador).
 */
export async function fetchPaseosParaOpinar(idWalker) {
  const conEl = (await fetchMisPaseosDueno())
    .filter((p) => String(p.idWalker) === String(idWalker) && p.estado === 'finalizado');
  return { sinCalificar: conEl.filter((p) => p.rating == null), total: conEl.length };
}

/**
 * Opiniones sobre un paseador SIN paseo de por medio (048): cualquiera puede
 * opinar cuando quiera y las veces que quiera, también el propio paseador.
 * Sin la 048 devuelve [] y todo sigue con las reseñas de los paseos.
 */
async function leerOpiniones(idsWalker) {
  const ids = (Array.isArray(idsWalker) ? idsWalker : [idsWalker]).filter((x) => x != null);
  if (!ids.length) return [];
  const { data, error } = await supabase.from('paseador_opiniones').select('*').in('id_walker', ids);
  return error ? [] : (data ?? []);
}

/** Guarda una opinión sobre un paseador (no hace falta un paseo). */
export async function opinarPaseador(idWalker, {
  rating, resena, aspectos = {}, respuestas = {}, media = [],
}) {
  const texto = resena?.trim() || null;
  const subidos = await subirMediaResena(media, `opinion-${idWalker}`);
  const yo = getCurrentUserId();
  const { error } = await supabase.from('paseador_opiniones').insert({
    id_walker: idWalker,
    id_autor: yo,
    rating,
    resena: texto,
    aspectos: Object.keys(aspectos).length ? aspectos : null,
    respuestas: Object.keys(respuestas).length ? respuestas : null,
    media: subidos,
  });
  if (error) throw errorApp(codigoErrorResena(error), error);
  if (String(idWalker) !== String(yo)) {
    notificarPaseo(idWalker, `Nueva reseña: ${rating} ${rating === 1 ? 'estrella' : 'estrellas'}`,
      texto ? `"${texto.slice(0, 80)}"` : 'Te dejaron una opinión', 'perfil');
  }
}

const COLUMNAS_RESENA ='"Id_Paseo","Id_Mascota","Id_Dueno","FechaProgramada","DuracionMin","Rating","Resena","ResenaAspectos","ResenaRespuestas","ResenaMedia","ResenaFecha"';

/**
 * Todas las reseñas de un paseador, con el resumen que se muestra arriba
 * (promedio, cuántas de cada estrella, promedio por aspecto, % de "sí" por
 * pregunta y todas las fotos/videos juntos).
 */
export async function fetchResenasPaseador(idWalker) {
  const { data, error } = await supabase.from('Paseo').select(COLUMNAS_RESENA)
    .eq('Id_Walker', idWalker).eq('Estado', 'finalizado').not('Rating', 'is', null);
  if (error) throw error;
  const filas = data ?? [];
  const opiniones = await leerOpiniones(idWalker);

  const idsDuenos = [...new Set([...filas.map((r) => r.Id_Dueno), ...opiniones.map((o) => o.id_autor)].filter(Boolean))];
  const idsMascotas = [...new Set(filas.map((r) => r.Id_Mascota).filter(Boolean))];
  const [duenos, { data: mascotas }] = await Promise.all([
    perfilesPorId(idsDuenos),
    idsMascotas.length
      ? supabase.from('Mascota').select('Id_Mascota, Nombre, Especie, Raza, Foto, ImagenAsset, MostrarFoto').in('Id_Mascota', idsMascotas)
      : { data: [] },
  ]);
  const porDueno = Object.fromEntries((duenos ?? []).map((u) => [u.Id_User, u]));
  const porMascota = Object.fromEntries((mascotas ?? []).map((m) => [m.Id_Mascota, m]));

  const nombreCorto = (u) => `${u.Nombre ?? ''} ${(u.Apellido ?? '').slice(0, 1)}${u.Apellido ? '.' : ''}`.trim() || 'Dueño';
  const libres = opiniones.map((o) => {
    const u = porDueno[o.id_autor] ?? {};
    return {
      id: `op-${o.id}`,
      rating: o.rating,
      resena: o.resena,
      fecha: o.fecha,
      aspectos: o.aspectos ?? {},
      respuestas: o.respuestas ?? {},
      media: Array.isArray(o.media) ? o.media : [],
      dueno: { nombre: nombreCorto(u), foto: u.FotoPerfil ?? null },
      mascota: null, // opinión general, sin paseo
    };
  });

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
      dueno: { nombre: nombreCorto(u), foto: u.FotoPerfil ?? null },
      mascota: {
        nombre: m.Nombre ?? 'Mascota',
        visual: resolveMascotaVisual({
          fotoUrl: m.Foto, imagenAsset: m.ImagenAsset, especie: m.Especie, raza: m.Raza, mostrarFoto: m.MostrarFoto,
        }),
      },
    };
  }).concat(libres).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

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
