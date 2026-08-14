/**
 * fichaPdf.js — Ficha médica veterinaria en PDF
 *
 * Vivía dentro de FichaMedicaScreen, donde no había forma de ejecutarlo sin
 * abrir la app: por eso se publicó un PDF que cortaba las secciones y nadie lo
 * notó. Acá está separado de la pantalla y recibe los datos por parámetro, así
 * que se puede renderizar y verificar de punta a punta (ver los tests que
 * comprueban que TODOS los registros cargados aparecen en el documento).
 *
 * Dos caminos, un mismo contenido:
 *   · web    → jsPDF, que baja un archivo de verdad (expo-print en el navegador
 *              ignora el HTML y hace window.print() de la pantalla).
 *   · nativo → HTML + expo-print.
 * Ambos se arman desde el mismo modelo (`construirSecciones`) para que no
 * vuelvan a divergir.
 *
 * El documento es informativo: lo llena el usuario, no un veterinario
 * matriculado, y así lo aclara el recuadro legal del final.
 */

// ─── FORMATO ──────────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-08-14" → "14/08/2026" (sin pasar por Date: evita corrimientos de zona) */
export function formatFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('T')[0].split('-');
  if (!y || !m || !d) return null;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

/** "2026-08-14" → "14 de agosto de 2026" */
export function formatFechaLarga(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('T')[0].split('-');
  if (!y || !m || !d) return null;
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${y}`;
}

export function capitalizar(t) {
  if (!t) return '';
  return String(t).charAt(0).toUpperCase() + String(t).slice(1);
}

/** Peso en kg, o en gramos si es menos de 1 kg (un canario pesa 35 g). */
export function formatPesoPdf(peso) {
  if (peso == null) return 'No registrado';
  const n = Number(peso);
  if (!Number.isFinite(n)) return 'No registrado';
  if (n < 1) return `${Math.round(n * 1000)} g`;
  return `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`;
}

export function calcularEdadTexto(fechaNacimiento) {
  if (!fechaNacimiento) return 'No registrada';
  const [y, m, d] = String(fechaNacimiento).split('T')[0].split('-').map(Number);
  if (!y) return 'No registrada';
  const hoy = new Date();
  let meses = (hoy.getFullYear() - y) * 12 + (hoy.getMonth() + 1 - m);
  if (hoy.getDate() < d) meses -= 1;
  if (meses < 0) return 'No registrada';
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anios === 0) return `${resto} ${resto === 1 ? 'mes' : 'meses'}`;
  return `${anios} ${anios === 1 ? 'año' : 'años'} y ${resto} ${resto === 1 ? 'mes' : 'meses'}`;
}

/** Días desde hoy hasta una fecha ISO (negativo = ya pasó). */
function diasHasta(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('T')[0].split('-').map(Number);
  if (!y) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(y, m - 1, d); objetivo.setHours(0, 0, 0, 0);
  return Math.round((objetivo - hoy) / 86400000);
}

/** "Vencida hace 12 días" / "Vence en 30 días" / "Vence hoy" */
function estadoVencimiento(iso) {
  const dias = diasHasta(iso);
  if (dias == null) return null;
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`;
  if (dias === 0) return 'Vence hoy';
  return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

// ─── MODELO DEL DOCUMENTO ─────────────────────────────────────────────────────

export const AVISO_LEGAL = [
  'Este documento es de carácter EXCLUSIVAMENTE INFORMATIVO. Fue generado de forma automática por la aplicación Zooni a partir de los datos que el propio usuario cargó en la ficha médica de su mascota.',
  'Zooni no verifica, audita ni valida la información contenida. Este documento NO constituye un certificado sanitario, una libreta de vacunación oficial ni un diagnóstico veterinario, y no reemplaza en ningún caso la consulta con un veterinario matriculado.',
  'Ante cualquier signo de enfermedad, urgencia o duda sobre la salud de su animal, consulte a un profesional. No suspenda ni modifique tratamientos basándose en este documento.',
];

/**
 * Arma las secciones del documento a partir de los datos crudos.
 * Devolver una estructura (y no HTML/PDF directo) es lo que permite que los dos
 * generadores muestren exactamente lo mismo y que los tests lo comprueben.
 *
 * @param {object} datos
 * @param {object} datos.mascota      { nombre, especie, raza, peso, fecha_nacimiento }
 * @param {object} [datos.usuario]    { nombre, apellido } — titular responsable
 * @param {Array}  datos.vacunas      aplicadas (fetchVacunas().aplicadas)
 * @param {Array}  [datos.vacunasSugeridas]  plan sugerido (fetchVacunas().sugeridas)
 * @param {Array}  datos.tratamientos aplicados (fetchTratamientos().aplicados)
 * @param {Array}  datos.consultas    fetchConsultas()
 */
export function construirSecciones({
  mascota = {},
  usuario = null,
  vacunas = [],
  vacunasSugeridas = [],
  tratamientos = [],
  consultas = [],
}) {
  const m = mascota ?? {};

  // ── Ficha identificatoria ──────────────────────────────────────────────────
  const identificacion = [
    ['Nombre', m.nombre || 'Sin nombre'],
    ['Especie', capitalizar(m.especie) || 'No registrada'],
    ['Raza', m.raza || 'Sin especificar'],
    ['Fecha de nacimiento', formatFecha(m.fecha_nacimiento) ?? 'No registrada'],
    ['Edad', calcularEdadTexto(m.fecha_nacimiento)],
    ['Peso actual', formatPesoPdf(m.peso)],
  ];

  const titular = usuario
    ? [
      ['Titular responsable', [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || 'No registrado'],
    ]
    : [];

  // ── Secciones de registros ─────────────────────────────────────────────────
  // `lineas` son pares [etiqueta, valor] para que salgan alineados y se lea
  // como una ficha y no como un párrafo suelto.
  const secVacunas = {
    titulo: 'Vacunas aplicadas',
    vacio: 'No hay vacunas registradas para este animal.',
    items: vacunas.map((v) => ({
      titulo: v.nombre || 'Sin nombre',
      chip: formatFecha(v.fecha_aplicacion) ?? null,
      lineas: [
        ['Fecha de aplicación', formatFecha(v.fecha_aplicacion) ?? 'No registrada'],
        ['Tipo', v.tipo || 'Vacuna'],
        ['Próxima dosis', v.proximo_refuerzo
          ? `${formatFecha(v.proximo_refuerzo)}${estadoVencimiento(v.proximo_refuerzo) ? ` (${estadoVencimiento(v.proximo_refuerzo)})` : ''}`
          : 'Sin próxima dosis registrada'],
        ['Aplicada por', v.veterinaria || 'No registrado'],
        ['Descripción', v.descripcion || 'Sin descripción'],
      ],
    })),
  };

  const secPlan = {
    titulo: 'Plan de vacunación sugerido',
    vacio: 'No hay un plan sugerido para esta especie.',
    // El plan es orientativo y depende de la especie/edad: se aclara acá mismo
    // para que nadie lo lea como "vacunas que el animal tiene".
    nota: 'Calendario orientativo según especie y edad. No refleja aplicaciones reales salvo donde se indica.',
    items: vacunasSugeridas.map((s) => ({
      titulo: s.nombre || 'Sin nombre',
      chip: s.applied ? 'Aplicada' : 'Pendiente',
      lineas: [
        ['Estado', s.applied ? 'Aplicada' : 'Pendiente de aplicación'],
        ['Frecuencia', s.frecuencia_descripcion || 'No especificada'],
        ['Próximo refuerzo', s.proximo_refuerzo
          ? `${formatFecha(s.proximo_refuerzo)}${estadoVencimiento(s.proximo_refuerzo) ? ` (${estadoVencimiento(s.proximo_refuerzo)})` : ''}`
          : 'Sin fecha registrada'],
      ],
    })),
  };

  const secTratamientos = {
    titulo: 'Tratamientos',
    vacio: 'No hay tratamientos registrados para este animal.',
    items: tratamientos.map((t) => ({
      titulo: t.nombre || 'Sin nombre',
      chip: formatFecha(t.fecha_inicio) ?? null,
      lineas: [
        ['Fecha de inicio', formatFecha(t.fecha_inicio) ?? 'No registrada'],
        ['Próximo control', t.proximo_control
          ? `${formatFecha(t.proximo_control)}${estadoVencimiento(t.proximo_control) ? ` (${estadoVencimiento(t.proximo_control)})` : ''}`
          : 'Sin control programado'],
        ['Veterinaria', t.veterinaria || 'No registrada'],
        ['Descripción', t.descripcion || 'Sin descripción'],
      ],
    })),
  };

  const secConsultas = {
    titulo: 'Consultas veterinarias',
    vacio: 'No hay consultas registradas para este animal.',
    items: consultas.map((c) => ({
      titulo: c.motivo || 'Consulta',
      chip: formatFecha(c.fecha) ?? null,
      lineas: [
        ['Fecha', formatFecha(c.fecha) ?? 'No registrada'],
        ['Profesional', c.veterinario || 'No registrado'],
        ['Observaciones', c.notas || 'Sin observaciones'],
        // La imagen no se incrusta (puede pesar megas y son varias), pero se
        // deja constancia de que existe en la app.
        ['Estudio adjunto', c.imagen_url ? 'Sí (disponible en la app)' : 'No'],
      ],
    })),
  };

  // ── Resumen ────────────────────────────────────────────────────────────────
  const pendientes = [
    ...vacunas.filter((v) => v.proximo_refuerzo && diasHasta(v.proximo_refuerzo) < 0)
      .map((v) => `${v.nombre}: refuerzo vencido el ${formatFecha(v.proximo_refuerzo)}`),
    ...tratamientos.filter((t) => t.proximo_control && diasHasta(t.proximo_control) < 0)
      .map((t) => `${t.nombre}: control vencido el ${formatFecha(t.proximo_control)}`),
  ];

  const resumen = [
    ['Vacunas registradas', String(vacunas.length)],
    ['Tratamientos registrados', String(tratamientos.length)],
    ['Consultas registradas', String(consultas.length)],
    ['Vencimientos pendientes', pendientes.length ? String(pendientes.length) : 'Ninguno'],
  ];

  return {
    mascota: m,
    identificacion: [...identificacion, ...titular],
    resumen,
    pendientes,
    secciones: [secVacunas, secPlan, secTratamientos, secConsultas],
    totalRegistros: vacunas.length + tratamientos.length + consultas.length,
  };
}

/** Identificador legible del documento: ZOO-<mascota>-<AAAAMMDD>. */
export function numeroDocumento(mascotaId, fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `ZOO-${String(mascotaId ?? '0').padStart(4, '0')}-${y}${m}${d}`;
}

// ─── GENERADOR PDF (web, jsPDF) ───────────────────────────────────────────────

const VERDE = [45, 189, 114];
const VERDE_OSC = [23, 112, 70];
const TEXTO = [44, 44, 44];
const SUAVE = [107, 107, 107];
const TENUE = [154, 154, 154];
const LINEA = [228, 245, 235];

/**
 * Huella de Zooni dibujada con vectores (una almohadilla y cuatro dedos).
 * Se dibuja en lugar de incrustar un PNG para que el pie de página no dependa
 * de ningún asset y no sume peso al archivo.
 */
function huellaZooni(doc, cx, cy, escala = 1, color = TENUE) {
  doc.setFillColor(...color);
  // Almohadilla central
  doc.ellipse(cx, cy + 0.9 * escala, 1.5 * escala, 1.25 * escala, 'F');
  // Cuatro dedos en arco
  const dedos = [
    [-1.65, -1.15, 0.62, 0.8],
    [-0.6, -1.95, 0.62, 0.85],
    [0.6, -1.95, 0.62, 0.85],
    [1.65, -1.15, 0.62, 0.8],
  ];
  dedos.forEach(([dx, dy, rx, ry]) => {
    doc.ellipse(cx + dx * escala, cy + dy * escala, rx * escala, ry * escala, 'F');
  });
}

/**
 * Construye el documento con jsPDF.
 * @param {Function} JsPdfCtor  constructor de jsPDF (inyectado para poder testear en Node)
 * @returns el doc, ya listo para .save()
 */
export function construirDocPdf(JsPdfCtor, datos, fotoDataUri = null) {
  const d = construirSecciones(datos);
  const doc = new JsPdfCtor({ unit: 'mm', format: 'a4' });

  const ANCHO = doc.internal.pageSize.getWidth();
  const ALTO = doc.internal.pageSize.getHeight();
  const M = 16;
  const UTIL = ANCHO - M * 2;
  const PIE = 16;              // alto reservado para el pie
  const LIMITE = ALTO - PIE - 6;
  let y = 0;

  const m = d.mascota;
  const hoy = new Date();

  // ── Encabezado ─────────────────────────────────────────────────────────────
  const ALTO_HEADER = 46;
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, ANCHO, ALTO_HEADER, 'F');

  let xTexto = M;
  if (fotoDataUri) {
    const D = 28;
    const cx = M + D / 2;
    const cy = ALTO_HEADER / 2;
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, D / 2 + 1.4, 'F');
    doc.saveGraphicsState();
    doc.circle(cx, cy, D / 2).clip();
    doc.addImage(fotoDataUri, M, cy - D / 2, D, D, undefined, 'FAST');
    doc.restoreGraphicsState();
    xTexto = M + D + 9;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(21);
  doc.text(String(m.nombre ?? 'Mascota'), xTexto, 19);

  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  const subtitulo = [capitalizar(m.especie), m.raza, calcularEdadTexto(m.fecha_nacimiento)]
    .filter(Boolean).join('   ·   ');
  doc.text(doc.splitTextToSize(subtitulo, ANCHO - xTexto - M)[0], xTexto, 26);

  doc.setFontSize(7.5);
  doc.text('FICHA MÉDICA VETERINARIA  ·  DOCUMENTO INFORMATIVO', xTexto, 33.5);

  // Franja de metadatos del documento
  doc.setFillColor(...VERDE_OSC);
  doc.rect(0, ALTO_HEADER - 8, ANCHO, 8, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`N.º ${numeroDocumento(m.id, hoy)}`, M, ALTO_HEADER - 2.6);
  doc.text(`Emitido el ${formatFechaLarga(hoy.toISOString())}`, ANCHO - M, ALTO_HEADER - 2.6, { align: 'right' });

  y = ALTO_HEADER + 11;

  // ── Utilidades de maquetado ────────────────────────────────────────────────
  const nuevaPagina = () => { doc.addPage(); y = 20; };
  const asegurarEspacio = (alto) => { if (y + alto > LIMITE) nuevaPagina(); };

  const tituloSeccion = (titulo, cantidad = null, nota = null) => {
    // El título nunca puede quedar solo al pie: se reserva también el alto de
    // la primera línea de contenido.
    asegurarEspacio(nota ? 22 : 17);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...VERDE);
    const texto = cantidad != null ? `${titulo.toUpperCase()}  (${cantidad})` : titulo.toUpperCase();
    doc.text(texto, M, y);
    y += 2.6;
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.7);
    doc.line(M, y, ANCHO - M, y);
    y += 5.5;
    if (nota) {
      doc.setFont(undefined, 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...TENUE);
      doc.splitTextToSize(nota, UTIL).forEach((l) => { doc.text(l, M, y); y += 3.4; });
      doc.setFont(undefined, 'normal');
      y += 2;
    }
  };

  /** Bloque de pares etiqueta/valor en dos columnas. */
  const bloqueDatos = (pares) => {
    const cols = 2;
    const anchoCol = UTIL / cols;
    for (let i = 0; i < pares.length; i += cols) {
      asegurarEspacio(11);
      const fila = pares.slice(i, i + cols);
      const yFila = y;
      let maxAlto = 0;
      fila.forEach(([label, valor], j) => {
        const x = M + j * anchoCol;
        doc.setFontSize(6.6);
        doc.setTextColor(...TENUE);
        doc.setFont(undefined, 'normal');
        doc.text(String(label).toUpperCase(), x, yFila);
        doc.setFontSize(9.5);
        doc.setTextColor(...TEXTO);
        doc.setFont(undefined, 'bold');
        const lineas = doc.splitTextToSize(String(valor), anchoCol - 6);
        lineas.forEach((l, k) => doc.text(l, x, yFila + 4.6 + k * 4.2));
        maxAlto = Math.max(maxAlto, 4.6 + lineas.length * 4.2);
      });
      y = yFila + maxAlto + 3.5;
    }
    y += 1;
  };

  /** Un registro (una vacuna, un tratamiento, una consulta). */
  const itemRegistro = (item, indice) => {
    // Se mide TODO el ítem antes de dibujar nada: así nunca queda partido entre
    // dos páginas ni se dibuja fuera del área útil (el bug que se comía los
    // registros del documento anterior).
    const anchoEtiqueta = 34;
    const anchoValor = UTIL - anchoEtiqueta - 7;
    const filas = item.lineas
      .filter(([, valor]) => valor != null && valor !== '')
      .map(([etiqueta, valor]) => ({
        etiqueta,
        lineas: doc.splitTextToSize(String(valor), anchoValor),
      }));
    const altoItem = 6.5 + filas.reduce((acc, f) => acc + f.lineas.length * 4.1, 0) + 4;
    asegurarEspacio(altoItem);

    const yInicio = y;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(9.8);
    doc.setTextColor(...TEXTO);
    doc.text(`${indice}. ${item.titulo}`, M + 6, y);

    if (item.chip) {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(...SUAVE);
      doc.text(String(item.chip), ANCHO - M, y, { align: 'right' });
    }
    y += 5.4;

    filas.forEach(({ etiqueta, lineas }) => {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(...TENUE);
      doc.text(`${etiqueta}:`, M + 6, y);
      doc.setFontSize(8.4);
      doc.setTextColor(...SUAVE);
      lineas.forEach((l, k) => doc.text(l, M + 6 + anchoEtiqueta, y + k * 4.1));
      y += lineas.length * 4.1;
    });

    // Barra verde a la izquierda, como las cards de la app
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(1.3);
    doc.line(M + 1.5, yInicio - 3.2, M + 1.5, y - 1);
    y += 4;
  };

  const textoVacio = (texto) => {
    asegurarEspacio(9);
    doc.setFont(undefined, 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...TENUE);
    doc.text(texto, M + 2, y);
    doc.setFont(undefined, 'normal');
    y += 8;
  };

  // ── Contenido ──────────────────────────────────────────────────────────────
  tituloSeccion('Identificación del animal');
  bloqueDatos(d.identificacion);

  y += 2;
  tituloSeccion('Resumen clínico');
  bloqueDatos(d.resumen);
  if (d.pendientes.length) {
    asegurarEspacio(6 + d.pendientes.length * 4.2);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(214, 69, 69);
    doc.text('Atención — vencimientos pendientes:', M, y);
    y += 4.4;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    d.pendientes.forEach((p) => {
      doc.splitTextToSize(`•  ${p}`, UTIL - 4).forEach((l) => { doc.text(l, M + 2, y); y += 4.2; });
    });
    y += 3;
  }

  d.secciones.forEach((sec) => {
    y += 2;
    tituloSeccion(sec.titulo, sec.items.length, sec.nota);
    if (!sec.items.length) textoVacio(sec.vacio);
    sec.items.forEach((item, i) => itemRegistro(item, i + 1));
  });

  // ── Aviso legal ────────────────────────────────────────────────────────────
  const lineasAviso = AVISO_LEGAL.flatMap((p) => [...doc.splitTextToSize(p, UTIL - 10), '']);
  asegurarEspacio(12 + lineasAviso.length * 3.6);
  y += 4;

  // El alto se calcula antes de dibujar: el recuadro va primero (si no, el
  // relleno tapa el texto) y el texto encima.
  const yCaja = y;
  const altoCaja = 9 + lineasAviso.length * 3.6;
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.6);
  doc.setFillColor(247, 252, 249);
  doc.rect(M, yCaja, UTIL, altoCaja, 'FD');

  doc.setFont(undefined, 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...VERDE_OSC);
  doc.text('AVISO IMPORTANTE', M + 5, yCaja + 6);

  let yTexto = yCaja + 11;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...SUAVE);
  lineasAviso.forEach((l) => {
    if (l) doc.text(l, M + 5, yTexto);
    yTexto += 3.6;
  });
  y = yCaja + altoCaja + 4;

  // ── Pie con la huella, en todas las páginas ────────────────────────────────
  const paginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    const yPie = ALTO - 10;
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.5);
    doc.line(M, yPie - 5, ANCHO - M, yPie - 5);

    huellaZooni(doc, M + 2.2, yPie - 1.2, 0.85, VERDE);

    doc.setFont(undefined, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...VERDE);
    doc.text('Zooni', M + 7, yPie);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...TENUE);
    doc.text('· Ficha médica digital · Documento informativo generado con datos cargados por el usuario',
      M + 15.5, yPie);
    doc.text(`Página ${p} de ${paginas}`, ANCHO - M, yPie, { align: 'right' });
  }

  return doc;
}

