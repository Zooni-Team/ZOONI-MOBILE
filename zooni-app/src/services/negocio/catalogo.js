/**
 * negocio/catalogo.js — Lo que ofrece un negocio (tabla negocio_items):
 * servicios con precio y duración, o productos con stock.
 */

import { supabase } from '../../lib/supabase';
import { subirImagenPublica, borrarImagenPublica } from '../imagenStorage';
import { TAMANOS, configNegocio } from '../../constants/negocios';
import { aCentavos } from '../../domain/paseos';
import { validarItem } from '../../domain/negocios';
import { errorBase } from '../comun';

function mapItem(r) {
  return {
    id: r.id,
    idNegocio: r.id_negocio,
    clase: r.clase,
    nombre: r.nombre,
    descripcion: r.descripcion ?? '',
    categoria: r.categoria ?? 'Otros',
    precio: Number(r.precio ?? 0),
    precios: r.precios ?? null,
    duracionMin: r.duracion_min ?? null,
    stock: r.stock,
    foto: r.foto ?? null,
    activo: r.activo !== false,
    orden: r.orden ?? 0,
  };
}

export async function fetchItems(idNegocio, { soloActivos = false } = {}) {
  let q = supabase.from('negocio_items').select('*').eq('id_negocio', idNegocio);
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q.order('categoria').order('orden').order('nombre');
  if (error) throw errorBase(error);
  return (data ?? []).map(mapItem);
}

function filaItem(idNegocio, item, tipo) {
  const cfg = configNegocio(tipo);
  const precios = cfg.preciosPorTamano
    ? Object.fromEntries(TAMANOS.map((t) => [t.key, Number(item.precios?.[t.key]) > 0 ? Number(item.precios[t.key]) : null]))
    : null;
  const precio = cfg.preciosPorTamano
    ? Math.min(...Object.values(precios).filter((x) => x > 0))
    : Number(item.precio);
  const stock = item.stock === '' || item.stock === null || item.stock === undefined ? null : Math.round(Number(item.stock));
  return {
    id_negocio: idNegocio,
    clase: cfg.clase,
    nombre: item.nombre.trim().slice(0, 120),
    descripcion: item.descripcion?.trim().slice(0, 400) || null,
    categoria: item.categoria || 'Otros',
    precio: aCentavos(precio),
    precios,
    duracion_min: cfg.clase === 'servicio' ? Math.round(Number(item.duracionMin)) : null,
    stock: cfg.clase === 'producto' ? stock : null,
    foto: item.foto ?? null,
    activo: item.activo !== false,
  };
}

/** Crea (sin id) o actualiza un item. La foto (uri local) se sube primero. */
export async function guardarItem(negocio, item) {
  const err = validarItem(item, negocio.tipo);
  if (err) throw new Error(err);
  let foto = item.foto ?? null;
  if (foto && !/^https?:\/\//.test(foto)) foto = await subirImagenPublica(foto, 'negocios');
  const fila = filaItem(negocio.id, { ...item, foto }, negocio.tipo);
  const q = item.id
    ? supabase.from('negocio_items').update(fila).eq('id', item.id).eq('id_negocio', negocio.id)
    : supabase.from('negocio_items').insert(fila);
  const { error } = await q;
  if (error) throw errorBase(error);
}

export async function borrarItem(negocio, id) {
  // La foto se lee ANTES de borrar la fila: después ya no hay de dónde sacar
  // la URL. A diferencia de mascotas y consultas, negocio_items no tiene
  // trigger en la 068, así que este es el único lugar que la limpia (#70).
  const { data: fila } = await supabase.from('negocio_items').select('foto')
    .eq('id', id).eq('id_negocio', negocio.id).maybeSingle();

  const { error } = await supabase.from('negocio_items').delete().eq('id', id).eq('id_negocio', negocio.id);
  if (error) {
    // Con turnos que lo referencian igual se puede (ON DELETE SET NULL); si
    // falla por otra cosa, se desactiva para que no se ofrezca más
    const { error: e2 } = await supabase.from('negocio_items').update({ activo: false })
      .eq('id', id).eq('id_negocio', negocio.id);
    if (e2) throw errorBase(error);
  } else if (fila?.foto) {
    borrarImagenPublica(fila.foto);
  }
}

export async function setItemActivo(negocio, id, activo) {
  const { error } = await supabase.from('negocio_items').update({ activo }).eq('id', id).eq('id_negocio', negocio.id);
  if (error) throw errorBase(error);
}

export async function ajustarStock(negocio, item, delta) {
  const stock = Math.max(0, (item.stock ?? 0) + delta);
  const { error } = await supabase.from('negocio_items').update({ stock }).eq('id', item.id).eq('id_negocio', negocio.id);
  if (error) throw errorBase(error);
  return stock;
}

/** Carga de una los servicios sugeridos que eligió (los que todavía no tiene). */
export async function agregarSugeridos(negocio, sugeridos, existentes = []) {
  const tiene = new Set(existentes.map((i) => i.nombre.trim().toLowerCase()));
  const filas = sugeridos
    .filter((x) => !tiene.has(x.nombre.trim().toLowerCase()))
    .map((x, i) => ({
      ...filaItem(negocio.id, {
        nombre: x.nombre, categoria: x.categoria, precio: x.precio, precios: x.precios,
        duracionMin: x.duracion, activo: true,
      }, negocio.tipo),
      orden: i,
    }));
  if (!filas.length) return 0;
  const { error } = await supabase.from('negocio_items').insert(filas);
  if (error) throw errorBase(error);
  return filas.length;
}
