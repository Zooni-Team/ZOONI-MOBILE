let reloadMatchAfterFilters = false;

export function markMatchReloadFromFilters() {
  reloadMatchAfterFilters = true;
}

export function consumeMatchReloadFromFilters() {
  const should = reloadMatchAfterFilters;
  reloadMatchAfterFilters = false;
  return should;
}
