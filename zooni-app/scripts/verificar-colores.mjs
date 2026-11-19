#!/usr/bin/env node
// verificar-colores.mjs — Ningún color de la paleta escrito a mano (npm test).
//
// Si un hex de src/theme/colores.js aparece literal en otro archivo, cambiar
// el color de la marca deja de ser cambiar UNA línea: falla y dice dónde.
// También frena los grises que se unificaron (si alguien los vuelve a pegar).
// Los colores que NO están en la paleta (tonos de una sola pantalla) se permiten.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { COLOR_POR_HEX } = await import(pathToFileURL(path.join(raiz, 'src/theme/colores.js')).href);

// Grises que existían antes de la escala corta → a cuál se unificaron.
const GRISES_VIEJOS = {
  '#F2F2F2': 'gris100', '#F1F1F1': 'gris100', '#EFEFEF': 'gris100', '#EEEEEE': 'gris100',
  '#E6E6E6': 'gris200', '#E0E0E0': 'gris300',
};

const archivos = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const ruta = path.join(dir, e.name);
  if (e.isDirectory()) return archivos(ruta);
  return /\.jsx?$/.test(e.name) ? [ruta] : [];
});

const problemas = [];
for (const archivo of [...archivos(path.join(raiz, 'src')), path.join(raiz, 'App.jsx')]) {
  if (archivo.endsWith(path.join('theme', 'colores.js'))) continue;
  readFileSync(archivo, 'utf8').split('\n').forEach((linea, i) => {
    // Los comentarios pueden nombrar un hex (por qué se eligió un color, su contraste).
    if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;
    for (const [hex] of linea.matchAll(/#[0-9A-Fa-f]{6}\b/g)) {
      const nombre = COLOR_POR_HEX[hex.toUpperCase()] ?? GRISES_VIEJOS[hex.toUpperCase()];
      if (nombre) problemas.push(`${path.relative(raiz, archivo)}:${i + 1}  ${hex} → colores.${nombre}`);
    }
  });
}

if (problemas.length) {
  console.error(`✗ ${problemas.length} colores de la paleta escritos a mano:\n  ${problemas.join('\n  ')}`);
  process.exit(1);
}
console.log('✓ colores: ningún hex de la paleta escrito a mano');
