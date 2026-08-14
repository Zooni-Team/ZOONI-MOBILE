/**
 * sosApi.js — Datos de la pantalla S.O.S Veterinario (Instruction-SOS)
 *
 * Usado por SosScreen. Sigue el patrón del resto de la app: los servicios
 * tiran (throw) ante errores de red y la pantalla decide el fallback
 * (datos demo / caché en memoria).
 *
 * Regla central del SOS: nada de acá puede bloquear un llamado. Los números
 * de las líneas de emergencia tienen fallback local (LINEAS_FALLBACK) y el
 * registro de llamadas es fire-and-forget.
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';

// ─── LÍNEAS DE EMERGENCIA ─────────────────────────────────────────────────────

// Fallback local: si Supabase no responde, los botones C1/C2 marcan igual.
export const LINEAS_FALLBACK = [
  { id: null, kind: 'zooni', label: 'Línea Zooni 24 hs', telefono: '0800-123-4567' },
  { id: null, kind: 'national_emergency', label: 'Emergencias', telefono: '911' },
];

export async function fetchLineasEmergencia(countryCode = 'AR') {
  const { data, error } = await supabase
    .from('emergency_lines')
    .select('*')
    .eq('country_code', countryCode)
    .eq('is_active', true)
    .order('priority', { ascending: true });
  if (error || !data?.length) return LINEAS_FALLBACK;
  return data.map((l) => ({ id: l.id, kind: l.kind, label: l.label, telefono: l.phone }));
}

// ─── VETERINARIAS ─────────────────────────────────────────────────────────────

function mapClinica(row) {
  return {
    id: row.id,
    nombre: row.name,
    telefono: row.phone,
    direccion: row.address,
    barrio: row.neighborhood,
    logoUrl: row.logo_url,
    especialidades: row.specialties ?? [],
    servicios: row.services ?? [],
    is24h: !!row.is_24h,
    urgencias: !!row.emergency_service,
    ratingAvg: row.rating_avg != null ? Number(row.rating_avg) : null,
    ratingCount: row.rating_count ?? 0,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    horarios: row.opening_hours ?? null,
  };
}

/** Todas las veterinarias activas. El filtrado/orden fino lo hace la pantalla. */
export async function fetchVeterinarias() {
  const { data, error } = await supabase
    .from('veterinary_clinics')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map(mapClinica);
}

// Datos de demo (mismo shape que mapClinica) para cuando no hay backend,
// igual que hace HomeScreen con DEMO_DATA.
export const DEMO_VETS = [
  {
    id: 1, nombre: 'Clínica Veterinaria del Centro', telefono: '011-4901-2233',
    direccion: 'Av. Rivadavia 4980', barrio: 'Caballito', logoUrl: null,
    especialidades: ['Medicina General', 'Emergencias'], servicios: ['internacion', 'cirugia'],
    is24h: false, urgencias: true, ratingAvg: 4.8, ratingCount: 87,
    lat: -34.6187, lng: -58.4370,
    horarios: { mon: [['08:00', '20:00']], tue: [['08:00', '20:00']], wed: [['08:00', '20:00']], thu: [['08:00', '20:00']], fri: [['08:00', '20:00']], sat: [['09:00', '13:00']], sun: [] },
  },
  {
    id: 2, nombre: 'Veterinaria San Roque 24 hs', telefono: '011-4902-8800',
    direccion: 'Av. La Plata 355', barrio: 'Caballito', logoUrl: null,
    especialidades: ['Emergencias', 'Internación'], servicios: ['internacion', 'radiologia'],
    is24h: true, urgencias: true, ratingAvg: 4.6, ratingCount: 54,
    lat: -34.6152, lng: -58.4258, horarios: null,
  },
  {
    id: 3, nombre: 'Hospital Veterinario Belgrano', telefono: '011-4788-1144',
    direccion: 'Av. Cabildo 2250', barrio: 'Belgrano', logoUrl: null,
    especialidades: ['Medicina General', 'Cirugía', 'Emergencias'], servicios: ['internacion', 'cirugia', 'radiologia'],
    is24h: false, urgencias: true, ratingAvg: 4.9, ratingCount: 203,
    lat: -34.5601, lng: -58.4590,
    horarios: { mon: [['08:00', '21:00']], tue: [['08:00', '21:00']], wed: [['08:00', '21:00']], thu: [['08:00', '21:00']], fri: [['08:00', '21:00']], sat: [['08:00', '21:00']], sun: [['09:00', '18:00']] },
  },
  {
    id: 4, nombre: 'Veterinaria Patitas', telefono: '011-4632-5511',
    direccion: 'Bogotá 2140', barrio: 'Flores', logoUrl: null,
    especialidades: ['Medicina General', 'Vacunación'], servicios: [],
    is24h: false, urgencias: false, ratingAvg: 4.3, ratingCount: 31,
    lat: -34.6289, lng: -58.4622,
    horarios: { mon: [['09:00', '19:00']], tue: [['09:00', '19:00']], wed: [['09:00', '19:00']], thu: [['09:00', '19:00']], fri: [['09:00', '19:00']], sat: [['09:00', '13:00']], sun: [] },
  },
  {
    id: 5, nombre: 'Centro Veterinario Flores', telefono: '011-4611-7788',
    direccion: 'Av. Avellaneda 3652', barrio: 'Flores', logoUrl: null,
    especialidades: ['Medicina General', 'Dermatología'], servicios: ['domicilio'],
    is24h: false, urgencias: false, ratingAvg: 4.5, ratingCount: 42,
    lat: -34.6334, lng: -58.4761,
    horarios: { mon: [['08:00', '13:00'], ['16:00', '20:00']], tue: [['08:00', '13:00'], ['16:00', '20:00']], wed: [['08:00', '13:00'], ['16:00', '20:00']], thu: [['08:00', '13:00'], ['16:00', '20:00']], fri: [['08:00', '13:00'], ['16:00', '20:00']], sat: [], sun: [] },
  },
  {
    id: 6, nombre: 'Clínica Felina Miau', telefono: '011-4855-9090',
    direccion: 'Aráoz 1128', barrio: 'Palermo', logoUrl: null,
    especialidades: ['Felinos', 'Medicina General'], servicios: [],
    is24h: false, urgencias: false, ratingAvg: 4.7, ratingCount: 66,
    lat: -34.5936, lng: -58.4211,
    horarios: { mon: [['10:00', '19:00']], tue: [['10:00', '19:00']], wed: [['10:00', '19:00']], thu: [['10:00', '19:00']], fri: [['10:00', '19:00']], sat: [['10:00', '14:00']], sun: [] },
  },
  {
    id: 7, nombre: 'Veterinaria Zooni a Domicilio', telefono: '011-15-6044-2211',
    direccion: 'Atiende en tu casa', barrio: 'CABA', logoUrl: null,
    especialidades: ['Atención a domicilio', 'Urgencias'], servicios: ['domicilio'],
    is24h: true, urgencias: true, ratingAvg: null, ratingCount: 0,
    lat: null, lng: null, horarios: null,
  },
];

