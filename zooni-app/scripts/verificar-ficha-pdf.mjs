import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const raizApp = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { jsPDF } = require(path.join(raizApp, 'node_modules/jspdf/dist/jspdf.node.min.js'));
const { construirSecciones, construirDocPdf, construirHtmlFicha, nombreArchivo, numeroDocumento } =
  await import(pathToFileURL(path.join(raizApp, 'src/utils/fichaPdf.js')).href);

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
  nombre: `PlanSugerido ${i + 1}`, applied: i % 2 === 0,
  frecuencia_descripcion: 'Anual', proximo_refuerzo: `2026-0${i + 1}-01`,
}));

const datos = {
  mascota: { id: 42, nombre: 'Titan', especie: 'perro', raza: 'Labrador Retriever', peso: 20.4, fecha_nacimiento: '2022-02-15' },
  usuario: { nombre: 'Nacho', apellido: 'Eskenazi' },
  vacunas, vacunasSugeridas: sugeridas, tratamientos, consultas,
};

let fallos = 0;
const check = (ok, msg) => { console.log(ok ? '  PASA  ' : '  FALLA ', msg); if (!ok) fallos++; };

const secs = construirSecciones(datos);
console.log('\n1. MODELO');
check(secs.totalRegistros === 24, `totalRegistros = ${secs.totalRegistros} (esperado 24)`);
check(secs.secciones.length === 3, `3 secciones: ${secs.secciones.map(s => s.titulo).join(', ')}`);
check(secs.secciones[0].items.length === 9, 'vacunas: 9');
check(secs.secciones[1].items.length === 7, 'tratamientos: 7');
check(secs.secciones[2].items.length === 8, 'consultas: 8');
check(!secs.secciones.some(s => /sugerid/i.test(s.titulo)), 'NO hay seccion de plan sugerido');
check(secs.identificacion.some(([k]) => k === 'Titular responsable'), 'incluye titular responsable');

console.log('\n2. PDF (jsPDF)');
const doc = construirDocPdf(jsPDF, datos);
const paginas = doc.internal.getNumberOfPages();

const raw = doc.output('arraybuffer');
const bytes = Buffer.from(raw).toString('latin1');
const RE_TJ = new RegExp('\\(((?:\\\\.|[^()\\\\])*)\\)\\s*Tj', 'g');
const dibujado = [...bytes.matchAll(RE_TJ)]
  .map(m => m[1].replace(/\\([()\\])/g, '$1')).join('\n');

check(paginas >= 2, `el documento tiene ${paginas} paginas`);
const faltantes = [];
vacunas.forEach(v => { if (!dibujado.includes(v.nombre)) faltantes.push(v.nombre); });
tratamientos.forEach(t => { if (!dibujado.includes(t.nombre)) faltantes.push(t.nombre); });
consultas.forEach(c => { if (!dibujado.includes(c.motivo)) faltantes.push(c.motivo); });
check(faltantes.length === 0, `los 24 registros estan dibujados${faltantes.length ? ' -- FALTAN: ' + faltantes.join(', ') : ''}`);

const colados = sugeridas.map(s => s.nombre).filter(n => dibujado.includes(n));
check(colados.length === 0, `el plan sugerido no aparece en el PDF${colados.length ? ' -- SE COLARON: ' + colados.join(', ') : ''}`);
check(!/SUGERIDO/i.test(dibujado), 'no aparece el titulo "PLAN DE VACUNACION SUGERIDO"');

check(dibujado.includes('Titan'), 'aparece el nombre de la mascota');
check(/AVISO IMPORTANTE/.test(dibujado), 'aparece el recuadro legal (AVISO IMPORTANTE)');
check(/EXCLUSIVAMENTE INFORMATIVO/.test(dibujado), 'aclara que es informativo');
check(dibujado.includes('Zooni'), 'aparece la marca Zooni en el pie');
check(dibujado.includes(numeroDocumento(42, new Date())), 'aparece el N. de documento');
const pies = (dibujado.match(/gina \d+ de \d+/g) || []).length;
check(pies === paginas, `pie de pagina en las ${paginas} paginas (encontrados ${pies})`);

console.log('\n3. HTML (expo-print)');
const html = construirHtmlFicha(datos);
const faltantesHtml = [];
[...vacunas.map(v => v.nombre), ...tratamientos.map(t => t.nombre), ...consultas.map(c => c.motivo)]
  .forEach(n => { if (!html.includes(n)) faltantesHtml.push(n); });
check(faltantesHtml.length === 0, `los 24 registros estan en el HTML${faltantesHtml.length ? ' -- FALTAN: ' + faltantesHtml.join(', ') : ''}`);
check(!sugeridas.some(s => html.includes(s.nombre)), 'el plan sugerido tampoco aparece en el HTML');
check(html.includes('AVISO IMPORTANTE'), 'el HTML lleva el aviso legal');
check(html.includes('<svg'), 'el HTML lleva la huella de Zooni en el pie');
check(html.includes('Ficha m\u00e9dica veterinaria'), 'el HTML se identifica como ficha medica');

console.log('\n4. CASOS BORDE (mascota sin datos)');
const vacio = construirDocPdf(jsPDF, { mascota: { nombre: 'Sin datos' } });
check(vacio.internal.getNumberOfPages() >= 1, 'una ficha vacia igual genera el PDF');
const htmlVacio = construirHtmlFicha({ mascota: { nombre: 'Sin datos' } });
check(htmlVacio.includes('No hay vacunas registradas'), 'muestra los textos de "sin registros"');
check(nombreArchivo('Tit\u00e1n \u00f1/\u00e1') === 'Ficha-medica-Titan-n-a.pdf', `nombre de archivo: ${nombreArchivo('Tit\u00e1n \u00f1/\u00e1')}`);

console.log('\n5. CON FOTO (recorte circular del encabezado)');
const FOTO_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const docFoto = construirDocPdf(jsPDF, datos, FOTO_PNG);
const rawFoto = Buffer.from(docFoto.output('arraybuffer')).toString('latin1');

check(docFoto.internal.getNumberOfPages() === paginas,
  `con foto tiene las mismas ${paginas} paginas que sin foto (${docFoto.internal.getNumberOfPages()})`);

const posW = rawFoto.search(/\bW\b/);
check(posW !== -1, 'el encabezado aplica el recorte circular de la foto');
if (posW !== -1) {
  const antes = rawFoto.slice(Math.max(0, posW - 200), posW);
  const despues = rawFoto.slice(posW, posW + 8);
  check(!/\n(S|f|B|s)\s*$/.test(antes),
    'el trazo NO se pinta antes de recortar (si se pinta, la pagina sale en blanco)');
  check(/^W\s*\n?\s*n\b/.test(despues.trim()) || /\bn\b/.test(despues),
    'el recorte cierra con el operador n (discardPath)');
}

const dibujadoFoto = [...rawFoto.matchAll(RE_TJ)].map(m => m[1].replace(/\\([()\\])/g, '$1')).join('\n');
for (const titulo of ['VACUNAS APLICADAS', 'TRATAMIENTOS', 'CONSULTAS VETERINARIAS']) {
  check(dibujadoFoto.includes(titulo), `con foto sigue apareciendo el titulo "${titulo}"`);
}

console.log(fallos === 0 ? '\nTODO OK\n' : `\n${fallos} fallo(s)\n`);
process.exit(fallos ? 1 : 0);
