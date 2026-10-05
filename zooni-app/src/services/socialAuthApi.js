/**
 * socialAuthApi.js — Entrar / registrarse con Google, Facebook y Apple
 *
 * Flujo (web):
 *   1. iniciarConProveedor('google', 'dueno') guarda la intención (dueño o
 *      paseador) y manda al navegador al login del proveedor.
 *   2. El proveedor vuelve a la app con ?code=… . App.jsx detecta ese retorno
 *      (hayRetornoSocial) y llama a completarRetornoSocial(), que canjea el
 *      código por una sesión de Supabase Auth en el cliente `supabaseSocial`.
 *   3. login_social() (043) busca la cuenta por el mail VERIFICADO del
 *      proveedor (lo lee el servidor, no lo manda la app):
 *        · existe → se inicia la sesión de Zooni como en el login normal
 *        · no existe → { nuevo, perfil } y la app sigue al registro con nombre,
 *          mail y foto ya cargados y sin pedir contraseña.
 *   4. Las altas sociales (registrarSocial… / activarPaseadorSocial) también
 *      van por `supabaseSocial`, que todavía tiene la sesión del proveedor.
 *
 * En la app nativa no está habilitado todavía: necesita expo-web-browser y un
 * "scheme" de deep link para volver del navegador.
 */

import { Platform } from 'react-native';

import { supabaseSocial } from '../lib/supabase';
import { setCurrentUserId } from '../config/session';

export const PROVEEDORES = {
  google: { nombre: 'Google' },
  facebook: { nombre: 'Facebook' },
  apple: { nombre: 'Apple' },
};

const INTENCION_KEY = 'zooni_social_intencion';
export const loginSocialDisponible = Platform.OS === 'web';

function guardarIntencion(valor) {
  try { localStorage.setItem(INTENCION_KEY, JSON.stringify(valor)); } catch { /* noop */ }
}
function leerIntencion() {
  try {
    const raw = localStorage.getItem(INTENCION_KEY);
    localStorage.removeItem(INTENCION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Manda al login del proveedor. `intencion` es 'dueno' o 'paseador': decide a
 * qué registro se sigue si la cuenta es nueva. La página se va: no vuelve acá.
 */
export async function iniciarConProveedor(proveedor, intencion = 'dueno') {
  if (!loginSocialDisponible) throw new Error('social_no_disponible');
  guardarIntencion({ intencion, proveedor });
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabaseSocial.auth.signInWithOAuth({
    provider: proveedor,
    options: {
      redirectTo,
      // Google: dejar elegir la cuenta siempre (si no, entra sola con la última)
      queryParams: proveedor === 'google' ? { prompt: 'select_account' } : undefined,
      scopes: proveedor === 'facebook' ? 'email public_profile' : undefined,
    },
  });
  if (error) {
    leerIntencion();
    throw error;
  }
}

/** ¿La app se está abriendo de vuelta desde Google / Facebook / Apple? */
export function hayRetornoSocial() {
  if (!loginSocialDisponible || typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return q.has('code') || q.has('error') || h.has('error');
}

const MENSAJES_ERROR = {
  sin_email: 'Tu cuenta de ese proveedor no comparte el mail. Probá con otra opción o con tu mail y contraseña.',
  email_no_verificado: 'Ese mail todavía no está verificado en el proveedor. Verificalo e intentá de nuevo.',
  sin_sesion_social: 'Se cortó el inicio de sesión. Probá de nuevo.',
};

function mensajeDe(err) {
  const msg = String(err?.message ?? err ?? '');
  const clave = Object.keys(MENSAJES_ERROR).find((k) => msg.includes(k));
  if (clave) return MENSAJES_ERROR[clave];
  if (/function .*login_social|PGRST202|schema cache/i.test(msg)) {
    return 'Falta preparar la base de datos para el login social (migración 043).';
  }
  return 'No se pudo iniciar sesión con ese proveedor. Probá de nuevo.';
}

/**
 * Termina el retorno del proveedor. Devuelve:
 *   { error }                         — algo falló (mensaje para mostrar)
 *   { usuario, intencion }            — cuenta existente: la sesión ya quedó iniciada
 *   { nuevo: true, perfil, intencion } — no hay cuenta con ese mail: seguir al alta
 */
export async function completarRetornoSocial() {
  const url = new URL(window.location.href);
  const q = url.searchParams;
  const h = new URLSearchParams(url.hash.replace(/^#/, ''));
  const guardada = leerIntencion();
  const intencion = guardada?.intencion ?? 'dueno';
  // Limpiar la URL: que un refresh no intente canjear el mismo código
  window.history.replaceState({}, document.title, `${url.origin}${url.pathname}`);

  const errorProveedor = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error');
  if (errorProveedor) {
    // Cancelar en el proveedor no es un error para mostrar en rojo
    return /cancel|denied/i.test(errorProveedor)
      ? { error: null, intencion }
      : { error: 'El proveedor no permitió el inicio de sesión. Probá de nuevo.', intencion };
  }

  try {
    const { error: errCanje } = await supabaseSocial.auth.exchangeCodeForSession(q.get('code'));
    if (errCanje) throw errCanje;
    const { data, error } = await supabaseSocial.rpc('login_social');
    if (error) throw error;
    if (data?.nuevo) {
      return {
        nuevo: true,
        intencion,
        perfil: {
          email: data.email,
          nombre: data.nombre ?? '',
          apellido: data.apellido ?? '',
          foto: data.foto ?? null,
          proveedor: PROVEEDORES[guardada?.proveedor]?.nombre ?? 'tu cuenta',
        },
      };
    }
    await setCurrentUserId(data.id, data.email);
    return { usuario: data, intencion };
  } catch (err) {
    console.error('[Login social]', err?.message ?? err);
    cerrarSesionSocial();
    return { error: mensajeDe(err), intencion };
  }
}

/** Llamada a una RPC del alta social (necesita la sesión del proveedor). */
export async function rpcSocial(nombre, params) {
  const { data, error } = await supabaseSocial.rpc(nombre, params);
  if (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('sin_sesion_social') || /JWT|token/i.test(msg)) throw new Error('sesion_social_vencida');
    throw error;
  }
  return data;
}

/** Corta la sesión del proveedor (al cerrar sesión en Zooni o si algo falló). */
export function cerrarSesionSocial() {
  return supabaseSocial.auth.signOut({ scope: 'local' }).catch(() => {});
}
