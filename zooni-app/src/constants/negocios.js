/**
 * negocios.js — Qué cambia entre una veterinaria, una peluquería y un pet shop
 *
 * Las tres apps de Zooni Negocios comparten diseño (el de Zooni Paseadores:
 * header con estado, menú lateral, cards, botones pill). Lo que cambia —qué
 * secciones tienen, cómo se llama cada cosa, qué categorías y servicios
 * sugeridos ofrece, qué respuestas rápidas tiene el chat— vive acá, para que
 * las pantallas sean las mismas y se adapten solas al tipo.
 */

// ─── Secciones posibles (cada tipo elige las suyas) ─────────────────────────
const S = {
  inicio: { key: 'inicio', label: 'Inicio', icono: 'home-outline' },
  turnos: { key: 'turnos', label: 'Turnos', icono: 'calendar-outline' },
  pacientes: { key: 'pacientes', label: 'Pacientes', icono: 'medical-outline' },
  clientes: { key: 'clientes', label: 'Clientes', icono: 'people-outline' },
  servicios: { key: 'servicios', label: 'Servicios y precios', icono: 'pricetags-outline' },
  catalogo: { key: 'catalogo', label: 'Catálogo', icono: 'cube-outline' },
  pedidos: { key: 'pedidos', label: 'Pedidos', icono: 'receipt-outline' },
  galeria: { key: 'galeria', label: 'Trabajos', icono: 'images-outline' },
  mensajes: { key: 'mensajes', label: 'Mensajes', icono: 'chatbubbles-outline' },
  perfil: { key: 'perfil', label: 'Mi negocio', icono: 'storefront-outline' },
};

