/**
 * supabase.js — Cliente único de Supabase para toda la app
 *
 * Lee la URL y la key pública desde las variables de entorno EXPO_PUBLIC_*
 * (ver .env en la raíz de zooni-app). La key pública (`sb_publishable_...`)
 * es segura para embeber en el cliente: el control de acceso real se hace
 * con Row Level Security en Postgres, no ocultando esta key.
 *
 * La sesión de la app no usa Supabase Auth (ver src/config/session.js), así
 * que este cliente no usa supabase.auth. La única excepción es el login con
 * Google / Facebook / Apple, que va por `supabaseSocial` (abajo).
 */

import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el .env de zooni-app.'
  );
}

/**
 * Sin .env, createClient(undefined) tira un error al importar el módulo y la
 * app entera muere antes de renderizar. En su lugar se exporta un stub donde
 * cualquier cadena (`.from().select().eq()...`) resuelve `{ data: null,
 * error }`, así cada pantalla activa su propio fallback de datos demo.
 */
function crearStubSinConfig() {
  const error = new Error(
    'Supabase sin configurar (faltan las variables EXPO_PUBLIC_* en el .env)'
  );
  // Cada nodo es a la vez invocable (`.from(...)`) y navegable
  // (`.storage.from`), y al hacerle await resuelve como query fallida.
  const handler = {
    get(_target, prop) {
      // `await cadena` llama a .then() → resuelve como una query fallida
      if (prop === 'then') {
        return (resolve) => resolve({ data: null, error });
      }
      return crearNodo();
    },
    apply() {
      return crearNodo();
    },
  };
  function crearNodo() {
    return new Proxy(function () {}, handler);
  }
  return crearNodo();
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : crearStubSinConfig();

/**
 * Cliente APARTE sólo para "Entrar con Google / Facebook / Apple"
 * (services/socialAuthApi.js). Guarda su propia sesión de Supabase Auth con
 * otra clave de storage, así el cliente principal sigue anónimo como siempre:
 * si compartieran sesión, todas las queries de la app pasarían a ir con el
 * rol `authenticated` y los permisos pensados para `anon` dejarían de aplicar.
 * El flujo PKCE devuelve un ?code= que se canjea a mano al volver a la app.
 */
export const supabaseSocial =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storageKey: 'zooni-social-auth',
          // El login social es sólo web por ahora (sin expo-web-browser): en
          // nativo no hay storage configurado para la sesión.
          persistSession: Platform.OS === 'web',
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      })
    : crearStubSinConfig();
