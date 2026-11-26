export function normalizarBusqueda(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function incluyeTexto(texto, busqueda) {
  const b = normalizarBusqueda(busqueda).trim();
  return !b || normalizarBusqueda(texto).includes(b);
}

export function claveComparable(texto) {
  return normalizarBusqueda(texto).replace(/[^a-z0-9]/g, '');
}

export function escaparLike(texto, max = 50) {
  return String(texto ?? '')
    .trim()
    .slice(0, max)
    .replace(/\*/g, '')
    .replace(/[\\%_]/g, (c) => `\\${c}`);
}

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

export function capitalizar(texto) {
  if (!texto) return '';
  const s = String(texto);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
