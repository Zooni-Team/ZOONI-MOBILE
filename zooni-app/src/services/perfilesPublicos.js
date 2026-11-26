import { supabase } from '../lib/supabase';

export const COLUMNAS_BASICAS = 'Id_User, Nombre, Apellido, FotoPerfil';

export const COLUMNAS_PUBLICAS =
  'Id_User, Nombre, Apellido, NombreUsuario, FotoPerfil, Bio, Ubicacion, Ciudad, Provincia, Pais, '
  + 'Genero, Intereses, UltimaConexion, Estado, Edad, Lat, Lng, Telefono';

export async function consultarPerfiles(columnas, armar) {
  const { data, error } = await armar(supabase.from('perfil_publico').select(columnas));
  if (error) throw error;
  return data ?? [];
}

export async function perfilesPorId(ids, columnas = COLUMNAS_BASICAS) {
  const unicos = [...new Set((ids ?? []).filter((x) => x != null))];
  if (!unicos.length) return [];
  return consultarPerfiles(columnas, (q) => q.in('Id_User', unicos));
}

export async function mapaPerfilesPorId(ids, columnas = COLUMNAS_BASICAS) {
  const filas = await perfilesPorId(ids, columnas);
  return new Map(filas.map((u) => [u.Id_User, u]));
}

export async function perfilPorId(id, columnas = COLUMNAS_PUBLICAS) {
  if (id == null) return null;
  const [fila] = await consultarPerfiles(columnas, (q) => q.eq('Id_User', id).limit(1));
  return fila ?? null;
}
