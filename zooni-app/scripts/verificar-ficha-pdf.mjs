/**
 * verificar-ficha-pdf.mjs — Comprobación de la ficha médica en PDF
 *
 *   npm run verify:pdf     (desde zooni-app/)
 *
 * POR QUÉ EXISTE
 * La generación del PDF vivía dentro de FichaMedicaScreen, donde la única forma
 * de probarla era abrir la app y descargar el archivo. Por eso pasó inadvertido
 * durante mucho tiempo que el documento salía INCOMPLETO: cortaba secciones al
 * pasar de página y se comía registros que el usuario sí había cargado.
 *
 * Con la lógica separada en utils/fichaPdf.js se puede renderizar el documento
 * acá, en Node, y comprobar de punta a punta que TODOS los registros aparecen —
 * no en el modelo, sino en el texto realmente dibujado dentro del PDF, que se
 * extrae de los streams del archivo generado.
 *
 * No usa ningún framework de test (el proyecto no tiene runner configurado) ni
 * agrega dependencias: jspdf ya está instalado porque lo usa la app en web.
 * Sale con código 1 si algo falla, así que sirve en CI tal cual está.
 */

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const raizApp = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// jspdf trae una build específica para Node (la del navegador necesita window).
const { jsPDF } = require(path.join(raizApp, 'node_modules/jspdf/dist/jspdf.node.min.js'));
// pathToFileURL y no un string armado a mano: en Windows la ruta es C:\... y
// sin convertir a URL el import falla ("is not a valid package name").
const { construirSecciones, construirDocPdf, construirHtmlFicha, nombreArchivo, numeroDocumento } =
  await import(pathToFileURL(path.join(raizApp, 'src/utils/fichaPdf.js')).href);

// Datos con MUCHOS registros: el bug original era que el documento cortaba
// secciones al pasar de página.
const vacunas = Array.from({ length: 9 }, (_, i) => ({
  nombre: `Vacuna ${i + 1} Antirrabica`, fecha_aplicacion: `2025-0${(i % 9) + 1}-1${i % 9}`,
  tipo: 'Obligatoria', proximo_refuerzo: `2026-0${(i % 9) + 1}-1${i % 9}`,
  veterinaria: `Clinica Veterinaria N${i + 1}`, descripcion: `Descripcion larga de la vacuna ${i + 1}. `.repeat(4),
}));
const tratamientos = Array.from({ length: 7 }, (_, i) => ({
  nombre: `Tratamiento ${i + 1}`, fecha_inicio: `2025-0${(i % 9) + 1}-05`,
  proximo_control: `2026-0${(i % 9) + 1}-05`, veterinaria: `Vet ${i + 1}`,
  descripcion: `Detalle del tratamiento ${i + 1}. `.repeat(5),
}));
const consultas = Array.from({ length: 8 }, (_, i) => ({
  motivo: `Consulta ${i + 1} por control`, fecha: `2025-1${i % 3}-0${(i % 9) + 1}`,
  veterinario: `Dr. Profesional ${i + 1}`, notas: `Observaciones ${i + 1}. `.repeat(6),
  imagen_url: i % 2 ? 'http://x/y.png' : null,
}));
const sugeridas = Array.from({ length: 5 }, (_, i) => ({
  nombre: `Sugerida ${i + 1}`, applied: i % 2 === 0,
  frecuencia_descripcion: 'Anual', proximo_refuerzo: `2026-0${i + 1}-01`,
}));

const datos = {
  mascota: { id: 42, nombre: 'Titan', especie: 'perro', raza: 'Labrador Retriever', peso: 20.4, fecha_nacimiento: '2022-02-15' },
  usuario: { nombre: 'Nacho', apellido: 'Eskenazi' },
  vacunas, vacunasSugeridas: sugeridas, tratamientos, consultas,
};

let fallos = 0;
const check = (ok, msg) => { console.log(ok ? '  PASA  ' : '  FALLA ', msg); if (!ok) fallos++; };

// -- 1. Modelo ---------------------------------------------------------------
const secs = construirSecciones(datos);
console.log('\n1. MODELO');
check(secs.totalRegistros === 24, `totalRegistros = ${secs.totalRegistros} (esperado 24)`);
check(secs.secciones.length === 4, `4 secciones: ${secs.secciones.map(s => s.titulo).join(', ')}`);
check(secs.secciones[0].items.length === 9, 'vacunas: 9');
check(secs.secciones[1].items.length === 5, 'plan sugerido: 5');
check(secs.secciones[2].items.length === 7, 'tratamientos: 7');
check(secs.secciones[3].items.length === 8, 'consultas: 8');
check(secs.identificacion.some(([k]) => k === 'Titular responsable'), 'incluye titular responsable');

