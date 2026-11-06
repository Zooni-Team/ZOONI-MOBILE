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
// cuenta (alguien hizo signUp con un mail ajeno), se borra y se crea de nuevo:
// así cualquier sesión que tuviera ese intruso deja de servir.
//
// Respuesta: siempre 200 { migrada: boolean } salvo errores del servidor. No
// distingue "no existe el mail" de "contraseña incorrecta".
//
// Secrets: ninguno propio. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta
// la plataforma. Desplegar con --no-verify-jwt (se llama SIN sesión):
//   supabase functions deploy migrar-cuenta --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let email = "";
  let password = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
    password = String(body?.password ?? "");
  } catch {
    return json({ error: "BAD_REQUEST" }, 400);
  }
  if (!email.includes("@") || password.length < 1 || password.length > 200) {
    return json({ migrada: false });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: filas, error } = await admin.rpc("_credencial_legada", { p_mail: email });
  if (error) return json({ error: "SERVER_ERROR" }, 500);
  const cred = filas?.[0];
  if (!cred || cred.auth_id) return json({ migrada: false });

  const ok = igualesTiempoConstante(await sha256Hex(password), String(cred.hash));
  if (!ok) return json({ migrada: false });

  // ¿Ya hay un usuario de Auth con ese mail sin vincular? Fuera.
  const { data: existente } = await admin.rpc("_auth_id_por_mail", { p_mail: email });
  if (existente) await admin.auth.admin.deleteUser(existente);

  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (errCrear || !creado?.user) return json({ error: "SERVER_ERROR" }, 500);

  const { error: errVincular } = await admin.rpc("_completar_migracion_cuenta", {
    p_id_user: cred.id_user,
    p_auth_id: creado.user.id,
  });
  if (errVincular) return json({ error: "SERVER_ERROR" }, 500);

  return json({ migrada: true });
});
