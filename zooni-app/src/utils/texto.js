/**
 * texto.js — Helpers de texto compartidos.
 *
 * Antes había 11 funciones "normalizar" copiadas en pantallas y servicios,
 * con dos comportamientos distintos mezclados bajo el mismo nombre. Ahora
 * cada comportamiento tiene su nombre:
 *
 *   normalizarBusqueda('Veterinaría')  → 'veterinaria'   (buscar / filtrar)
 *   claveComparable('Pet-Shop Ñandú')  → 'petshopnandu'  (detectar duplicados)
 *   capitalizar('perro')               → 'Perro'
 *   escaparLike('50%_off')             → '50\\%\\_off'  (texto literal en un ilike)
 *   filtrosBusquedaPersonas('Adrian T') → condiciones .or() por palabra
 *
 * Guía: docs/claude/utilidades.md
 */

/** Minúsculas y sin tildes. Para buscar sin que importen acentos ni mayúsculas. */
export function normalizarBusqueda(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** ¿`texto` contiene `busqueda`? (ignorando tildes y mayúsculas; búsqueda vacía = sí) */
export function incluyeTexto(texto, busqueda) {
  const b = normalizarBusqueda(busqueda).trim();
  return !b || normalizarBusqueda(texto).includes(b);
}

/** Sólo letras y números, sin tildes: para comparar nombres de lugares. */
export function claveComparable(texto) {
  return normalizarBusqueda(texto).replace(/[^a-z0-9]/g, '');
}

/**
 * Texto del usuario para un `ilike`: % y _ dejan de ser comodines (y \ deja de
 * escapar), así "a_b" busca "a_b" y no "axb". El * se saca porque PostgREST
 * lo toma como sinónimo de %. Largo máximo: una búsqueda no necesita más.
 */
export function escaparLike(texto, max = 50) {
  return String(texto ?? '')
    .trim()
    .slice(0, max)
    .replace(/\*/g, '')
    .replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Buscar personas por "nombre apellido" o @usuario. Devuelve una condición
 * de PostgREST por palabra (para pasarle a `.or()`, que se encadenan con Y):
 * cada palabra tiene que aparecer en el nombre, el apellido o el @usuario.
 * Así "Adrian Turek" encuentra a Adrian Turek, y "adrian " (con espacio) es
 * lo mismo que "adrian".
 *
 * Los valores van entre comillas dobles (una coma o un paréntesis no rompen
 * la condición) y dentro de comillas PostgREST le saca una barra a cada \:
 * por eso se duplican, así el \% de escaparLike llega entero al ilike.
 */
export function filtrosBusquedaPersonas(texto, columnas = ['Nombre', 'Apellido', 'NombreUsuario']) {
  return String(texto ?? '')
    .replace(/["()]/g, ' ')
    .split(/[\s,]+/)
    .map((p) => p.replace(/^@/, ''))
    .map((p) => escaparLike(p, 30).replace(/\\/g, '\\\\'))
    .filter(Boolean)
    .slice(0, 4)
    .map((p) => columnas.map((c) => `${c}.ilike."%${p}%"`).join(','));
}

/** Primera letra en mayúscula. */
export function capitalizar(texto) {
  if (!texto) return '';
  const s = String(texto);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
