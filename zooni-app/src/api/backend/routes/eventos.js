/**
 * eventos.js — API calls para el Calendario de Cuidados
 *
 * Todos los endpoints apuntan a /api/v1/mascotas/:petId/eventos
 * El token JWT se adjunta automáticamente via interceptor en api.js
 */

import api from '../../../services/api';

/**
 * GET /api/v1/mascotas/:petId/eventos
 * Trae todos los eventos del calendario de la mascota, ordenados por fecha ASC.
 * @param {number} petId
 * @returns {Promise<Array>} Array de eventos
 */
export async function fetchEventos(petId) {
  const res = await api.get(`/mascotas/${petId}/eventos`);
  return res.data.eventos;
}

/**
 * POST /api/v1/mascotas/:petId/eventos
 * Crea un nuevo evento en el calendario.
 * @param {number} petId
 * @param {{ titulo, descripcion, fecha_hora, tipo }} body
 * @returns {Promise<Object>} Evento creado
 */
export async function createEvento(petId, body) {
  const res = await api.post(`/mascotas/${petId}/eventos`, body);
  return res.data.evento;
}

/**
 * PUT /api/v1/mascotas/:petId/eventos/:eventoId
 * Actualiza un evento existente.
 * @param {number} petId
 * @param {number} eventoId
 * @param {{ titulo, descripcion, fecha_hora, tipo }} body
 * @returns {Promise<Object>} Evento actualizado
 */
export async function updateEvento(petId, eventoId, body) {
  const res = await api.put(`/mascotas/${petId}/eventos/${eventoId}`, body);
  return res.data.evento;
}

/**
 * DELETE /api/v1/mascotas/:petId/eventos/:eventoId
 * Elimina un evento del calendario.
 * @param {number} petId
 * @param {number} eventoId
 * @returns {Promise<void>}
 */
export async function deleteEvento(petId, eventoId) {
  await api.delete(`/mascotas/${petId}/eventos/${eventoId}`);
}
