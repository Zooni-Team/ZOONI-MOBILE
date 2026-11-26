import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from '@babel/core';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function archivosDe(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return archivosDe(ruta);
    return /\.jsx?$/.test(e.name) ? [ruta] : [];
  });
}

function resolver(desde, especificador) {
  const base = path.resolve(path.dirname(desde), especificador);
  return [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js')]
    .find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const cache = new Map();
function analizar(archivo) {
  if (cache.has(archivo)) return cache.get(archivo);
  const info = { nombres: new Set(), estrellas: [], imports: [] };
  cache.set(archivo, info);
  const ast = parseSync(readFileSync(archivo, 'utf8'), {
    filename: archivo, babelrc: false, configFile: false,
    parserOpts: { sourceType: 'module', plugins: ['jsx'] },
  });
  for (const nodo of ast.program.body) {
    if (nodo.type === 'ImportDeclaration' && nodo.source.value.startsWith('.')) {
      const pedidos = nodo.specifiers.filter((s) => s.type === 'ImportSpecifier').map((s) => s.imported.name);
      const quiereDefault = nodo.specifiers.some((s) => s.type === 'ImportDefaultSpecifier');
      info.imports.push({ de: nodo.source.value, pedidos, quiereDefault, linea: nodo.loc.start.line });
    } else if (nodo.type === 'ExportAllDeclaration') {
      info.estrellas.push(nodo.source.value);
    } else if (nodo.type === 'ExportDefaultDeclaration') {
      info.nombres.add('default');
    } else if (nodo.type === 'ExportNamedDeclaration') {
      nodo.specifiers.forEach((s) => info.nombres.add(s.exported.name));
      const d = nodo.declaration;
      if (d?.id) info.nombres.add(d.id.name);
      d?.declarations?.forEach((v) => {
        if (v.id.type === 'Identifier') info.nombres.add(v.id.name);
        if (v.id.type === 'ObjectPattern') v.id.properties.forEach((p) => info.nombres.add((p.value ?? p.argument).name));
      });
    }
  }
  return info;
}

function exporta(archivo, nombre, vistos = new Set()) {
  if (vistos.has(archivo)) return false;
  vistos.add(archivo);
  const info = analizar(archivo);
  if (info.nombres.has(nombre)) return true;
  return info.estrellas.some((e) => {
    const destino = resolver(archivo, e);
    return destino && exporta(destino, nombre, vistos);
  });
}

test('cada import con nombre existe en el módulo de origen', () => {
  const archivos = [...archivosDe(path.join(raiz, 'src')), path.join(raiz, 'App.jsx')];
  const rotos = [];
  for (const archivo of archivos) {
    for (const imp of analizar(archivo).imports) {
      const destino = resolver(archivo, imp.de);
      const donde = `${path.relative(raiz, archivo)}:${imp.linea}`;
      if (!destino) {
        if (!/\.(png|jpe?g|gif|svg|json|ttf|otf)$/.test(imp.de)) rotos.push(`${donde} → no existe '${imp.de}'`);
        continue;
      }
      if (!/\.jsx?$/.test(destino)) continue;
      if (imp.quiereDefault && !exporta(destino, 'default')) rotos.push(`${donde} → '${imp.de}' no tiene export default`);
      imp.pedidos.filter((n) => !exporta(destino, n)).forEach((n) => rotos.push(`${donde} → '${imp.de}' no exporta ${n}`));
    }
  }
  assert.deepEqual(rotos, []);
});

test('sólo services/ (y config/session) habla con Supabase', () => {
  const permitidos = /^src\/(services|lib|config)\//;
  const archivos = [...archivosDe(path.join(raiz, 'src')), path.join(raiz, 'App.jsx')];
  const directos = archivos
    .map((a) => path.relative(raiz, a).split(path.sep).join('/'))
    .filter((rel) => !permitidos.test(rel))
    .filter((rel) => analizar(path.join(raiz, rel)).imports.some((i) => /\/lib\/supabase$/.test(i.de)));
  assert.deepEqual(directos, []);
});
