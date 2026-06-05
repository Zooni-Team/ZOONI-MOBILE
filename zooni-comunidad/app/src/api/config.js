import axios from 'axios';

// Cambiá la IP por tu máquina si corrés en dispositivo físico
// En emulador Android: 10.0.2.2 | En dispositivo: tu IP local
export const BASE_URL = 'http://10.0.2.2:3001/api/v1';

// Token se setea al loguear (usá el mismo JWT de la API C# existente)
let _token = null;

export function setToken(token) {
  _token = token;
}

export const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});
