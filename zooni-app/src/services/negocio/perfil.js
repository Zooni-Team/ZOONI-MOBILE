import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../config/session';
import { subirImagenPublica } from '../imagenStorage';
import { HORARIOS_NEGOCIO_DEFAULT } from '../../constants/negocios';
import { errorBase } from '../comun';
import { fetchItems } from './catalogo';

export function mapNegocio(r, idServicio = null) {
  return {
    id: r.id,
    idUser: r.id_user,
    tipo: r.tipo,
    nombre: r.nombre,
    descripcion: r.descripcion ?? '',
    direccion: r.direccion ?? '',
    barrio: r.barrio ?? '',
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    telefono: r.telefono ?? '',
    logo: r.logo ?? null,
    horarios: { ...HORARIOS_NEGOCIO_DEFAULT(), ...(r.horarios ?? {}) },
    abierto: r.abierto !== false,
    datos: r.datos ?? {},
    creadoEn: r.creado_en,
    idServicio,
  };
}

async function servicioDe(idNegocio) {
  const { data } = await supabase.from('servicios').select('id').eq('id_negocio', idNegocio).maybeSingle();
  return data?.id ?? null;
}

export async function fetchMiNegocio(tipo) {
  const { data, error } = await supabase.from('negocio_perfil').select('*')
    .eq('id_user', getCurrentUserId()).eq('tipo', tipo).maybeSingle();
  if (error) throw errorBase(error);
  if (!data) return null;
  return mapNegocio(data, await servicioDe(data.id));
}

export async function fetchMisNegocios(id = getCurrentUserId()) {
  if (id == null) return [];
  const { data, error } = await supabase.from('negocio_perfil').select('id, tipo, nombre').eq('id_user', id);
  if (error) return [];
  return data ?? [];
}

const COLUMNAS_NEGOCIO = {
  nombre: 'nombre', descripcion: 'descripcion', direccion: 'direccion', barrio: 'barrio',
  lat: 'lat', lng: 'lng', telefono: 'telefono', logo: 'logo', horarios: 'horarios',
  abierto: 'abierto', datos: 'datos',
};
const COLUMNAS_PIN = ['nombre', 'direccion', 'lat', 'lng', 'telefono', 'descripcion'];

export async function actualizarNegocio(negocio, campos) {
  const fila = { actualizado_en: new Date().toISOString() };
  Object.entries(campos).forEach(([k, v]) => { if (COLUMNAS_NEGOCIO[k]) fila[COLUMNAS_NEGOCIO[k]] = v; });
  const { error } = await supabase.from('negocio_perfil').update(fila)
    .eq('id', negocio.id).eq('id_user', getCurrentUserId());
  if (error) throw errorBase(error);

  const pin = {};
  COLUMNAS_PIN.forEach((k) => { if (k in campos) pin[k] = campos[k]; });
  if (Object.keys(pin).length) {
    await supabase.from('servicios').update(pin).eq('id_negocio', negocio.id);
  }
  return { ...negocio, ...campos };
}

export function actualizarDatos(negocio, cambios) {
  return actualizarNegocio(negocio, { datos: { ...(negocio.datos ?? {}), ...cambios } });
}

export async function subirLogoNegocio(negocio, uri) {
  const url = await subirImagenPublica(uri, 'negocios');
  return actualizarNegocio(negocio, { logo: url });
}

export function setAbiertoNegocio(negocio, abierto) {
  return actualizarNegocio(negocio, { abierto });
}

export const GALERIA_MAX = 30;

export async function agregarFotoGaleria(negocio, uri, nota = '') {
  const url = await subirImagenPublica(uri, 'negocios');
  const galeria = [{ url, nota: nota.trim(), fecha: new Date().toISOString() }, ...(negocio.datos?.galeria ?? [])]
    .slice(0, GALERIA_MAX);
  return actualizarDatos(negocio, { galeria });
}

export function borrarFotoGaleria(negocio, url) {
  return actualizarDatos(negocio, { galeria: (negocio.datos?.galeria ?? []).filter((f) => f.url !== url) });
}

export async function fetchNegocioPublico(idNegocio) {
  const { data, error } = await supabase.from('negocio_perfil').select('*').eq('id', idNegocio).maybeSingle();
  if (error) throw errorBase(error);
  if (!data) return null;
  const [idServicio, items] = await Promise.all([servicioDe(idNegocio), fetchItems(idNegocio, { soloActivos: true })]);
  const tabla = data.tipo === 'petshop' ? 'negocio_pedidos' : 'negocio_turnos';
  const estado = data.tipo === 'petshop' ? 'entregado' : 'completado';
  const { count } = await supabase.from(tabla).select('id', { count: 'exact', head: true })
    .eq('id_negocio', idNegocio).eq('estado', estado);
  return { ...mapNegocio(data, idServicio), items, realizados: count ?? 0 };
}
