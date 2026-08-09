/**
 * groq.js — Configuración de acceso a la API de Groq para ZooniVet.
 *
 * La key se lee del .env. En Expo, para que una variable llegue al bundle del
 * cliente en tiempo de ejecución tiene que estar prefijada con EXPO_PUBLIC_,
 * así que se acepta tanto EXPO_PUBLIC_GROQ_API_KEY (la que funciona en la app)
 * como GROQ_API_KEY a secas (por si el bundler la expone). Poné en zooni-app/.env:
 *
 *   EXPO_PUBLIC_GROQ_API_KEY=gsk_...
 *   EXPO_PUBLIC_GROQ_MODEL=openai/gpt-oss-120b   (opcional)
 *
 * NOTA DE SEGURIDAD: el prompt de ZooniVet recomienda que la key viva como
 * secret de una Edge Function y nunca toque el cliente. Este proyecto todavía
 * no tiene ese backend, así que —por pedido explícito— la llamada se hace desde
 * el cliente con la key del .env. Cuando exista la Edge Function, mover la
 * llamada de zoonivetApi.js allá y borrar la key del .env del cliente.
 */

export const GROQ_API_KEY =
  process.env.EXPO_PUBLIC_GROQ_API_KEY ?? process.env.GROQ_API_KEY ?? null;

// El identificador del modelo va en env para poder cambiarlo ante una
// deprecación de Groq sin publicar una versión nueva de la app.
export const GROQ_MODEL =
  process.env.EXPO_PUBLIC_GROQ_MODEL ??
  process.env.GROQ_MODEL ??
  'openai/gpt-oss-120b';

// Modelo de respaldo: si el principal devuelve model_not_found (400), se
// reintenta con este en vez de dejar el chat caído.
export const GROQ_MODEL_FALLBACK =
  process.env.EXPO_PUBLIC_GROQ_MODEL_FALLBACK ??
  process.env.GROQ_MODEL_FALLBACK ??
  'openai/gpt-oss-20b';

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** true si hay key configurada; la pantalla lo usa para mostrar un aviso claro. */
export function groqDisponible() {
  return typeof GROQ_API_KEY === 'string' && GROQ_API_KEY.length > 0;
}
