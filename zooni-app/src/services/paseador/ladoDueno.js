import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { perfilesPorId } from '../perfilesPublicos';
import { distanciaMetros } from '../../utils/geo';
import { fechaHoraFija } from '../../utils/fechaLocal';
import { MEDIOS_PAGO, formatoPlata, precioPara } from '../../domain/paseos';
import { errorApp, esEsquemaFaltante } from '../comun';
import { notificarPaseo } from './avisos';
import { mapPerfil } from './perfil';
import { COLUMNAS_PASEO, enriquecer } from './paseos';
import { leerOpiniones } from './resenas';

export async function fetchPaseadoresZona(bbox) {
  let q = supabase.from('paseador_perfil').select('*').not('lat', 'is', null);
  if (bbox) {
    const m = 0.05;
    q = q.gte('lat', bbox.lat_min - m).lte('lat', bbox.lat_max + m)
      .gte('lng', bbox.lng_min - m).lte('lng', bbox.lng_max + m);
  }
  const { data, error } = await q.limit(100);
  if (error) throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  const yo = getCurrentUserId();
  return conEstadisticas((data ?? []).filter((r) => r.id_user !== yo));
}

async function conEstadisticas(filas) {
  if (!filas.length) return [];
  const ids = filas.map((r) => r.id_user);
  const [usuarios, { data: calificados }, opiniones] = await Promise.all([
    perfilesPorId(ids),
    supabase.from('Paseo').select('Id_Walker, Rating').in('Id_Walker', ids).eq('Estado', 'finalizado'),
    leerOpiniones(ids),
  ]);
  const porUser = Object.fromEntries((usuarios ?? []).map((u) => [u.Id_User, u]));
  const stats = {};
  const statsDe = (id) => (stats[id] ??= { paseos: 0, suma: 0, votos: 0 });
  (calificados ?? []).forEach((pz) => {
    const st = statsDe(pz.Id_Walker);
    st.paseos += 1;
    if (pz.Rating != null) { st.suma += pz.Rating; st.votos += 1; }
  });
  opiniones.forEach((o) => {
    const st = statsDe(o.id_walker);
    st.suma += o.rating;
    st.votos += 1;
  });

  return filas.map((r) => {
    const u = porUser[r.id_user] ?? {};
    const st = statsDe(r.id_user);
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
    .map((p) => ({ ...p, distanciaKm: (distanciaMetros(yo, p) ?? Infinity) / 1000 }))
    .filter((p) => p.radioKm > 0 && p.distanciaKm <= p.radioKm)
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
}

export async function fetchPaseadorPublico(idUser) {
  const { data: row, error } = await supabase.from('paseador_perfil').select('*').eq('id_user', idUser).maybeSingle();
  if (error) throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  if (!row) return null;
  return (await conEstadisticas([row]))[0];
}

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

export async function fetchMisPaseosDueno() {
  supabase.rpc('vencer_paseos').then(() => {}, () => {});
  const { data, error } = await supabase.from('Paseo').select(COLUMNAS_PASEO)
    .eq('Id_Dueno', getCurrentUserId())
    .order('CreadoEn', { ascending: false })
    .limit(50);
  if (error) throw errorApp(esEsquemaFaltante(error) ? 'migracion_pendiente' : 'error_base', error);
  return enriquecer(data ?? []);
}

export async function cancelarPaseoDueno(paseo) {
  const { error } = await supabase.from('Paseo').update({ Estado: 'cancelado' })
    .eq('Id_Paseo', paseo.id).in('Estado', ['pendiente', 'aceptado']);
  if (error) throw error;
  notificarPaseo(paseo.idWalker, 'Paseo cancelado por el dueño',
    `${paseo.mascota.nombre} · ${fechaHoraFija(paseo.fecha)}`, 'inicio');
}

export async function fetchPaseosParaOpinar(idWalker) {
  const conEl = (await fetchMisPaseosDueno())
    .filter((p) => String(p.idWalker) === String(idWalker) && p.estado === 'finalizado');
  return { sinCalificar: conEl.filter((p) => p.rating == null), total: conEl.length };
}