// ─── GENERADOR HTML (nativo, expo-print) ──────────────────────────────────────

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** Misma huella que el PDF, en SVG (el emoji 🐾 no siempre está en el dispositivo). */
const HUELLA_SVG = `
<svg viewBox="0 0 24 24" width="11" height="11" style="vertical-align:-1px">
  <g fill="#2DBD72">
    <ellipse cx="12" cy="16" rx="5" ry="4.2"/>
    <ellipse cx="5.4" cy="8.6" rx="2.1" ry="2.7"/>
    <ellipse cx="9.6" cy="5.6" rx="2.1" ry="2.9"/>
    <ellipse cx="14.4" cy="5.6" rx="2.1" ry="2.9"/>
    <ellipse cx="18.6" cy="8.6" rx="2.1" ry="2.7"/>
  </g>
</svg>`;

export function construirHtmlFicha(datos, fotoDataUri = null) {
  const d = construirSecciones(datos);
  const m = d.mascota;
  const hoy = new Date();

  const pares = (lista) => lista.map(([label, valor]) => `
    <div class="dato">
      <div class="dato-label">${esc(label)}</div>
      <div class="dato-valor">${esc(valor)}</div>
    </div>`).join('');

  const item = (it, i) => `
    <div class="item">
      <div class="item-top">
        <span class="item-titulo">${i}. ${esc(it.titulo)}</span>
        ${it.chip ? `<span class="chip">${esc(it.chip)}</span>` : ''}
      </div>
      <table class="campos">
        ${it.lineas.filter(([, v]) => v != null && v !== '').map(([et, v]) => `
          <tr><td class="et">${esc(et)}:</td><td class="val">${esc(v)}</td></tr>`).join('')}
      </table>
    </div>`;

  const seccion = (sec) => `
    <div class="seccion">
      <div class="seccion-titulo">${esc(sec.titulo)}<span class="contador">${sec.items.length}</span></div>
      ${sec.nota ? `<div class="nota">${esc(sec.nota)}</div>` : ''}
      ${sec.items.length
    ? sec.items.map((it, i) => item(it, i + 1)).join('')
    : `<div class="vacio">${esc(sec.vacio)}</div>`}
    </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  @page { margin: 0 0 58px; }
  body { font-family: Helvetica, Arial, sans-serif; margin: 0; color: #2C2C2C; font-size: 11px; }

  .header { background-color: #2DBD72; padding: 24px 34px 16px; color: #FFF; }
  .header-row { display: flex; align-items: center; }
  .foto { width: 84px; height: 84px; border-radius: 42px; object-fit: cover;
          border: 3px solid rgba(255,255,255,.9); background: #C8F0D8; margin-right: 20px; flex-shrink: 0; }
  .nombre { margin: 0; font-size: 26px; font-weight: bold; }
  .sub { margin: 5px 0 0; font-size: 12px; opacity: .95; }
  .doc { margin: 8px 0 0; font-size: 9px; letter-spacing: 1.3px; text-transform: uppercase; opacity: .85; }
  .meta { background: #177046; color: #FFF; padding: 5px 34px; font-size: 8.5px;
          display: flex; justify-content: space-between; }

  .container { padding: 22px 34px 24px; }

  .seccion { margin-top: 18px; }
  .seccion-titulo { font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;
                    color: #2DBD72; border-bottom: 2px solid #E4F5EB; padding-bottom: 5px; margin-bottom: 9px; }
  .contador { display: inline-block; margin-left: 8px; background: #E4F5EB; color: #177046;
              border-radius: 8px; padding: 1px 7px; font-size: 9px; letter-spacing: 0; }
  .nota { font-size: 8.5px; color: #9A9A9A; font-style: italic; margin: -3px 0 8px; }

  .datos { display: flex; flex-wrap: wrap; margin: 0 -7px; }
  .dato { width: 50%; padding: 0 7px 11px; }
  .dato-label { font-size: 8px; letter-spacing: .7px; text-transform: uppercase; color: #9A9A9A; margin-bottom: 2px; }
  .dato-valor { font-size: 12px; font-weight: bold; }

  .item { border-left: 3px solid #E4F5EB; padding: 6px 0 6px 11px; margin-bottom: 9px; page-break-inside: avoid; }
  .item-top { margin-bottom: 4px; overflow: hidden; }
  .item-titulo { font-size: 12px; font-weight: bold; }
  .chip { float: right; font-size: 9px; color: #6B6B6B; background: #F4F4F4; border-radius: 8px; padding: 2px 8px; }
  .campos { width: 100%; border-collapse: collapse; }
  .campos td { vertical-align: top; padding: 1px 0; }
  .et { width: 108px; font-size: 8.5px; color: #9A9A9A; text-transform: uppercase; letter-spacing: .3px; }
  .val { font-size: 10px; color: #6B6B6B; line-height: 1.5; }

  .vacio { font-size: 10.5px; color: #AAA; font-style: italic; background: #FAFAFA; border-radius: 8px; padding: 9px 11px; }
  .alerta { margin-top: 8px; font-size: 10px; color: #D64545; }
  .alerta b { display: block; margin-bottom: 3px; }

  .aviso { margin-top: 22px; border: 1px solid #E4F5EB; background: #F7FCF9;
           border-radius: 8px; padding: 12px 14px; page-break-inside: avoid; }
  .aviso h4 { margin: 0 0 6px; font-size: 10px; color: #177046; letter-spacing: .6px; }
  .aviso p { margin: 0 0 6px; font-size: 8.8px; color: #6B6B6B; line-height: 1.55; }

  .pie { position: fixed; bottom: 0; left: 0; right: 0; padding: 8px 34px;
         border-top: 1px solid #E4F5EB; font-size: 8px; color: #9A9A9A;
         display: flex; justify-content: space-between; align-items: center; background: #FFF; }
  .pie b { color: #2DBD72; }
</style></head>
<body>
  <div class="header">
    <div class="header-row">
      ${fotoDataUri ? `<img class="foto" src="${esc(fotoDataUri)}" />` : ''}
      <div>
        <p class="nombre">${esc(m.nombre ?? 'Mascota')}</p>
        <p class="sub">${esc([capitalizar(m.especie), m.raza, calcularEdadTexto(m.fecha_nacimiento)].filter(Boolean).join('   ·   '))}</p>
        <p class="doc">Ficha médica veterinaria · Documento informativo</p>
      </div>
    </div>
  </div>
  <div class="meta">
    <span>N.º ${esc(numeroDocumento(m.id, hoy))}</span>
    <span>Emitido el ${esc(formatFechaLarga(hoy.toISOString()))}</span>
  </div>

  <div class="container">
    <div class="seccion">
      <div class="seccion-titulo">Identificación del animal</div>
      <div class="datos">${pares(d.identificacion)}</div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">Resumen clínico</div>
      <div class="datos">${pares(d.resumen)}</div>
      ${d.pendientes.length ? `<div class="alerta"><b>Atención — vencimientos pendientes:</b>${
    d.pendientes.map((p) => `• ${esc(p)}<br/>`).join('')}</div>` : ''}
    </div>

    ${d.secciones.map(seccion).join('')}

    <div class="aviso">
      <h4>AVISO IMPORTANTE</h4>
      ${AVISO_LEGAL.map((p) => `<p>${esc(p)}</p>`).join('')}
    </div>
  </div>

  <div class="pie">
    <span>${HUELLA_SVG} <b>Zooni</b> · Ficha médica digital · Documento informativo generado con datos cargados por el usuario</span>
    <span>${esc(formatFecha(hoy.toISOString()))}</span>
  </div>
</body></html>`;
}

/** Nombre de archivo sin caracteres problemáticos. */
export function nombreArchivo(mascotaNombre) {
  const limpio = String(mascotaNombre ?? 'mascota')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `Ficha-medica-${limpio || 'mascota'}.pdf`;
}