export const TIPOS_NEGOCIO = {
  veterinaria: {
    key: 'veterinaria',
    label: 'Veterinaria',
    app: 'Zooni Veterinarias',
    icono: 'medkit',
    color: '#E63946',
    fondoIcono: '#FDECEE',
    clase: 'servicio',
    usaTurnos: true,
    secciones: [S.inicio, S.turnos, S.pacientes, S.servicios, S.mensajes, S.perfil],
    textoTipo: 'Turnos, historia clínica de tus pacientes y urgencias.',
    abierto: { on: 'Recibiendo turnos', off: 'Sin turnos nuevos' },
    // Lo que se escribe en el registro y en "Mi negocio"
    placeholderNombre: 'Ej: Veterinaria San Martín',
    placeholderDescripcion: 'Ej: Clínica general, vacunación y cirugías. Atendemos perros y gatos.',
    categorias: ['Consultas', 'Vacunación', 'Cirugías', 'Estudios', 'Tratamientos', 'Otros'],
    sugeridos: [
      { nombre: 'Consulta general', categoria: 'Consultas', duracion: 30, precio: 15000 },
      { nombre: 'Vacuna antirrábica', categoria: 'Vacunación', duracion: 15, precio: 12000 },
      { nombre: 'Vacuna séxtuple / triple felina', categoria: 'Vacunación', duracion: 15, precio: 18000 },
      { nombre: 'Desparasitación', categoria: 'Tratamientos', duracion: 15, precio: 8000 },
      { nombre: 'Control postoperatorio', categoria: 'Consultas', duracion: 20, precio: 10000 },
      { nombre: 'Castración', categoria: 'Cirugías', duracion: 120, precio: 90000 },
      { nombre: 'Análisis de sangre', categoria: 'Estudios', duracion: 20, precio: 25000 },
      { nombre: 'Ecografía', categoria: 'Estudios', duracion: 30, precio: 35000 },
    ],
    especialidades: ['Clínica general', 'Cirugía', 'Dermatología', 'Cardiología', 'Traumatología',
      'Oftalmología', 'Odontología', 'Exóticos', 'Felinos', 'Diagnóstico por imágenes'],
    rapidas: [
      '¡Hola! ¿En qué te podemos ayudar?',
      '¿Qué síntomas tiene?',
      '¿Desde cuándo está así?',
      '¿Está comiendo y tomando agua normalmente?',
      'Te recomendamos sacar un turno para revisarlo',
      'Si es una urgencia, vení directo a la clínica',
      'Traé la libreta sanitaria al turno, por favor',
      'Recordá venir 10 minutos antes',
      'Ya está listo el resultado del estudio',
      '¿Cómo sigue después del tratamiento?',
    ],
  },

  peluqueria: {
    key: 'peluqueria',
    label: 'Peluquería',
    app: 'Zooni Peluquerías',
    icono: 'cut',
    color: '#9B59B6',
    fondoIcono: '#F3E8F8',
    clase: 'servicio',
    usaTurnos: true,
    preciosPorTamano: true,
    secciones: [S.inicio, S.turnos, S.servicios, S.galeria, S.clientes, S.mensajes, S.perfil],
    textoTipo: 'Turnos de baño y corte, precios por tamaño y tus trabajos.',
    abierto: { on: 'Recibiendo turnos', off: 'Sin turnos nuevos' },
    placeholderNombre: 'Ej: Peluquería Canina Mimados',
    placeholderDescripcion: 'Ej: Baño, corte de raza y estética. Usamos productos hipoalergénicos.',
    categorias: ['Baño', 'Corte', 'Estética', 'Extras'],
    sugeridos: [
      { nombre: 'Baño', categoria: 'Baño', duracion: 60, precios: { chico: 12000, mediano: 15000, grande: 19000 } },
      { nombre: 'Baño y corte', categoria: 'Corte', duracion: 90, precios: { chico: 18000, mediano: 22000, grande: 28000 } },
      { nombre: 'Corte de raza', categoria: 'Corte', duracion: 120, precios: { chico: 22000, mediano: 27000, grande: 34000 } },
      { nombre: 'Deslanado', categoria: 'Estética', duracion: 90, precios: { chico: 15000, mediano: 19000, grande: 25000 } },
      { nombre: 'Corte de uñas', categoria: 'Extras', duracion: 15, precios: { chico: 4000, mediano: 4000, grande: 5000 } },
      { nombre: 'Limpieza de oídos', categoria: 'Extras', duracion: 15, precios: { chico: 4000, mediano: 4000, grande: 5000 } },
      { nombre: 'Corte higiénico', categoria: 'Corte', duracion: 30, precios: { chico: 7000, mediano: 8000, grande: 10000 } },
    ],
    rapidas: [
      '¡Hola! ¿Qué servicio te interesa?',
      '¿Qué raza y tamaño es?',
      '¿Tiene el pelo con nudos?',
      '¿Es tranquilo para el baño y el secado?',
      'Tenemos turno libre mañana',
      '¡Ya está listo para retirar! 🛁',
      'Te mando una foto de cómo quedó 📸',
      'Lo podemos buscar y llevar a tu casa',
      'Recordá traerlo con correa',
    ],
  },

  petshop: {
    key: 'petshop',
    label: 'Pet shop',
    app: 'Zooni Pet shops',
    icono: 'storefront',
    color: '#F5A623',
    fondoIcono: '#FFF4DE',
    clase: 'producto',
    usaPedidos: true,
    secciones: [S.inicio, S.pedidos, S.catalogo, S.clientes, S.mensajes, S.perfil],
    textoTipo: 'Tu catálogo con stock, pedidos y envíos.',
    abierto: { on: 'Recibiendo pedidos', off: 'Sin pedidos nuevos' },
    placeholderNombre: 'Ej: Pet Shop El Hueso',
    placeholderDescripcion: 'Ej: Alimentos, accesorios y juguetes. Envíos en el día por Caballito.',
    categorias: ['Alimento', 'Snacks', 'Accesorios', 'Juguetes', 'Higiene', 'Salud', 'Camas y ropa', 'Otros'],
    sugeridos: [],
    rapidas: [
      '¡Hola! ¿Qué estás buscando?',
      'Sí, lo tenemos en stock ✅',
      'Ese producto se nos agotó, ¿te ofrezco otro?',
      '¿Para qué tamaño y edad es?',
      'Tu pedido ya está en preparación',
      '¡Tu pedido está listo para retirar! 🛍️',
      'Tu pedido salió, llega en un rato 🛵',
      'Hacemos envíos en el día',
      'Aceptamos transferencia y Mercado Pago',
    ],
  },
};

export const LISTA_TIPOS_NEGOCIO = Object.values(TIPOS_NEGOCIO);
export const configNegocio = (tipo) => TIPOS_NEGOCIO[tipo] ?? TIPOS_NEGOCIO.veterinaria;

