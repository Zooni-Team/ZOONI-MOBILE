/**
 * usoApp.js — Cuánto tiempo se usa la app por día (Configuración › Tiempo en
 * la app) y los avisos de bienestar que se eligen ahí.
 *
 * Se mide sólo con la app en primer plano y con sesión: App.jsx llama a
 * empezarUso() / pausarUso() cuando la app vuelve o se va al fondo, y cada
 * minuto se suma lo transcurrido. Cada tanto se guarda en app_usage_daily (una fila por usuario
 * y día; la RLS sólo deja tocar la propia).
 *
 * Los avisos (límite diario, descanso, resumen del lunes) AVISAN, nunca
 * bloquean: bloquear podría dejar a alguien sin llegar al SOS.
 *
 * Nada de acá rompe la app: si falla el guardado, el tiempo se acumula y se
 * reintenta en el próximo guardado.
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { getSettings } from './settingsStore';
import { alerta } from '../utils/dialogo';
import { toISODateLocal } from '../utils/fechaLocal';

const TICK_MS = 60 * 1000;
const GUARDAR_CADA_S = 5 * 60;
// Si entre dos ticks pasó mucho más que un minuto, el dispositivo estuvo
// dormido: ese rato no cuenta.
const MAX_TICK_S = 3 * 60;
const DESCANSO_S = { '30m': 30 * 60, '1h': 60 * 60 };

let desde = null;          // ms del último corte, null si la app está en el fondo
let pendientes = 0;        // segundos medidos que todavía no se guardaron
let guardadosHoy = 0;      // lo que ya está en la base para `diaGuardado`
let diaGuardado = null;
let sesionSeguida = 0;     // segundos seguidos en primer plano (para el descanso)
let intervalo = null;
let usuarioMedido = null;  // de quién es lo pendiente
const avisados = new Set(); // "limite:2026-11-16", "descanso:…", "resumen:…"

const hoy = () => toISODateLocal(new Date());

/**
 * Corta lo medido hasta ahora y lo suma a `pendientes`. Si cambió la cuenta
 * (cerró sesión y entró otra), lo de la anterior se descarta: ya no hay
 * sesión con la que guardarlo, y no puede terminar en la cuenta nueva.
 */
function cortar() {
  const yo = getCurrentUserId();
  if (yo !== usuarioMedido) {
    usuarioMedido = yo;
    pendientes = 0;
    sesionSeguida = 0;
    diaGuardado = null;
  }
  if (desde == null) return;
  const ahora = Date.now();
  const s = Math.round((ahora - desde) / 1000);
  desde = ahora;
  if (yo && s > 0 && s <= MAX_TICK_S) {
    pendientes += s;
    sesionSeguida += s;
  }
}

/** Lee lo guardado hoy (una vez por día) para poder sumarle. */
async function cargarHoy(idUser) {
  const dia = hoy();
  if (diaGuardado === dia) return;
  const { data, error } = await supabase.from('app_usage_daily').select('total_seconds')
    .eq('user_id', idUser).eq('date', dia).maybeSingle();
  if (error) throw error;
  guardadosHoy = data?.total_seconds ?? 0;
  diaGuardado = dia;
}

/**
 * Guarda lo acumulado. Si la app estuvo abierta de un día para el otro, lo
 * pendiente se anota al día en que se guarda (la diferencia es de minutos).
 */
let guardando = null; // el guardado en curso (para no correr dos a la vez)

/**
 * Serializado: tick() y pausarUso() podían guardar a la vez; los dos subían el
 * mismo total y restaban lo guardado dos veces, así que `pendientes` quedaba
 * negativo y se perdía tiempo. Ahora el segundo espera al primero y vuelve a
 * mirar qué queda.
 */
export function guardarUso() {
  if (guardando) return guardando.then(() => guardarUso());
  guardando = guardarUnaVez().finally(() => { guardando = null; });
  return guardando;
}

