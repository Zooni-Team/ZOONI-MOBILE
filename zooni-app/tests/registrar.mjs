import { register } from 'node:module';
register('./cargador.mjs', import.meta.url);

// En "web" la app guarda preferencias en localStorage: uno en memoria.
const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
  clear: () => memoria.clear(),
};