// ─── HORARIOS Y DISTANCIA ─────────────────────────────────────────────────────

const DIAS_JS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function minutosDe(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Estado horario de una clínica: { abierta, cierraEnMin, abreA }.
 * Se calcula contra la hora del dispositivo por no tener backend con
 * hora de servidor (la Instruction-SOS pide resolverlo en SQL cuando
 * exista la RPC nearby_clinics con PostGIS).
 */
export function estadoHorario(clinica, ahora = new Date()) {
  if (clinica.is24h) return { abierta: true, cierraEnMin: null, abreA: null };
  const horarios = clinica.horarios;
  if (!horarios) return { abierta: null, cierraEnMin: null, abreA: null }; // desconocido

  const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
  const rangosHoy = horarios[DIAS_JS[ahora.getDay()]] ?? [];

  for (const [desde, hasta] of rangosHoy) {
    if (nowMin >= minutosDe(desde) && nowMin < minutosDe(hasta)) {
      return { abierta: true, cierraEnMin: minutosDe(hasta) - nowMin, abreA: null };
    }
  }
  // Cerrada: buscar la próxima apertura (hoy más tarde, o los días siguientes)
  for (let d = 0; d < 7; d++) {
    const dia = DIAS_JS[(ahora.getDay() + d) % 7];
    for (const [desde] of horarios[dia] ?? []) {
      if (d > 0 || minutosDe(desde) > nowMin) {
        return { abierta: false, cierraEnMin: null, abreA: desde.replace(/^0/, '') };
      }
    }
  }
  return { abierta: false, cierraEnMin: null, abreA: null };
}

/** Distancia haversine en metros, o null si falta algún punto. */
export function distanciaM(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null)) return null;
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** "veterinaría" → "veterinaria" (búsqueda insensible a tildes y mayúsculas). */
export function normalizar(texto) {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** 1200 → "1,2 km" | 380 → "380 m" | null → null */
export function formatearDistancia(metros) {
  if (metros == null) return null;
  if (metros < 1000) return `${metros} m`;
  return `${(metros / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function horaDeCierreHoy(clinica, ahora) {
  const rangos = clinica.horarios?.[DIAS_JS[ahora.getDay()]] ?? [];
  const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
  for (const [desde, hasta] of rangos) {
    if (nowMin >= minutosDe(desde) && nowMin < minutosDe(hasta)) return hasta;
  }
  return null;
}

/** Estado horario listo para la card: "Abierto · cierra 20:00", "Cerrado · abre 9:00"… */
export function textoHorario(clinica, ahora = new Date()) {
  if (clinica.is24h) return { texto: 'Abierto 24 hs', abierta: true };

  const { abierta, cierraEnMin, abreA } = estadoHorario(clinica, ahora);
  if (abierta === null) return { texto: 'Horario no informado', abierta: null };

  if (abierta) {
    // Faltando menos de una hora, lo que importa es el aviso y no el horario
    if (cierraEnMin != null && cierraEnMin <= 60) {
      return { texto: `Abierto · cierra en ${cierraEnMin} min`, abierta: true, porCerrar: true };
    }
    const cierre = horaDeCierreHoy(clinica, ahora);
    return { texto: cierre ? `Abierto · cierra ${cierre}` : 'Abierto ahora', abierta: true };
  }
  return { texto: abreA ? `Cerrado · abre ${abreA}` : 'Cerrado', abierta: false };
}

const NOMBRE_DIA = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves',
  fri: 'Viernes', sat: 'Sábado', sun: 'Domingo',
};
const ORDEN_DIAS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Horario semanal completo para desplegar en la card: [{ dia, rangos, esHoy }] */
export function horarioSemanal(clinica, ahora = new Date()) {
  if (clinica.is24h || !clinica.horarios) return [];
  const hoyKey = DIAS_JS[ahora.getDay()];
  return ORDEN_DIAS.map((k) => {
    const rangos = clinica.horarios[k] ?? [];
    return {
      dia: NOMBRE_DIA[k],
      rangos: rangos.length ? rangos.map(([d, h]) => `${d} a ${h}`).join(' · ') : 'Cerrado',
      esHoy: k === hoyKey,
    };
  });
}

// ─── MAPAS ────────────────────────────────────────────────────────────────────

/**
 * Link de Google Maps con la ruta hasta la clínica. Con coordenadas apunta al
 * punto exacto; si no las hay (ej. la que atiende a domicilio), busca por
 * nombre + dirección. Es un universal link: abre la app de Maps si está
 * instalada y el navegador si no — sin API key ni SDK nativo de por medio.
 */
export function urlComoLlegar(clinica) {
  const destino = clinica.lat != null && clinica.lng != null
    ? `${clinica.lat},${clinica.lng}`
    : [clinica.nombre, clinica.direccion, clinica.barrio].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

/** Búsqueda de veterinarias de urgencia en Google Maps, centrada en el usuario. */
export function urlBuscarEnMaps(coords) {
  const consulta = coords?.lat != null
    ? `veterinaria de urgencias/@${coords.lat},${coords.lng},14z`
    : 'veterinaria de urgencias cerca de mi';
  return `https://www.google.com/maps/search/${encodeURIComponent(consulta)}`;
}

// ─── UBICACIÓN DEL USUARIO ────────────────────────────────────────────────────

/**
 * Coordenadas del dispositivo, o null si no hay permiso ni soporte.
 * Usa `navigator.geolocation`, que funciona igual en web y en nativo (React
 * Native la implementa). NUNCA tira error ni bloquea: en una emergencia la
 * lista tiene que aparecer sí o sí, con distancias o sin ellas.
 */
export function obtenerCoordenadas({ timeoutMs = 6000 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
      );
    } catch {
      resolve(null);
    }
  });
}

