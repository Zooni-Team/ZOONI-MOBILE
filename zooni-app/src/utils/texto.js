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

/** Primera letra en mayúscula. */
export function capitalizar(texto) {
  if (!texto) return '';
  const s = String(texto);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
