/**
 * perfilesPublicos.js — Datos de OTRAS personas (nombre, foto, etc.).
 *
 * Única puerta para leer usuarios ajenos. Va contra la vista perfil_publico
 * (061_rls_por_usuario.sql), que expone sólo lo que una pantalla necesita
 * mostrar de otro: nada de mail, la edad en vez de la fecha de nacimiento, la
 * ubicación redondeada a ~1 km y el teléfono sólo si hay un paseo, turno o
 * pedido en común. La tabla "User" completa sólo devuelve la fila propia.
 *
 * Pedí siempre las columnas que vas a usar (principio de mínimo dato):
 *   perfilesPorId(ids, 'Id_User, Nombre, FotoPerfil')
 */

import { supabase } from '../lib/supabase';
import { calcularEdadAnios } from '../utils/calcularEdad';

/** Lo que se suele mostrar de alguien en una lista o un chat. */
export const COLUMNAS_BASICAS = 'Id_User, Nombre, Apellido, FotoPerfil';

/** Todas las columnas que existen en perfil_publico. */
export const COLUMNAS_PUBLICAS =
  'Id_User, Nombre, Apellido, NombreUsuario, FotoPerfil, Bio, Ubicacion, Ciudad, Provincia, Pais, '
  + 'Genero, Intereses, UltimaConexion, Estado, Edad, Lat, Lng, Telefono';

// 42P01 / PGRST205: la vista no existe todavía (falta correr la 061).
const sinVista = (error) => error?.code === '42P01' || error?.code === 'PGRST205';

/**
 * TRANSICIÓN: mientras no esté la 061 se lee "User" (abierta como antes),
 * pidiendo las mismas columnas. Borrar cuando la 061 esté aplicada.
 */
function consultaRespaldo(columnas) {
  const cols = columnas.replace(/\bEdad\b/, 'FechaNacimiento');
  return supabase.from('User').select(cols);
}

function normalizar(fila) {
  if (fila && fila.Edad === undefined && 'FechaNacimiento' in fila) {
    const { FechaNacimiento, ...resto } = fila;
    return { ...resto, Edad: calcularEdadAnios(FechaNacimiento) };
  }
  return fila;
}

/**
 * Ejecuta `armar(consulta)` contra perfil_publico (o el respaldo).
 * `armar` recibe el `.select(...)` y le agrega filtros: .in(), .eq(), .ilike()…
 */
export async function consultarPerfiles(columnas, armar) {
  let { data, error } = await armar(supabase.from('perfil_publico').select(columnas));
  if (sinVista(error)) ({ data, error } = await armar(consultaRespaldo(columnas)));
  if (error) throw error;
  return (data ?? []).map(normalizar);
}

/** Perfiles de varias personas por id. */
export async function perfilesPorId(ids, columnas = COLUMNAS_BASICAS) {
  const unicos = [...new Set((ids ?? []).filter((x) => x != null))];
  if (!unicos.length) return [];
  return consultarPerfiles(columnas, (q) => q.in('Id_User', unicos));
}

/** Mapa Id_User → perfil, para enriquecer listas. */
export async function mapaPerfilesPorId(ids, columnas = COLUMNAS_BASICAS) {
  const filas = await perfilesPorId(ids, columnas);
  return new Map(filas.map((u) => [u.Id_User, u]));
}

/** El perfil de una persona (o null). */
export async function perfilPorId(id, columnas = COLUMNAS_PUBLICAS) {
  if (id == null) return null;
  const [fila] = await consultarPerfiles(columnas, (q) => q.eq('Id_User', id).limit(1));
  return fila ?? null;
}
