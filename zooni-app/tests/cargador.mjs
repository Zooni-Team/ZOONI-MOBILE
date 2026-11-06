// cargador.mjs — Hooks de módulos para correr el código de la app con Node puro.
//
//   node --import ./tests/registrar.mjs --test tests/
//
// 1. Resuelve imports sin extensión como lo hace Metro ('../lib/supabase' →
//    '../lib/supabase.js', '../theme' → '../theme/index.js').
// 2. Reemplaza lo que sólo existe en el teléfono por dobles de prueba
//    (tests/dobles/): React Native, SecureStore, expo-crypto, el cliente de
//    Supabase y las imágenes (require de .png).

import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doble = (nombre) => pathToFileURL(path.join(raiz, 'tests', 'dobles', nombre)).href;

const PAQUETES = {
  'react-native': doble('react-native.mjs'),
  'expo-secure-store': doble('secure-store.mjs'),
  'expo-crypto': doble('expo-crypto.mjs'),
  '@expo/vector-icons': doble('vacio.mjs'),
};
// Módulos de la app que se reemplazan enteros (por ruta, sin extensión)
const MODULOS = {
  'src/lib/supabase': doble('supabase.mjs'),
  'src/constants/petImages': doble('pet-images.mjs'),
};

function candidatos(base) {
  return [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')];
}

export async function resolve(especificador, contexto, siguiente) {
  if (PAQUETES[especificador]) return { url: PAQUETES[especificador], shortCircuit: true };
  if (especificador.startsWith('.') && contexto.parentURL?.startsWith('file:')) {
    const base = path.resolve(path.dirname(fileURLToPath(contexto.parentURL)), especificador);
    const rel = path.relative(raiz, base).split(path.sep).join('/').replace(/\.jsx?$/, '');
    if (MODULOS[rel]) return { url: MODULOS[rel], shortCircuit: true };
    const real = candidatos(base).find((c) => existsSync(c) && statSync(c).isFile());
    if (real) return { url: pathToFileURL(real).href, shortCircuit: true, format: 'module' };
  }
  return siguiente(especificador, contexto);
}

export async function load(url, contexto, siguiente) {
  if (url.startsWith('file:') && /\/src\/.*\.jsx?$/.test(url)) {
    return { ...(await siguiente(url, { ...contexto, format: 'module' })), format: 'module' };
  }
  return siguiente(url, contexto);
}
