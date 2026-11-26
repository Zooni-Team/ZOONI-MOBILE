import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { datosDeClientePorMascota } from '../mascotasDeClientes';
import { resolveMascotaVisual } from '../../constants/petImages';
import { perfilesPorId } from '../perfilesPublicos';
import { fechaHoraFija } from '../../utils/fechaLocal';
import { estadoVigente, formatoPlata, formatoDistancia, segundosDePaseo, formatoTiempoPaseado, comisionDe } from '../../domain/paseos';
import { errorApp } from '../comun';
import { notificarDueno } from './avisos';

const HORA = 3600 * 1000;

export const COLUMNAS_PASEO = '"Id_Paseo","Id_Mascota","Id_Walker","Id_Dueno","Estado","FechaProgramada","DuracionMin","Precio","Direccion","Lat","Lng","Notas","DistanciaMetros","SegundosAcumulados","ReanudadoEn","HoraInicio","HoraFin","Rating","Resena","CreadoEn"'
  .replace(/"/g, '');

export async function enriquecer(rows) {
  if (!rows?.length) return [];
  const idsMascota = [...new Set(rows.map((r) => r.Id_Mascota))];
  const [{ data: mascotas }, clientes] = await Promise.all([
    supabase
      .from('mascota_publica')
      .select('Id_Mascota, Id_User, Nombre, Especie, Raza, Tamano, Foto, ImagenAsset, MostrarFoto')
      .in('Id_Mascota', idsMascota),
    datosDeClientePorMascota(idsMascota),
  ]);
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
        tamano: m.Tamano ?? null,
        peso: clientes[r.Id_Mascota]?.peso ?? null,
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

export async function fetchSolicitudes() {
  const yo = getCurrentUserId();
  const { data, error } = await supabase
    .from('Paseo').select(COLUMNAS_PASEO)
    .eq('Estado', 'pendiente')
    .or(`Id_Walker.is.null,Id_Walker.eq.${Number(yo)}`)
    .order('FechaProgramada', { ascending: true });
  if (error) throw errorApp('error_base', error);

  const { data: rechazos } = await supabase.from('paseo_rechazos').select('id_paseo').eq('id_walker', yo);
  const ocultas = new Set((rechazos ?? []).map((r) => r.id_paseo));
  const limite = Date.now() - HORA;
  const vigentes = (data ?? []).filter((r) =>
    !ocultas.has(r.Id_Paseo) && r.Id_Dueno !== yo
    && (!r.FechaProgramada || new Date(r.FechaProgramada).getTime() > limite));
  return enriquecer(vigentes);
}

export async function fetchMisPaseos(estados, { desde } = {}) {
  const yo = getCurrentUserId();
  let q = supabase.from('Paseo').select(COLUMNAS_PASEO)
    .eq('Id_Walker', yo).in('Estado', estados)
    .order('FechaProgramada', { ascending: true });
  if (desde) q = q.gte('FechaProgramada', desde.toISOString());
  const { data, error } = await q;
  if (error) throw errorApp('error_base', error);
  return (await enriquecer(data ?? [])).filter((p) => estados.includes(p.estado));
}

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

export async function fetchRecorrido(idPaseo) {
  const { data } = await supabase.from('PaseoTrack')
    .select('Lat, Lng').eq('Id_Paseo', idPaseo).order('Timestamp', { ascending: true });
  return (data ?? []).map((p) => ({ lat: Number(p.Lat), lng: Number(p.Lng) }));
}

async function updatePaseo(id, fila) {
  const { error } = await supabase.from('Paseo').update(fila).eq('Id_Paseo', id);
  if (error) throw error;
}

export async function aceptarSolicitud(paseo) {
  const { data, error } = await supabase.rpc('aceptar_solicitud_paseo', {
    p_id_paseo: paseo.id, p_id_walker: null,
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
  await updatePaseo(paseo.id, fila);
  notificarDueno(paseo, `${paseo.mascota.nombre} ya volvió a casa 🏠`,
    `Paseo de ${formatoTiempoPaseado(segundos)} · ${formatoDistancia(metros)} · ${formatoPlata(precio)}. ¡Dejale una reseña al paseador!`);
  return { ...paseo, ...cambios };
}

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

export async function registrarPunto(idPaseo, { lat, lng }, distanciaTotal) {
  await Promise.all([
    supabase.from('PaseoTrack').insert({ Id_Paseo: idPaseo, Lat: lat, Lng: lng, Timestamp: new Date().toISOString() }),
    supabase.from('Paseo').update({ DistanciaMetros: Math.round(distanciaTotal) }).eq('Id_Paseo', idPaseo),
  ]);
}
