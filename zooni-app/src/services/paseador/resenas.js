/**
 * paseador/resenas.js — Reseñas de paseadores (estilo Google Maps): estrellas,
 * aspectos, preguntas de sí/no y fotos o videos.
 *
 * Hay dos orígenes: la calificación de un paseo terminado (columnas Resena* de
 * "Paseo") y las opiniones sin paseo (tabla paseador_opiniones).
 */

import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { resolveMascotaVisual } from '../../constants/petImages';
import { subirArchivoPublico } from '../imagenStorage';
import { perfilesPorId } from '../perfilesPublicos';
import { ASPECTOS_RESENA, PREGUNTAS_RESENA, MEDIA_RESENA_MAX } from '../../domain/paseos';
import { errorApp, esEsquemaFaltante } from '../comun';
import { notificarPaseo } from './avisos';
import { fetchMisPaseos } from './paseos';

/** Mis reseñas como paseador, con el promedio y cuándo fue mi primer paseo. */
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
 * Opiniones sobre un paseador SIN paseo de por medio (048): cualquiera puede
 * opinar cuando quiera y las veces que quiera, también el propio paseador.
 * Sin la 048 devuelve [] y todo sigue con las reseñas de los paseos.
 */
export async function leerOpiniones(idsWalker) {
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
