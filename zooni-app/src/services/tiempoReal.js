/**
 * tiempoReal.js — Suscripción a cambios de una tabla con Supabase Realtime.
 *
 * Reemplaza el "consultar cada 4 segundos" de los chats. Las tablas tienen que
 * estar en la publicación supabase_realtime (SUPABASE_PEGAR_TODO.sql, 064) y
 * Realtime respeta RLS: sólo llegan cambios de filas que la sesión puede ver.
 *
 * El aviso no trae datos a la pantalla a propósito: quien escucha vuelve a
 * pedir la lista con su servicio de siempre. Así el formato (mapRow, nombres,
 * autor) sigue saliendo de un único lugar.
 */

import { supabase } from '../lib/supabase';

let contador = 0;

/**
 * Escucha INSERT / UPDATE / DELETE de `tabla` (con un `filtro` opcional en la
 * sintaxis de Realtime, ej. 'idMatch=eq.12' o 'id_paseo=in.(3,4)') y llama a
 * `alCambiar` en cada uno. Devuelve la función para dejar de escuchar.
 */
export function escucharCambios({ tabla, filtro, alCambiar }) {
  contador += 1;
  const canal = supabase
    .channel(`zooni-${tabla}-${contador}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tabla, ...(filtro ? { filter: filtro } : {}) },
      () => alCambiar(),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