// ─── REGISTRO DE LLAMADAS (fire-and-forget) ───────────────────────────────────

let ultimoLog = { telefono: null, ts: 0 };

/**
 * Registra el llamado en sos_call_logs. Nunca bloquea la UI: se llama sin
 * await y cualquier error se ignora. Idempotente por ventana de 5 segundos
 * para no duplicar por doble toque.
 */
export function logLlamadaSos({ telefono, clinicId = null, lineId = null }) {
  const ahora = Date.now();
  if (ultimoLog.telefono === telefono && ahora - ultimoLog.ts < 5000) return;
  ultimoLog = { telefono, ts: ahora };
  supabase
    .from('sos_call_logs')
    .insert({
      user_id: getCurrentUserId(),
      clinic_id: clinicId,
      line_id: lineId,
      phone_dialed: telefono,
    })
    .then(() => {}, () => {}); // silencio absoluto (Instruction-SOS §4.7)
}

// ─── EMERGENCIA ACTIVA (variante V7) ──────────────────────────────────────────

const ESTADOS_ACTIVOS = ['searching', 'confirmed', 'on_the_way'];

/** Última emergencia no terminada del usuario, o null (nunca tira error). */
export async function fetchSosActivo() {
  try {
    const { data, error } = await supabase
      .from('sos_events')
      .select('*, veterinary_clinics(name)')
      .eq('user_id', getCurrentUserId())
      .in('status', ESTADOS_ACTIVOS)
      .order('started_at', { ascending: false })
      .limit(1);
    if (error || !data?.length) return null;
    const e = data[0];
    return {
      id: e.id,
      status: e.status,
      clinicaNombre: e.veterinary_clinics?.name ?? null,
      startedAt: e.started_at,
    };
  } catch {
    return null;
  }
}

/** Cancela una emergencia (soft: status = 'cancelled', nunca delete). */
export async function cancelarSos(eventoId) {
  try {
    await supabase
      .from('sos_events')
      .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
      .eq('id', eventoId)
      .eq('user_id', getCurrentUserId());
  } catch { /* la card se oculta igual en el cliente */ }
}
