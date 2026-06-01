/**
 * src/api/comunidad/ubicacionApi.js
 *
 * Funciones de acceso a la API REST para la ubicación del usuario en la
 * pantalla Comunidad.
 * Todos los endpoints requieren JWT (adjuntado automáticamente por el interceptor
 * de la instancia axios compartida en src/services/api.js).
 *
 * Funciones exportadas:
 *   actualizarUbicacion(lat, lng)  — PUT /api/v1/ubicacion
 */

import api from '../../services/api';

// ─────────────────────────────────────────────
// UBICACIÓN
// ─────────────────────────────────────────────

/**
 * Envía la ubicación actual del usuario al servidor para mantenerla actualizada.
 *
 * Llama a PUT /api/v1/ubicacion con las coordenadas del usuario.
 * El backend actualiza la tabla `ubicaciones_usuarios` de forma asíncrona.
 * Esta función solo debe invocarse cuando `compartir_ubicacion` es true;
 * esa verificación es responsabilidad del hook de polling que la llama.
 *
 * @param {number} lat - Latitud actual del usuario
 * @param {number} lng - Longitud actual del usuario
 * @returns {Promise<void>}
 * @throws {Error} Si la llamada falla (red, autenticación, servidor)
 */
export async function actualizarUbicacion(lat, lng) {
  await api.put('/ubicacion', { lat, lng });
}
