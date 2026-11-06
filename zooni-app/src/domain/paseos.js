/**
 * domain/paseos.js — Reglas y formatos de los paseos. Lógica PURA.
 *
 * Nada de este archivo habla con Supabase ni con la pantalla: recibe datos y
 * devuelve datos. Por eso se puede probar sin conexión
 * (npm run verify:paseos → scripts/verificar-paseos.mjs).
 *
 * Antes vivía dentro de services/paseadorApi.js, mezclado con el acceso a la
 * base, el modo demo, la autenticación, los pagos y las reseñas. Ahora:
 *   · domain/paseos.js      → qué cuesta un paseo, cuánto duró, cómo se muestra
 *   · services/paseadorApi  → leer y escribir en la base
 *
 * OJO: el precio y la comisión que VALEN los calcula la base (062_reglas_negocio.sql:
 * precio_paseo() y comision_zooni()). Lo de acá sirve para mostrarlos antes
 * de pedir el paseo; si cambia una regla, hay que cambiarla en los dos lados.
 */

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

/**
 * $12.500 · $166,66 — separador de miles manual (Hermes no siempre trae locale
 * es-AR). Los centavos aparecen sólo si los hay (paseos cobrados por tiempo).
 */
export function formatoPlata(n) {
  const centavos = Math.round((Number(n) || 0) * 100);
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const entero = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = abs % 100;
  return `${signo}$${entero}${resto ? `,${String(resto).padStart(2, '0')}` : ''}`;
}

/** Redondea a centavos (evita los 0,1 + 0,2 de los floats). */
export const aCentavos = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

// ─────────────────────────────────────────────
// COBRO: precio fijo, el pactado
// ─────────────────────────────────────────────
// Antes (045 / 047) se cobraba por segundo paseado, con tope en lo pactado, y
// el monto iba subiendo en vivo. No es el modelo: el paseo cuesta lo que se
// acordó al contratarlo, dure lo que dure.

/**
 * Comisión de Zooni por paseo finalizado (0,10 = 10 %). TODAVÍA NO DEFINIDA:
 * mientras sea 0 no se muestra en ningún lado, pero ya se guarda por paseo.
 */
export const COMISION_ZOONI = 0;

/** Segundos enteros paseados (nunca negativos). */
const segundosEnteros = (segundos) => Math.max(0, Math.round(Number(segundos) || 0));

/**
 * Duración legible de un paseo: "31 s", "4 min 10 s", "1 h 5 min".
 */
export function formatoTiempoPaseado(segundos) {
  const s = segundosEnteros(segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return seg > 0 ? `${m} min ${seg} s` : `${m} min`;
  return `${seg} s`;
}

/** Comisión de Zooni sobre lo cobrado en un paseo. */
export const comisionDe = (cobrado) => aCentavos(Number(cobrado) * COMISION_ZOONI);

/** Minutos después de finalizar en los que todavía se puede retomar el paseo. */
export const RETOMAR_MINUTOS = 15;

/** ¿Este paseo recién finalizado se puede retomar todavía? */
export function sePuedeRetomar(paseo, ahora = Date.now()) {
  if (paseo?.estado !== 'finalizado' || !paseo.horaFin) return false;
  return ahora - new Date(paseo.horaFin).getTime() < RETOMAR_MINUTOS * 60 * 1000;
}

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

export const MEDIOS_PAGO = [
  { key: 'efectivo', label: 'Efectivo', icono: 'cash-outline' },
  { key: 'transferencia', label: 'Transferencia', icono: 'swap-horizontal-outline' },
  { key: 'mercadopago', label: 'Mercado Pago', icono: 'phone-portrait-outline' },
  { key: 'otro', label: 'Otro', icono: 'ellipsis-horizontal-circle-outline' },
];
export const medioDePago = (key) => MEDIOS_PAGO.find((m) => m.key === key) ?? null;

export const MODALIDADES_COBRO = [
  { key: 'por_paseo', label: 'Cada paseo', corto: 'Paga cada paseo', icono: 'walk-outline' },
  { key: 'semanal', label: 'Fin de semana', corto: 'Paga los domingos', icono: 'calendar-outline' },
  { key: 'mensual', label: 'Fin de mes', corto: 'Paga a fin de mes', icono: 'calendar-number-outline' },
];
export const modalidadDeCobro = (key) => MODALIDADES_COBRO.find((m) => m.key === key) ?? MODALIDADES_COBRO[0];

const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Último cierre de período (YYYY-MM-DD) hasta `hoy` inclusive:
 *   semanal → el domingo más reciente · mensual → el último día del mes
 *   (hoy si hoy es fin de mes; si no, el del mes anterior) · por_paseo → null
 */
export function ultimoCierre(modalidad, hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (modalidad === 'semanal') {
    d.setDate(d.getDate() - d.getDay());
    return fechaISO(d);
  }
  if (modalidad === 'mensual') {
    const manana = new Date(d);
    manana.setDate(d.getDate() + 1);
    if (manana.getMonth() !== d.getMonth()) return fechaISO(d);
    return fechaISO(new Date(d.getFullYear(), d.getMonth(), 0));
  }
  return null;
}

/** Próximo cierre de período (para mostrar "te avisamos el …"). */
export function proximoCierre(modalidad, hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (modalidad === 'semanal') {
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    return d;
  }
  if (modalidad === 'mensual') return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return null;
}

/**
 * Antigüedad en Zooni, contada desde la fecha más vieja que se conozca: el
 * alta como paseador (paseador_perfil.creado_en) o el primer paseo terminado.
 * No se pregunta al registrarse. → { valor, etiqueta } para un Stat:
 *   primera semana → "Nuevo" · después semanas · después meses · después años.
 */
export function experienciaEnZooni(fechas, ahora = new Date()) {
  const tiempos = (Array.isArray(fechas) ? fechas : [fechas])
    .map((f) => (f ? new Date(f).getTime() : NaN))
    .filter(Number.isFinite);
  if (!tiempos.length) return { valor: 'Nuevo', etiqueta: 'en Zooni' };
  const desde = new Date(Math.min(...tiempos));

  // Días de calendario (no de 24 h): registrarse a las 23 h no adelanta un día
  const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.max(0, Math.round((dia(ahora) - dia(desde)) / 86400000));
  if (dias < 7) return { valor: 'Nuevo', etiqueta: 'en Zooni' };

  let meses = (ahora.getFullYear() - desde.getFullYear()) * 12 + (ahora.getMonth() - desde.getMonth());
  if (ahora.getDate() < desde.getDate()) meses -= 1;
  if (meses < 1) {
    const semanas = Math.floor(dias / 7);
    return { valor: String(semanas), etiqueta: semanas === 1 ? 'semana en Zooni' : 'semanas en Zooni' };
  }
  if (meses < 12) return { valor: String(meses), etiqueta: meses === 1 ? 'mes en Zooni' : 'meses en Zooni' };
  const anios = Math.floor(meses / 12);
  return { valor: String(anios), etiqueta: anios === 1 ? 'año en Zooni' : 'años en Zooni' };
}

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
