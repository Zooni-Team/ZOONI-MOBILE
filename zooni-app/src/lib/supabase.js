/**
 * supabase.js — Cliente único de Supabase para toda la app
 *
 * Lee la URL y la clave pública desde EXPO_PUBLIC_SUPABASE_URL y
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Todo lo EXPO_PUBLIC_* termina dentro
 * del bundle que descarga cualquiera: esta clave es pública por diseño y NO
 * protege nada por sí sola.
 *
 * Lo que protege los datos es la combinación de:
 *   · la sesión de Supabase Auth: tras el login, cada consulta viaja con un JWT
 *     firmado por Supabase (no con un id que diga la app), y
 *   · las políticas de Row Level Security (supabase/SUPABASE_PEGAR_TODO.sql (sección 061)),
 *     que deciden fila por fila con usuario_actual(), sacado de ese JWT.
 *
 * La sesión se guarda en localStorage (web) o en SecureStore (nativo) y se
 * renueva sola (autoRefreshToken). El login con Google / Facebook usa este
 * mismo cliente.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el .env de zooni-app (ver .env.example).'
  );
}

/**
 * SecureStore guarda como máximo ~2 KB por clave y una sesión de Supabase
 * (JWT + refresh token + datos del usuario) suele pasarse. Se parte en trozos.
 */
const TROZO = 1800;
const almacenNativo = {
  async getItem(clave) {
    const cantidad = Number(await SecureStore.getItemAsync(`${clave}_n`));
    if (!cantidad) return SecureStore.getItemAsync(clave);
    const partes = await Promise.all(
      Array.from({ length: cantidad }, (_, i) => SecureStore.getItemAsync(`${clave}_${i}`))
    );
    return partes.some((p) => p == null) ? null : partes.join('');
  },
  async setItem(clave, valor) {
    const partes = valor.match(new RegExp(`[\\s\\S]{1,${TROZO}}`, 'g')) ?? [''];
    await Promise.all(partes.map((p, i) => SecureStore.setItemAsync(`${clave}_${i}`, p)));
    await SecureStore.setItemAsync(`${clave}_n`, String(partes.length));
  },
  async removeItem(clave) {
    const cantidad = Number(await SecureStore.getItemAsync(`${clave}_n`)) || 0;
    await Promise.all([
      SecureStore.deleteItemAsync(clave),
      SecureStore.deleteItemAsync(`${clave}_n`),
      ...Array.from({ length: cantidad }, (_, i) => SecureStore.deleteItemAsync(`${clave}_${i}`)),
    ]);
  },
};

/**
 * Sin .env, createClient(undefined) tira un error al importar el módulo y la
 * app entera muere antes de renderizar. En su lugar se exporta un stub donde
 * cualquier cadena (`.from().select().eq()...`) resuelve `{ data: null,
 * error }`, así cada pantalla muestra su estado de error.
 */
function crearStubSinConfig() {
  const error = new Error(
    'Supabase sin configurar (faltan las variables EXPO_PUBLIC_* en el .env)'
  );
  const handler = {
    get(_target, prop) {
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
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          storageKey: 'zooni-auth',
          storage: Platform.OS === 'web' ? undefined : almacenNativo,
          persistSession: true,
          autoRefreshToken: true,
          // El retorno de Google / Facebook (?code=…) se canjea a mano en
          // socialAuthApi.completarRetornoSocial().
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      })
    : crearStubSinConfig();
