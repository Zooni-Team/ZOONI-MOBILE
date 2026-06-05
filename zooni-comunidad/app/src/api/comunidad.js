import { api } from './config';

// ─── Mapa ──────────────────────────────────────────────────────────────────
export const fetchMapaData = (bbox) =>
  api.get('/comunidad/mapa', { params: bbox }).then((r) => r.data);

export const fetchServicios = (bbox, tipo) =>
  api.get('/comunidad/servicios', { params: { ...bbox, tipo } }).then((r) => r.data);

// ─── Carteles ─────────────────────────────────────────────────────────────
export const crearCartel = (formData) =>
  api.post('/carteles', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const eliminarCartel = (id) =>
  api.delete(`/carteles/${id}`).then((r) => r.data);

// ─── Amigos ───────────────────────────────────────────────────────────────
export const fetchAmigos = () =>
  api.get('/amigos').then((r) => r.data);

export const fetchSolicitudes = () =>
  api.get('/amigos/solicitudes').then((r) => r.data);

export const enviarSolicitud = (destinoId) =>
  api.post('/amigos/solicitud', { usuario_destino_id: destinoId }).then((r) => r.data);

export const responderSolicitud = (id, accion) =>
  api.patch(`/amigos/solicitud/${id}`, { accion }).then((r) => r.data);

// ─── Usuarios ─────────────────────────────────────────────────────────────
export const buscarUsuarios = (q) =>
  api.get('/usuarios/buscar', { params: { q } }).then((r) => r.data);

// ─── Ubicación ────────────────────────────────────────────────────────────
export const actualizarUbicacion = (lat, lng) =>
  api.put('/ubicacion', { lat, lng }).then((r) => r.data);
