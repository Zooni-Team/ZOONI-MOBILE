import { supabase } from '../lib/supabase';

let contador = 0;

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