async function guardarUnaVez() {
  cortar();
  const idUser = usuarioMedido;
  if (!idUser || pendientes <= 0) return;
  const aGuardar = pendientes;
  try {
    await cargarHoy(idUser);
    const total = Math.min(guardadosHoy + aGuardar, 86400);
    const { error } = await supabase.from('app_usage_daily')
      .upsert({ user_id: idUser, date: diaGuardado, total_seconds: total }, { onConflict: 'user_id,date' });
    if (error) throw error;
    guardadosHoy = total;
    pendientes = Math.max(0, pendientes - aGuardar);
  } catch {
    // Queda en `pendientes`: se reintenta en el próximo guardado.
  }
}

/** Segundos de uso de hoy, contando lo que todavía no se guardó. */
export function segundosHoy() {
  cortar();
  return (diaGuardado === hoy() ? guardadosHoy : 0) + pendientes;
}

function revisarAvisos() {
  const { wellbeing } = getSettings();
  const dia = hoy();
  const usados = segundosHoy();

  if (wellbeing.daily_limit_enabled && usados >= wellbeing.daily_limit_minutes * 60 && !avisados.has(`limite:${dia}`)) {
    avisados.add(`limite:${dia}`);
    alerta('Llegaste a tu límite de hoy', `Usaste Zooni ${formatoDuracion(usados)}. La app sigue funcionando: es sólo un aviso.`);
  }
  const descanso = DESCANSO_S[wellbeing.break_reminder];
  if (descanso && sesionSeguida >= descanso) {
    sesionSeguida = 0;
    alerta('¿Un descanso?', `Llevás ${formatoDuracion(descanso)} seguidos en Zooni.`);
  }
}

function tick() {
  cortar();
  revisarAvisos();
  if (pendientes >= GUARDAR_CADA_S) guardarUso();
}

/** La app pasó a primer plano (o arrancó con sesión). */
export function empezarUso() {
  if (desde == null) desde = Date.now();
  if (!intervalo) intervalo = setInterval(tick, TICK_MS);
}

/** La app se fue al fondo: se corta la medición y se guarda. */
export function pausarUso() {
  cortar();
  desde = null;
  sesionSeguida = 0;
  if (intervalo) { clearInterval(intervalo); intervalo = null; }
  return guardarUso();
}

/** "1 h 12 min" / "8 min" */
export function formatoDuracion(segundos) {
  const min = Math.round((Number(segundos) || 0) / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// "Ma" y "Mi": con una sola letra, martes y miércoles eran dos "M" iguales.
const LETRAS = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'];

/**
 * Los últimos 7 días, del más viejo a hoy: [{ fecha, letra, segundos }].
 * Hoy incluye lo que todavía no se guardó.
 */
export async function fetchUsoSemana() {
  const idUser = getCurrentUserId();
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { fecha: toISODateLocal(d), letra: LETRAS[d.getDay()], segundos: 0 };
  });
  if (!idUser) return dias;
  const { data, error } = await supabase.from('app_usage_daily').select('date, total_seconds')
    .eq('user_id', idUser).gte('date', dias[0].fecha).lte('date', dias[6].fecha);
  if (error) throw error;
  const porFecha = Object.fromEntries((data ?? []).map((r) => [r.date, r.total_seconds]));
  dias.forEach((d) => { d.segundos = porFecha[d.fecha] ?? 0; });
  dias[6].segundos = Math.max(dias[6].segundos, segundosHoy());
  return dias;
}

/**
 * Resumen semanal: los lunes, una vez por sesión, si está activado. Es local
 * (no hay un servidor que mande avisos programados).
 */
export async function avisarResumenSemanal() {
  const { wellbeing } = getSettings();
  const ahora = new Date();
  const clave = `resumen:${hoy()}`;
  if (!wellbeing.weekly_summary || ahora.getDay() !== 1 || avisados.has(clave)) return;
  avisados.add(clave);
  try {
    const semana = await fetchUsoSemana();
    const total = semana.slice(0, 6).reduce((a, d) => a + d.segundos, 0);
    if (total > 0) {
      alerta('Tu semana en Zooni', `En los últimos 6 días usaste la app ${formatoDuracion(total)} (${formatoDuracion(total / 6)} por día en promedio).`);
    }
  } catch {
    // Sin el dato, no hay resumen: no se inventa uno.
  }
}
