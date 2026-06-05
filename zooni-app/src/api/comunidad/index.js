/**
 * API Comunidad — conecta con zooni-comunidad/api (Node.js en localhost:3001)
 * Sin autenticación para demo. En producción, usa el JWT del usuario logueado.
 */
import axios from 'axios';
import { Platform } from 'react-native';

// En emulador Android usar 10.0.2.2, en web/dispositivo usar localhost
const BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3001/api/v1'
    : 'http://localhost:3001/api/v1';

const api = axios.create({ baseURL: BASE, timeout: 8000 });

export const fetchMapaData    = (bbox)       => api.get('/comunidad/mapa',     { params: bbox }).then(r => r.data);
export const fetchServicios   = (bbox, tipo) => api.get('/comunidad/servicios', { params: { ...bbox, tipo } }).then(r => r.data);
export const crearCartel      = (fd)         => api.post('/carteles', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const eliminarCartel   = (id)         => api.delete(`/carteles/${id}`).then(r => r.data);
export const fetchAmigos      = ()           => api.get('/amigos').then(r => r.data);
export const fetchSolicitudes = ()           => api.get('/amigos/solicitudes').then(r => r.data);
export const enviarSolicitud  = (id)         => api.post('/amigos/solicitud', { usuario_destino_id: id }).then(r => r.data);
export const responderSolicitud = (id, acc)  => api.patch(`/amigos/solicitud/${id}`, { accion: acc }).then(r => r.data);
export const buscarUsuarios   = (q)          => api.get('/usuarios/buscar', { params: { q } }).then(r => r.data);
export const actualizarUbicacion = (lat,lng) => api.put('/ubicacion', { lat, lng }).then(r => r.data);
