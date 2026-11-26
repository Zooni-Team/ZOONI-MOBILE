import {
  MODO_DUENO, MODO_PASEADOR, modoNegocio, setModo, tipoNegocioDeModo,
} from '../config/session';

export function cantidadDeApps(roles) {
  if (!roles) return 0;
  return (roles.esDueno ? 1 : 0) + (roles.esPaseador ? 1 : 0) + (roles.negocios?.length ?? 0);
}

export async function rutaSegunRoles(roles, modoGuardado = MODO_DUENO) {
  if (!roles) {
    const tipo = tipoNegocioDeModo(modoGuardado);
    if (tipo) return ['NegocioApp', { tipo }];
    return [modoGuardado === MODO_PASEADOR ? 'PaseadorApp' : 'Home'];
  }
  if (cantidadDeApps(roles) > 1) return ['ElegirModo', { tienePerfil: roles.tienePerfil }];
  if (roles.esPaseador) {
    await setModo(MODO_PASEADOR);
    return roles.tienePerfil ? ['PaseadorApp'] : ['PaseadorRegistro', { completar: true }];
  }
  if (roles.negocios?.length === 1) {
    const { tipo } = roles.negocios[0];
    await setModo(modoNegocio(tipo));
    return ['NegocioApp', { tipo }];
  }
  await setModo(MODO_DUENO);
  return ['Home'];
}
