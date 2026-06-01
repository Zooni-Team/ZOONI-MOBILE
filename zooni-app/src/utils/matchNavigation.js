/** Flag para recargar Match al volver desde Filtros (params no siempre funcionan en web). */
let reloadMatchAfterFilters = false;

export function markMatchReloadFromFilters() {
  reloadMatchAfterFilters = true;
}

export function consumeMatchReloadFromFilters() {
  const should = reloadMatchAfterFilters;
  reloadMatchAfterFilters = false;
  return should;
}
