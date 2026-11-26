/**
 * mascotasDeClientes.js — Peso y fecha de nacimiento de las mascotas que
 * atiende un paseador o un negocio.
 *
 * mascota_publica no los trae (son datos de salud, informe #12). La vista
 * mascota_de_cliente (MIGRACION_072) los da sólo a quien tiene un trato
 * vigente con esa mascota: el paseador de un paseo aceptado o en curso, el
 * negocio con un turno pendiente, confirmado o completado. Para las demás
 * mascotas la vista no devuelve fila y quedan en null.
 */

import { supabase } from '../lib/supabase';

/**
 * { [Id_Mascota]: { peso, nacimiento } } para las mascotas que la sesión
 * atiende. Nunca tira: es un dato de más para la ficha, y sin la 072 (o sin
 * red) la pantalla se muestra igual, sin peso.
 */
export async function datosDeClientePorMascota(ids) {
  const lista = [...new Set((ids ?? []).filter(Boolean))];
  if (!lista.length) return {};
  try {
    const { data, error } = await supabase.from('mascota_de_cliente')
      .select('Id_Mascota, Peso, FechaNacimiento')
      .in('Id_Mascota', lista);
    if (error) return {};
    return Object.fromEntries((data ?? []).map((m) => [m.Id_Mascota, {
      peso: m.Peso != null ? Number(m.Peso) : null,
      nacimiento: m.FechaNacimiento ?? null,
    }]));
  } catch {
    return {};
  }
}
