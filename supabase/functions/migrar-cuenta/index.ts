// supabase/functions/migrar-cuenta/index.ts
//
// Pasa una cuenta VIEJA (contraseña guardada como SHA-256 en user_credentials)
// a Supabase Auth, la primera vez que la persona entra después del cambio.
//
// Por qué hace falta: antes de 060_auth_supabase.sql la app guardaba
// sha256(contraseña) sin sal. No se puede "convertir" ese hash a bcrypt sin
// conocer la contraseña, así que se aprovecha el momento del login, que es el
// único en que el servidor la ve:
//
//   1. La app intenta supabase.auth.signInWithPassword → falla (no hay usuario
//      de Auth todavía) → llama a esta función con { email, password } por HTTPS.
//   2. Acá se compara sha256(password) con el hash viejo, en tiempo constante.
//   3. Si coincide: se crea el usuario de Supabase Auth con ESA contraseña
//      (Auth la guarda con bcrypt), se vincula "User".auth_id y se BORRA el
//      hash viejo.
//   4. La app vuelve a llamar a signInWithPassword, que ahora funciona.
//
// Si ya existía un usuario de Auth con ese mail que NO está vinculado a la
// cuenta (alguien hizo signUp con un mail ajeno) y NO tiene ningún proveedor
// OAuth vinculado, se borra y se crea de nuevo. Si tiene un proveedor OAuth
// vinculado (Google/Facebook), NO se borra (sería tirar una cuenta real de
// otra persona): se corta la migración con error.
//
// Respuesta: siempre 200 { migrada: boolean } salvo errores del servidor. No
// distingue "no existe el mail" de "contraseña incorrecta" en el cuerpo de la
// respuesta; el único canal que podría filtrar eso es el tiempo, por lo que
// SIEMPRE se calcula un hash (real o de relleno) antes de responder.
//
// Límite de intentos: por IP y por mail, con demora creciente (igual que un
// rate-limit de login). Se guarda en la tabla `migracion_intentos` (ver
// sección 070 de SUPABASE_PEGAR_TODO.sql). Pasado el máximo, 429.
//
// Apagado automático: cuando ya no queda ninguna fila en `user_credentials`
// (todas las cuentas viejas migraron), esta función no tiene más trabajo que
// hacer y devuelve 410 Gone. En ese momento conviene borrarla del proyecto
// (ver faltaporhacer.md).
//
// Secrets: ninguno propio. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta
// la plataforma. ALLOWED_ORIGINS (opcional): orígenes separados por coma desde
// los que se puede llamar esta función (si no se define, sólo responde sin
// cabecera CORS, lo que bloquea los navegadores pero no a `curl`: el límite de
// intentos es la defensa real). Desplegar con --no-verify-jwt (se llama SIN
// sesión): supabase functions deploy migrar-cuenta --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const MAX_BODY_BYTES = 4 * 1024; // { email, password } nunca necesita más que esto

function corsHeaders(origin: string | null) {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compara sin cortar en la primera diferencia (no filtra info por tiempo). */
function igualesTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Hash de relleno: así el tiempo de respuesta es parecido exista o no el mail
// con cuenta vieja (mitiga #91 del informe de seguridad).
const HASH_RELLENO = "0".repeat(64);

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) return json({ error: "BAD_REQUEST" }, 413, origin);

  let email = "";
  let password = "";
  try {
    const texto = await req.text();
    if (texto.length > MAX_BODY_BYTES) return json({ error: "BAD_REQUEST" }, 413, origin);
    const body = JSON.parse(texto);
    email = String(body?.email ?? "").trim().toLowerCase();
    password = String(body?.password ?? "");
  } catch {
    return json({ error: "BAD_REQUEST" }, 400, origin);
  }
  if (!email.includes("@") || password.length < 1 || password.length > 200) {
    return json({ migrada: false }, 200, origin);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Apagado automático: si ya no quedan cuentas viejas, esta función no hace
  // nada más (ver faltaporhacer.md: borrarla del proyecto en ese momento).
  const { count: pendientes } = await admin
    .from("user_credentials")
    .select("id_user", { count: "exact", head: true });
  if (!pendientes) return json({ error: "FUNCION_DESACTIVADA" }, 410, origin);

  // Límite de intentos por IP y por mail, con demora creciente.
  const ip = getClientIp(req);
  const { data: intento, error: errIntento } = await admin.rpc("_registrar_intento_migracion", {
    p_ip: ip,
    p_mail: email,
  });
  if (errIntento) return json({ error: "SERVER_ERROR" }, 500, origin);
  if (intento?.[0]?.bloqueado) {
    return json(
      { error: "DEMASIADOS_INTENTOS", reintentarEnSeg: intento[0].espera_seg },
      429,
      origin,
    );
  }

  const { data: filas, error } = await admin.rpc("_credencial_legada", { p_mail: email });
  if (error) return json({ error: "SERVER_ERROR" }, 500, origin);
  const cred = filas?.[0];

  // Siempre se calcula un hash (real o de relleno) antes de responder: el
  // tiempo de respuesta no debe delatar si el mail tiene cuenta vieja.
  const hashEsperado = cred && !cred.auth_id ? String(cred.hash) : HASH_RELLENO;
  const ok = igualesTiempoConstante(await sha256Hex(password), hashEsperado);
  if (!cred || cred.auth_id || !ok) return json({ migrada: false }, 200, origin);

  // ¿Ya hay un usuario de Auth con ese mail sin vincular?
  const { data: existente } = await admin.rpc("_auth_id_por_mail", { p_mail: email });
  if (existente) {
    const { data: usuarioExistente } = await admin.auth.admin.getUserById(existente);
    const tieneOAuth = (usuarioExistente?.user?.identities ?? []).some(
      (i) => i.provider !== "email",
    );
    if (tieneOAuth) {
      // No se borra una cuenta real de otra persona vinculada a Google/Facebook.
      return json({ error: "MAIL_EN_USO" }, 409, origin);
    }
    await admin.auth.admin.deleteUser(existente);
  }

  // La contraseña vieja puede no cumplir la política actual (desde 1 carácter):
  // igual se migra (si no, la cuenta queda sin poder entrar), pero se marca
  // para que la app fuerce un cambio de contraseña en el próximo login.
  const cumplePolitica = password.length >= 8;

  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: cumplePolitica ? {} : { debe_cambiar_contrasena: true },
  });
  if (errCrear || !creado?.user) return json({ error: "SERVER_ERROR" }, 500, origin);

  const { error: errVincular } = await admin.rpc("_completar_migracion_cuenta", {
    p_id_user: cred.id_user,
    p_auth_id: creado.user.id,
  });
  if (errVincular) {
    // Compensar: si no se pudo vincular, no dejar un usuario de Auth huérfano.
    await admin.auth.admin.deleteUser(creado.user.id);
    return json({ error: "SERVER_ERROR" }, 500, origin);
  }

  return json({ migrada: true, debeCambiarContrasena: !cumplePolitica }, 200, origin);
});
