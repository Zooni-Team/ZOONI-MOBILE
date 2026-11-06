// Doble del cliente de Supabase. Cada test programa las respuestas:
//
//   import { fake } from './dobles/supabase.mjs';
//   fake.reiniciar();
//   fake.responder((op) => op.tabla === 'User' ? { data: [...] } : {});
//   fake.rpc('votar_mascota', { data: { match: true } });
//   ... llamar al servicio ...
//   fake.llamadas  → [{ tipo: 'tabla'|'rpc'|'auth'|'funcion', ... }]

const estado = {
  responder: () => ({ data: null, error: null }),
  rpcs: new Map(),
  auth: {},
  funciones: new Map(),
  llamadas: [],
  sesion: null,
};

export const fake = {
  get llamadas() { return estado.llamadas; },
  reiniciar() {
    estado.responder = () => ({ data: null, error: null });
    estado.rpcs = new Map(); estado.auth = {}; estado.funciones = new Map();
    estado.llamadas = []; estado.sesion = null;
  },
  responder(fn) { estado.responder = fn; },
  rpc(nombre, respuesta) { estado.rpcs.set(nombre, respuesta); },
  auth(metodo, respuesta) { estado.auth[metodo] = respuesta; },
  funcion(nombre, respuesta) { estado.funciones.set(nombre, respuesta); },
  sesion(s) { estado.sesion = s; },
  de(tipo) { return estado.llamadas.filter((l) => l.tipo === tipo); },
};

const resolver = (r, ctx) => Promise.resolve(typeof r === 'function' ? r(ctx) : r ?? { data: null, error: null });

function consulta(tabla) {
  const op = { tipo: 'tabla', tabla, accion: 'select', filtros: [], datos: null, columnas: null };
  estado.llamadas.push(op);
  const cadena = new Proxy({}, {
    get(_, prop) {
      if (prop === 'then') return (ok, mal) => resolver(estado.responder(op) ?? {}, op).then(ok, mal);
      return (...args) => {
        if (['select', 'insert', 'update', 'upsert', 'delete'].includes(prop)) {
          if (prop === 'select' && op.accion !== 'select') op.devolver = args[0];
          else { op.accion = prop; if (prop === 'select') op.columnas = args[0]; else op.datos = args[0]; }
        } else op.filtros.push([prop, ...args]);
        return cadena;
      };
    },
  });
  return cadena;
}

export const supabase = {
  from: consulta,
  rpc(nombre, params) {
    const op = { tipo: 'rpc', nombre, params };
    estado.llamadas.push(op);
    return resolver(estado.rpcs.get(nombre) ?? { data: null, error: { code: 'PGRST202', message: `function ${nombre} does not exist` } }, op);
  },
  auth: new Proxy({}, {
    get(_, metodo) {
      return (...args) => {
        estado.llamadas.push({ tipo: 'auth', metodo, args });
        if (metodo === 'getSession') return Promise.resolve({ data: { session: estado.sesion } });
        if (metodo === 'onAuthStateChange') return { data: { subscription: { unsubscribe() {} } } };
        return resolver(estado.auth[metodo] ?? { data: {}, error: null }, args[0]);
      };
    },
  }),
  functions: {
    invoke(nombre, opciones) {
      const op = { tipo: 'funcion', nombre, body: opciones?.body };
      estado.llamadas.push(op);
      return resolver(estado.funciones.get(nombre) ?? { data: null, error: { name: 'FunctionsHttpError', context: { status: 404, json: async () => ({}) } } }, op);
    },
  },
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
};

export default { supabase };
