/**
 * src/api/comunidad/amigosApi.js
 *
 * Funciones de acceso a la API REST para la gestión de amigos en la pantalla Comunidad.
 * Todos los endpoints requieren JWT (adjuntado automáticamente por el interceptor
 * de la instancia axios compartida en src/services/api.js).
 *
 * Funciones exportadas:
 *   fetchAmigos()                        — GET  /api/v1/amigos
 *   enviarSolicitud(destinoId)           — POST /api/v1/amigos/solicitud
 *   responderSolicitud(id, accion)       — PATCH /api/v1/amigos/solicitud/:id
 *   buscarUsuarios(q)                    — GET  /api/v1/usuarios/buscar?q=<texto>
 */

import api from '../../services/api';

// ─────────────────────────────────────────────
// AMIGOS
// ─────────────────────────────────────────────

/**
 * Obtiene la lista de amigos confirmados del usuario autenticado.
 *
 * Llama a GET /api/v1/amigos y devuelve un array con los datos de cada amigo:
 * avatar, nombre, nombre de mascota, distancia aproximada y estado online.
 *
 * @returns {Promise<Array<{
 *   usuario_id: string,
 *   nombre: string,
 *   foto_perfil_url: string | null,
 *   mascota_nombre: string | null,
 *   distancia_km: number | null,
 *   online: boolean
 * }>>}
 * @throws {Error} Si la llamada falla (red, autenticación, servidor)
 */
export async function fetchAmigos() {
  const res = await api.get('/amigos');
  return res.data;
}

// ─────────────────────────────────────────────
// SOLICITUDES DE AMISTAD
// ─────────────────────────────────────────────

/**
 * Envía una solicitud de amistad al usuario indicado.
 *
 * Llama a POST /api/v1/amigos/solicitud con el id del usuario destino.
 * Si ya existe una solicitud pendiente o ya son amigos, el backend responde
 * con código 409 — en ese caso se lanza un error con el mensaje del servidor.
 *
 * @param {string} destinoId - ID del usuario al que se envía la solicitud
 * @returns {Promise<{ id: string, estado: string }>} Solicitud creada
 * @throws {Error} Si la llamada falla, incluyendo 409 (ya amigos o solicitud pendiente)
 */
export async function enviarSolicitud(destinoId) {
  try {
    const res = await api.post('/amigos/solicitud', { usuario_destino_id: destinoId });
    return res.data;
  } catch (error) {
    // Propagar el error con el mensaje del backend (incluye el caso 409)
    const mensaje =
      error.response?.data?.error ||
      error.response?.data?.mensaje ||
      error.message;
    throw new Error(mensaje);
  }
}

/**
 * Acepta o rechaza una solicitud de amistad recibida.
 *
 * Llama a PATCH /api/v1/amigos/solicitud/:id con la acción indicada.
 * Solo el destinatario de la solicitud puede responderla.
 *
 * @param {string} id - ID de la solicitud de amistad
 * @param {'aceptar' | 'rechazar'} accion - Acción a realizar sobre la solicitud
 * @returns {Promise<{ id: string, estado: string }>} Solicitud actualizada
 * @throws {Error} Si la llamada falla (red, autenticación, servidor)
 */
export async function responderSolicitud(id, accion) {
  const res = await api.patch(`/amigos/solicitud/${id}`, { accion });
  return res.data;
}

// ─────────────────────────────────────────────
// BÚSQUEDA DE USUARIOS
// ─────────────────────────────────────────────

/**
 * Busca usuarios por nombre o nombre de mascota.
 *
 * Llama a GET /api/v1/usuarios/buscar?q=<texto>. Se recomienda llamar esta
 * función solo cuando `q` tenga al menos 2 caracteres (validar en el componente
 * antes de invocar para evitar llamadas innecesarias).
 *
 * Cada resultado incluye si el usuario ya es amigo del autenticado, para que
 * el componente pueda mostrar `[+ Agregar]` o `[✓ Amigos]` según corresponda.
 *
 * @param {string} q - Texto de búsqueda (mínimo 2 caracteres recomendado)
 * @returns {Promise<Array<{
 *   usuario_id: string,
 *   nombre: string,
 *   foto_perfil_url: string | null,
 *   mascota_nombre: string | null,
 *   barrio: string | null,
 *   es_amigo: boolean
 * }>>}
 * @throws {Error} Si la llamada falla (red, autenticación, servidor)
 */
export async function buscarUsuarios(q) {
  const res = await api.get('/usuarios/buscar', { params: { q } });
  return res.data;
}
