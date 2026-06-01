/**
 * src/api/comunidad/cartelesApi.js
 *
 * Funciones de acceso a la API REST para la gestión de carteles comunitarios.
 * Todos los endpoints requieren JWT (adjuntado automáticamente por el interceptor
 * de la instancia axios compartida en src/services/api.js).
 *
 * Funciones exportadas:
 *   crearCartel(formData)   — POST /api/v1/carteles
 *   eliminarCartel(id)      — DELETE /api/v1/carteles/:id
 */

import api from '../../services/api';

// ─────────────────────────────────────────────
// CARTELES
// ─────────────────────────────────────────────

/**
 * Crea un nuevo cartel comunitario geoposicionado.
 *
 * Llama a POST /api/v1/carteles con los datos del formulario en formato
 * multipart/form-data. El backend inserta el cartel en la tabla `carteles`
 * y, si se adjuntó una foto, la sube al storage y guarda la URL.
 *
 * @param {FormData} formData - Datos del cartel en formato multipart/form-data.
 *   Campos esperados:
 *     - tipo {string}              — 'perdida' | 'encontrada' | 'adopcion' | 'aviso_general'
 *     - telefono_contacto {string} — Teléfono de contacto (requerido)
 *     - lat {number}               — Latitud de la posición seleccionada en el mapa
 *     - lng {number}               — Longitud de la posición seleccionada en el mapa
 *     - mascota_id {string}        — (opcional) ID de la mascota del usuario
 *     - descripcion {string}       — (opcional) Descripción, máximo 300 caracteres
 *     - foto {File}                — (opcional) Imagen JPG/PNG/GIF, máximo 5MB
 * @returns {Promise<Object>} El cartel creado con su id, tipo, ubicación y demás campos
 * @throws {Error} Si la llamada falla (red, autenticación, validación del servidor)
 */
export async function crearCartel(formData) {
  const res = await api.post('/carteles', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return res.data;
}

/**
 * Elimina un cartel propio del mapa (soft delete en el backend).
 *
 * Llama a DELETE /api/v1/carteles/:id. El backend verifica que el cartel
 * pertenezca al usuario autenticado antes de procesar la eliminación.
 * Si el cartel no pertenece al usuario, la API responde con 403.
 *
 * @param {string} id - ID del cartel a eliminar (UUID)
 * @returns {Promise<{ mensaje: string }>} Mensaje de confirmación del backend
 * @throws {Error} Si la llamada falla (red, autenticación, servidor)
 * @throws {Error} Con status 403 si el usuario no tiene permiso para eliminar el cartel
 */
export async function eliminarCartel(id) {
  const res = await api.delete(`/carteles/${id}`);

  return res.data;
}
