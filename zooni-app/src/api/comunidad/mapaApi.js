/**
 * src/api/comunidad/mapaApi.js
 *
 * Funciones de acceso a la API REST para el mapa de la pantalla Comunidad.
 * Todos los endpoints requieren JWT (adjuntado automáticamente por el interceptor
 * de la instancia axios compartida en src/services/api.js).
 *
 * Funciones exportadas:
 *   fetchMapaData(bbox)          — GET /api/v1/comunidad/mapa
 *   fetchServicios(bbox, tipo)   — GET /api/v1/comunidad/servicios
 */

import api from '../../services/api';

// ─────────────────────────────────────────────
// MAPA
// ─────────────────────────────────────────────

/**
 * Obtiene los markers del área visible del mapa: servicios, carteles y amigos.
 *
 * Llama a GET /api/v1/comunidad/mapa con los parámetros del bounding box.
 * El backend filtra automáticamente las ubicaciones de amigos según privacidad
 * y devuelve un máximo de 50 markers priorizados por distancia al centro.
 *
 * @param {Object} bbox - Rectángulo de coordenadas del área visible
 * @param {number} bbox.lat_min - Latitud mínima (sur)
 * @param {number} bbox.lat_max - Latitud máxima (norte)
 * @param {number} bbox.lng_min - Longitud mínima (oeste)
 * @param {number} bbox.lng_max - Longitud máxima (este)
 * @returns {Promise<{ servicios: Array, carteles: Array, amigos: Array }>}
 * @throws {Error} Si la llamada falla (red, autenticación, servidor)
 */
export async function fetchMapaData(bbox) {
  const { lat_min, lat_max, lng_min, lng_max } = bbox;

  const res = await api.get('/comunidad/mapa', {
    params: { lat_min, lat_max, lng_min, lng_max },
  });

  return res.data;
}

// ─────────────────────────────────────────────
// SERVICIOS
// ─────────────────────────────────────────────

/**
 * Obtiene la lista de servicios para mascotas dentro del área visible del mapa.
 *
 * Llama a GET /api/v1/comunidad/servicios con el bounding box y un filtro
 * opcional por tipo de servicio. Si `tipo` es null o undefined, el backend
 * devuelve todos los tipos.
 *
 * @param {Object} bbox - Rectángulo de coordenadas del área visible
 * @param {number} bbox.lat_min - Latitud mínima (sur)
 * @param {number} bbox.lat_max - Latitud máxima (norte)
 * @param {number} bbox.lng_min - Longitud mínima (oeste)
 * @param {number} bbox.lng_max - Longitud máxima (este)
 * @param {string|null} [tipo=null] - Filtro por tipo: 'veterinaria' | 'paseador' | 'petshop' | 'peluqueria' | null
 * @returns {Promise<Array>} Lista de servicios en el área
 * @throws {Error} Si la llamada falla (red, autenticación, servidor)
 */
export async function fetchServicios(bbox, tipo = null) {
  const { lat_min, lat_max, lng_min, lng_max } = bbox;

  const params = { lat_min, lat_max, lng_min, lng_max };

  // Solo incluir el parámetro tipo si se especificó un filtro
  if (tipo) {
    params.tipo = tipo;
  }

  const res = await api.get('/comunidad/servicios', { params });

  return res.data;
}
