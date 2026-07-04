/**
 * supabase.js — Cliente único de Supabase para toda la app
 *
 * Lee la URL y la key pública desde las variables de entorno EXPO_PUBLIC_*
 * (ver .env en la raíz de zooni-app). La key pública (`sb_publishable_...`)
 * es segura para embeber en el cliente: el control de acceso real se hace
 * con Row Level Security en Postgres, no ocultando esta key.
 *
 * Todavía no hay login (ver src/config/session.js), así que no usamos
 * supabase.auth acá — cuando se implemente login real, este cliente se
 * reutiliza tal cual y se agrega auth con supabase.auth.signInWithPassword.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el .env de zooni-app.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
