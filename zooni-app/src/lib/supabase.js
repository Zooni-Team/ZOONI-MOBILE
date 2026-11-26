import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_ORIGIN = supabaseUrl ? new URL(supabaseUrl).origin : null;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el .env de zooni-app (ver .env.example).'
  );
}

const TROZO = 1800;
const OPCIONES = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const almacenNativo = {
  async getItem(clave) {
    const cantidad = Number(await SecureStore.getItemAsync(`${clave}_n`, OPCIONES));
    if (!cantidad) return SecureStore.getItemAsync(clave, OPCIONES);
    const partes = await Promise.all(
      Array.from({ length: cantidad }, (_, i) => SecureStore.getItemAsync(`${clave}_${i}`, OPCIONES))
    );
    if (partes.some((p) => p == null)) return null;
    const valor = partes.join('');
    try {
      JSON.parse(valor);
    } catch {
      return null;
    }
    return valor;
  },
  async setItem(clave, valor) {
    const cantidadAntes = Number(await SecureStore.getItemAsync(`${clave}_n`, OPCIONES)) || 0;
    const partes = valor.match(new RegExp(`[\\s\\S]{1,${TROZO}}`, 'g')) ?? [''];
    await Promise.all(partes.map((p, i) => SecureStore.setItemAsync(`${clave}_${i}`, p, OPCIONES)));
    await SecureStore.setItemAsync(`${clave}_n`, String(partes.length), OPCIONES);
    await Promise.all(
      Array.from(
        { length: Math.max(0, cantidadAntes - partes.length) },
        (_, i) => SecureStore.deleteItemAsync(`${clave}_${partes.length + i}`, OPCIONES),
      ),
    );
  },
  async removeItem(clave) {
    const cantidad = Number(await SecureStore.getItemAsync(`${clave}_n`, OPCIONES)) || 0;
    await Promise.all([
      SecureStore.deleteItemAsync(clave, OPCIONES),
      SecureStore.deleteItemAsync(`${clave}_n`, OPCIONES),
      ...Array.from({ length: cantidad }, (_, i) => SecureStore.deleteItemAsync(`${clave}_${i}`, OPCIONES)),
    ]);
  },
};

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
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      })
    : crearStubSinConfig();
