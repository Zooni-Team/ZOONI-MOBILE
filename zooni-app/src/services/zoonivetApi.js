import { supabase } from '../lib/supabase';
import { fetchMisMascotas } from './petsApi';
import { fetchVacunas, fetchConsultas, fetchHistorialPeso } from './fichaMedicaApi';
import { calcularEdad, calcularEdadMeses } from '../utils/calcularEdad';
import { diasEntre, toISODateLocal } from '../utils/fechaLocal';
import { sanitizarTexto } from '../utils/sanitizar';
import { normalizarBusqueda } from '../utils/texto';

function esSenior(especie, edadMeses) {
  if (edadMeses == null) return false;
  const esp = normalizarBusqueda(especie);
  if (esp.includes('gato')) return edadMeses >= 132;
  return edadMeses >= 96;
}

function esCachorro(especie, edadMeses) {
  if (edadMeses == null) return false;
  return edadMeses < 12;
}

function tendenciaPeso(registros) {
  if (!registros || registros.length < 2) return null;
  const reciente = registros[0];
  const previo = registros[registros.length - 1];
  const delta = reciente.peso - previo.peso;
  const meses = diasEntre(previo.fecha, reciente.fecha);
  if (delta === 0 || meses == null) return null;
  const signo = delta > 0 ? 'subió' : 'bajó';
  const abs = Math.abs(delta).toFixed(1).replace('.', ',');
  const periodo = meses >= 30 ? `${Math.round(meses / 30)} meses` : `${meses} días`;
  return `${signo} ${abs} kg en ${periodo}`;
}

export async function construirContextoMascota(petId) {
  const [{ mascota, aplicadas }, consultas, historialPeso] = await Promise.all([
    fetchVacunas(petId).catch(() => ({ mascota: null, aplicadas: [] })),
    fetchConsultas(petId).catch(() => []),
    fetchHistorialPeso(petId).catch(() => []),
  ]);
  if (!mascota) return null;

  const edadMeses = calcularEdadMeses(mascota.fecha_nacimiento);
  const hoy = toISODateLocal(new Date());

  const vacunasAplicadas = (aplicadas ?? [])
    .filter((v) => v.fecha_aplicacion)
    .map((v) => `${v.nombre} (${v.fecha_aplicacion})`);

  const vacunasPendientes = [];
  for (const v of aplicadas ?? []) {
    if (!v.proximo_refuerzo) continue;
    const dias = diasEntre(hoy, v.proximo_refuerzo);
    if (dias == null) continue;
    if (dias < 0) vacunasPendientes.push(`${v.nombre}: vencida hace ${Math.abs(dias)} días`);
    else if (dias <= 30) vacunasPendientes.push(`${v.nombre}: vence en ${dias} días`);
  }

  return {
    id: mascota.id,
    nombre: sanitizarTexto(mascota.nombre, 30) ?? 'tu mascota',
    especie: mascota.especie ?? null,
    raza: mascota.raza ?? null,
    imagenAsset: mascota.imagen_asset ?? null,
    fotoUrl: mascota.fotoUrl ?? null,
    edadTexto: calcularEdad(mascota.fecha_nacimiento),
    edadMeses,
    etapa: esCachorro(mascota.especie, edadMeses)
      ? 'cachorro'
      : esSenior(mascota.especie, edadMeses)
      ? 'senior'
      : 'adulto',
    pesoKg: mascota.peso != null ? mascota.peso : null,
    pesoTendencia: tendenciaPeso(historialPeso),
    vacunasAplicadas,
    vacunasPendientes,
    consultas: (consultas ?? []).slice(0, 3).map((c) => ({
      fecha: c.fecha,
      motivo: sanitizarTexto(c.motivo, 120),
    })),
    fechaHoy: hoy,
  };
}

export async function fetchMascotasParaChat() {
  const { activas } = await fetchMisMascotas();
  return activas;
}

function errorZooniVet(code, mensaje) {
  const err = new Error(mensaje ?? code);
  err.code = code;
  return err;
}

export async function preguntarZooniVet({ ctx, historial = [], mensaje, signal }) {
  const { data, error } = await supabase.functions.invoke('zoonivet-chat', {
    body: {
      petId: ctx.id,
      mensaje: String(mensaje ?? '').slice(0, 1000),
      historial: historial.slice(-12).map((m) => (m.firma
        ? { role: m.role, content: m.content, firma: m.firma }
        : { role: m.role, content: m.content })),
    },
    signal,
  });

  if (error) {
    const cuerpo = await error.context?.json?.().catch(() => null);
    const status = error.context?.status;
    if (cuerpo?.error) throw errorZooniVet(cuerpo.error, cuerpo.message);
    if (status === 404 || error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
      throw errorZooniVet('SERVICIO_NO_DISPONIBLE', error.message);
    }
    throw errorZooniVet('GROQ_ERROR', error.message);
  }
  if (!data?.texto) throw errorZooniVet('RESPUESTA_INVALIDA');
  return { texto: data.texto, emergencia: !!data.emergencia, firma: data.firma ?? null };
}

const CANT_CHIPS = 4;

const normalizarPregunta = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function sugerenciasIniciales(ctx, yaPreguntadas = []) {
  if (!ctx) return [];
  const nombre = ctx.nombre ?? 'tu mascota';
  const esGato = /gato/i.test(ctx.especie ?? '');
  const vencida = (ctx.vacunasPendientes ?? []).some((v) => /vencida/i.test(v));

  const pool = [
    vencida ? 'Tiene una vacuna vencida, ¿qué hago?' : `¿Qué vacunas le faltan a ${nombre}?`,
    '¿Cuánto debería pesar?',
    esGato ? '¿Cómo hago para que tome más agua?' : '¿Cada cuánto lo saco a pasear?',
    '¿Qué comida le hace mal?',
    '¿Cuántas veces por día tiene que comer?',
    '¿Cada cuánto lo desparasito?',
    esGato ? '¿Cada cuánto le limpio el arenero?' : '¿Cada cuánto lo baño?',
    '¿Cómo le cuido los dientes?',
    '¿Cómo sé si tiene pulgas o garrapatas?',
    '¿Qué juegos o actividades le hacen bien?',
    '¿Cuándo conviene castrarlo?',
    '¿Qué señales indican que está enfermo?',
  ];

  const usadas = new Set(yaPreguntadas.map(normalizarPregunta));
  return pool.filter((p) => !usadas.has(normalizarPregunta(p))).slice(0, CANT_CHIPS);
}
