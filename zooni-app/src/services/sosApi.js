import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { distanciaMetros } from '../utils/geo';

export const LINEAS_FALLBACK = [
  { id: null, kind: 'intoxicaciones', label: 'Intoxicaciones', telefono: '0800-333-0160', horario: 'Gratis · 24 hs' },
  { id: null, kind: 'zoonosis', label: 'Zoonosis y rabia (Inst. Pasteur)', telefono: '011 4958-9900', horario: 'Todos los días 8 a 18 h · CABA' },
];

export async function fetchLineasEmergencia(countryCode = 'AR') {
  const { data, error } = await supabase
    .from('emergency_lines')
    .select('*')
    .eq('country_code', countryCode)
    .eq('is_active', true)
    .order('priority', { ascending: true });
  if (error || !data?.length) return LINEAS_FALLBACK;
  return data.map((l) => ({
    id: l.id, kind: l.kind, label: l.label, telefono: l.phone, horario: l.schedule ?? null,
  }));
}

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

export async function fetchVeterinarias() {
  const { data, error } = await supabase
    .from('veterinary_clinics')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map(mapClinica);
}

const DIAS_JS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function minutosDe(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function estadoHorario(clinica, ahora = new Date()) {
  if (clinica.is24h) return { abierta: true, cierraEnMin: null, abreA: null };
  const horarios = clinica.horarios;
  if (!horarios) return { abierta: null, cierraEnMin: null, abreA: null };

  const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
  const rangosHoy = horarios[DIAS_JS[ahora.getDay()]] ?? [];

  for (const [desde, hasta] of rangosHoy) {
    if (nowMin >= minutosDe(desde) && nowMin < minutosDe(hasta)) {
      return { abierta: true, cierraEnMin: minutosDe(hasta) - nowMin, abreA: null };
    }
  }
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

export function distanciaM(lat1, lng1, lat2, lng2) {
  const m = distanciaMetros({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
  return m == null ? null : Math.round(m);
}

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

export function textoHorario(clinica, ahora = new Date()) {
  if (clinica.is24h) return { texto: 'Abierto 24 hs', abierta: true };

  const { abierta, cierraEnMin, abreA } = estadoHorario(clinica, ahora);
  if (abierta === null) return { texto: 'Horario no informado', abierta: null };

  if (abierta) {
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

export function urlComoLlegar(clinica) {
  const destino = clinica.lat != null && clinica.lng != null
    ? `${clinica.lat},${clinica.lng}`
    : [clinica.nombre, clinica.direccion, clinica.barrio].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

export function urlBuscarEnMaps(coords) {
  const consulta = coords?.lat != null
    ? `veterinaria de urgencias/@${coords.lat},${coords.lng},14z`
    : 'veterinaria de urgencias cerca de mi';
  return `https://www.google.com/maps/search/${encodeURIComponent(consulta)}`;
}

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

let ultimoLog = { telefono: null, ts: 0 };

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
    .then(() => {}, () => {});
}

const ESTADOS_ACTIVOS = ['searching', 'confirmed', 'on_the_way'];

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

export async function cancelarSos(eventoId) {
  try {
    await supabase
      .from('sos_events')
      .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
      .eq('id', eventoId)
      .eq('user_id', getCurrentUserId());
  } catch {  }
}