// ─── Tamaños (precios de peluquería y turnos) ───────────────────────────────
export const TAMANOS = [
  { key: 'chico', label: 'Chico', detalle: 'hasta 10 kg' },
  { key: 'mediano', label: 'Mediano', detalle: '10–25 kg' },
  { key: 'grande', label: 'Grande', detalle: '+25 kg' },
];

/** Tamaño de una mascota por su peso (para el precio de peluquería). */
export function tamanoPorPeso(peso) {
  const kg = Number(peso);
  if (!(kg > 0)) return null;
  if (kg <= 10) return 'chico';
  if (kg <= 25) return 'mediano';
  return 'grande';
}

// ─── Horarios ───────────────────────────────────────────────────────────────
export const DIAS_SEMANA = [
  { key: 'lun', label: 'Lunes', corto: 'Lun' }, { key: 'mar', label: 'Martes', corto: 'Mar' },
  { key: 'mie', label: 'Miércoles', corto: 'Mié' }, { key: 'jue', label: 'Jueves', corto: 'Jue' },
  { key: 'vie', label: 'Viernes', corto: 'Vie' }, { key: 'sab', label: 'Sábado', corto: 'Sáb' },
  { key: 'dom', label: 'Domingo', corto: 'Dom' },
];
// Date.getDay(): 0 = domingo
export const DIA_DE_JS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

export function HORARIOS_NEGOCIO_DEFAULT() {
  return {
    lun: { activo: true, desde: '09:00', hasta: '19:00' },
    mar: { activo: true, desde: '09:00', hasta: '19:00' },
    mie: { activo: true, desde: '09:00', hasta: '19:00' },
    jue: { activo: true, desde: '09:00', hasta: '19:00' },
    vie: { activo: true, desde: '09:00', hasta: '19:00' },
    sab: { activo: true, desde: '09:00', hasta: '13:00' },
    dom: { activo: false, desde: '09:00', hasta: '13:00' },
  };
}

// ─── Estados de turnos y pedidos (los ven el negocio y el dueño) ────────────
export const ESTADOS_TURNO = {
  pendiente: { label: 'Por confirmar', color: '#B07A00', fondo: '#FFF1DC', icono: 'hourglass-outline' },
  confirmado: { label: 'Confirmado', color: '#2DBD72', fondo: '#E3F7EC', icono: 'checkmark-circle-outline' },
  completado: { label: 'Atendido', color: '#2B6CB0', fondo: '#E6F0FA', icono: 'ribbon-outline' },
  rechazado: { label: 'Rechazado', color: '#E63946', fondo: '#FDECEE', icono: 'close-circle-outline' },
  cancelado: { label: 'Cancelado', color: '#6B6B6B', fondo: '#F1F1F1', icono: 'close-circle-outline' },
  ausente: { label: 'No vino', color: '#6B6B6B', fondo: '#F1F1F1', icono: 'person-remove-outline' },
};

export const ESTADOS_PEDIDO = {
  nuevo: { label: 'Nuevo', color: '#B07A00', fondo: '#FFF1DC', icono: 'sparkles-outline' },
  preparando: { label: 'En preparación', color: '#2B6CB0', fondo: '#E6F0FA', icono: 'cube-outline' },
  listo: { label: 'Listo para retirar', color: '#2DBD72', fondo: '#E3F7EC', icono: 'bag-check-outline' },
  en_camino: { label: 'En camino', color: '#2DBD72', fondo: '#E3F7EC', icono: 'bicycle-outline' },
  entregado: { label: 'Entregado', color: '#2B6CB0', fondo: '#E6F0FA', icono: 'checkmark-done-outline' },
  cancelado: { label: 'Cancelado', color: '#6B6B6B', fondo: '#F1F1F1', icono: 'close-circle-outline' },
  rechazado: { label: 'Rechazado', color: '#E63946', fondo: '#FDECEE', icono: 'close-circle-outline' },
};

export const MEDIOS_PAGO_NEGOCIO = [
  { key: 'efectivo', label: 'Efectivo', icono: 'cash-outline' },
  { key: 'transferencia', label: 'Transferencia', icono: 'swap-horizontal-outline' },
  { key: 'mercadopago', label: 'Mercado Pago', icono: 'phone-portrait-outline' },
  { key: 'tarjeta', label: 'Tarjeta', icono: 'card-outline' },
];
