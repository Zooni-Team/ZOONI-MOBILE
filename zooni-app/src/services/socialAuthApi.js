import { Platform } from 'react-native';

import { supabase } from '../lib/supabase';
import { setCurrentUserId } from '../config/session';
import { subirImagenPublica } from './imagenStorage';

export const PROVEEDORES = {
  google: { nombre: 'Google' },
  facebook: { nombre: 'Facebook' },
};

const INTENCION_KEY = 'zooni_social_intencion';
export const loginSocialDisponible = Platform.OS === 'web';

function guardarIntencion(valor) {
  try { localStorage.setItem(INTENCION_KEY, JSON.stringify(valor)); } catch {  }
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

async function proveedorHabilitado(proveedor) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!res.ok) return null;
    const settings = await res.json();
    return settings?.external?.[proveedor] ?? null;
  } catch {
    return null;
  }
}

export async function iniciarConProveedor(proveedor, intencion = 'dueno') {
  if (!loginSocialDisponible) throw new Error('social_no_disponible');
  if (await proveedorHabilitado(proveedor) === false) throw new Error('provider is not enabled');
  guardarIntencion({ intencion, proveedor });
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: proveedor,
    options: {
      redirectTo,
      queryParams: proveedor === 'google' ? { prompt: 'select_account' } : undefined,
    },
  });
  if (error) {
    leerIntencion();
    throw error;
  }
}

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

async function copiarFotoSocial(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    const dataUri = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = reject;
      lector.readAsDataURL(blob);
    });
    return await subirImagenPublica(dataUri, 'perfiles');
  } catch {
    return url;
  }
}

function mensajeDe(err) {
  const msg = String(err?.message ?? err ?? '');
  const clave = Object.keys(MENSAJES_ERROR).find((k) => msg.includes(k));
  if (clave) return MENSAJES_ERROR[clave];
  if (/function .*login_social|PGRST202|schema cache/i.test(msg)) {
    return 'Falta preparar la base de datos para el login social (migración 043).';
  }
  return 'No se pudo iniciar sesión con ese proveedor. Probá de nuevo.';
}

export async function completarRetornoSocial() {
  const url = new URL(window.location.href);
  const q = url.searchParams;
  const h = new URLSearchParams(url.hash.replace(/^#/, ''));
  const guardada = leerIntencion();
  const intencion = guardada?.intencion ?? 'dueno';
  window.history.replaceState({}, document.title, `${url.origin}${url.pathname}`);

  const errorProveedor = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error');
  if (errorProveedor) {
    if (__DEV__) console.error('[Login social] el proveedor volvió con error:', errorProveedor);
    if (/cancel|denied/i.test(errorProveedor)) return { error: null, intencion };
    if (/email/i.test(errorProveedor)) return { error: MENSAJES_ERROR.sin_email, intencion };
    return { error: 'El proveedor no permitió el inicio de sesión. Probá de nuevo.', intencion };
  }

  try {
    const { error: errCanje } = await supabase.auth.exchangeCodeForSession(q.get('code'));
    if (errCanje) throw errCanje;
    const { data, error } = await supabase.rpc('login_social');
    if (error) throw error;
    if (data?.nuevo) {
      return {
        nuevo: true,
        intencion,
        perfil: {
          email: data.email,
          nombre: data.nombre ?? '',
          apellido: data.apellido ?? '',
          foto: await copiarFotoSocial(data.foto),
          proveedor: PROVEEDORES[guardada?.proveedor]?.nombre ?? 'tu cuenta',
        },
      };
    }
    await setCurrentUserId(data.id, data.email);
    return { usuario: data, intencion };
  } catch (err) {
    if (__DEV__) console.error('[Login social]', err?.message ?? err);
    cerrarSesionSocial();
    return { error: mensajeDe(err), intencion };
  }
}

export async function rpcSocial(nombre, params) {
  const { data, error } = await supabase.rpc(nombre, params);
  if (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('sin_sesion_social') || /JWT|token/i.test(msg)) throw new Error('sesion_social_vencida');
    throw error;
  }
  return data;
}

export function cerrarSesionSocial() {
  return supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