// -- 2. PDF (web / jsPDF): el texto REALMENTE dibujado ------------------------
console.log('\n2. PDF (jsPDF)');
const doc = construirDocPdf(jsPDF, datos);
const paginas = doc.internal.getNumberOfPages();

// Extraer el texto de los streams del PDF generado.
const raw = doc.output('arraybuffer');
const bytes = Buffer.from(raw).toString('latin1');
const RE_TJ = new RegExp('\\(((?:\\\\.|[^()\\\\])*)\\)\\s*Tj', 'g');
const dibujado = [...bytes.matchAll(RE_TJ)]
  .map(m => m[1].replace(/\\([()\\])/g, '$1')).join('\n');

check(paginas >= 3, `el documento tiene ${paginas} paginas`);
const faltantes = [];
vacunas.forEach(v => { if (!dibujado.includes(v.nombre)) faltantes.push(v.nombre); });
tratamientos.forEach(t => { if (!dibujado.includes(t.nombre)) faltantes.push(t.nombre); });
consultas.forEach(c => { if (!dibujado.includes(c.motivo)) faltantes.push(c.motivo); });
sugeridas.forEach(s => { if (!dibujado.includes(s.nombre)) faltantes.push(s.nombre); });
check(faltantes.length === 0, `los 24 registros + 5 sugeridas estan dibujados${faltantes.length ? ' -- FALTAN: ' + faltantes.join(', ') : ''}`);

check(dibujado.includes('Titan'), 'aparece el nombre de la mascota');
check(/AVISO IMPORTANTE/.test(dibujado), 'aparece el recuadro legal (AVISO IMPORTANTE)');
check(/EXCLUSIVAMENTE INFORMATIVO/.test(dibujado), 'aclara que es informativo');
check(dibujado.includes('Zooni'), 'aparece la marca Zooni en el pie');
check(dibujado.includes(numeroDocumento(42, new Date())), 'aparece el N. de documento');
const pies = (dibujado.match(/gina \d+ de \d+/g) || []).length;
check(pies === paginas, `pie de pagina en las ${paginas} paginas (encontrados ${pies})`);

// -- 3. HTML (nativo / expo-print) -------------------------------------------
console.log('\n3. HTML (expo-print)');
const html = construirHtmlFicha(datos);
const faltantesHtml = [];
[...vacunas.map(v => v.nombre), ...tratamientos.map(t => t.nombre),
  ...consultas.map(c => c.motivo), ...sugeridas.map(s => s.nombre)]
  .forEach(n => { if (!html.includes(n)) faltantesHtml.push(n); });
check(faltantesHtml.length === 0, `los 29 registros estan en el HTML${faltantesHtml.length ? ' -- FALTAN: ' + faltantesHtml.join(', ') : ''}`);
check(html.includes('AVISO IMPORTANTE'), 'el HTML lleva el aviso legal');
check(html.includes('<svg'), 'el HTML lleva la huella de Zooni en el pie');
check(html.includes('Ficha m\u00e9dica veterinaria'), 'el HTML se identifica como ficha medica');

// -- 4. Casos borde ----------------------------------------------------------
console.log('\n4. CASOS BORDE (mascota sin datos)');
const vacio = construirDocPdf(jsPDF, { mascota: { nombre: 'Sin datos' } });
check(vacio.internal.getNumberOfPages() >= 1, 'una ficha vacia igual genera el PDF');
const htmlVacio = construirHtmlFicha({ mascota: { nombre: 'Sin datos' } });
check(htmlVacio.includes('No hay vacunas registradas'), 'muestra los textos de "sin registros"');
check(nombreArchivo('Tit\u00e1n \u00f1/\u00e1') === 'Ficha-medica-Titan-n-a.pdf', `nombre de archivo: ${nombreArchivo('Tit\u00e1n \u00f1/\u00e1')}`);

console.log(fallos === 0 ? '\nTODO OK\n' : `\n${fallos} fallo(s)\n`);
process.exit(fallos ? 1 : 0);
