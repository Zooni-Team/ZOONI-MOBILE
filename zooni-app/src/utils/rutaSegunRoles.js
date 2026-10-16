/**
 * rutaSegunRoles.js — A qué "app" entra una cuenta
 *
 * Una cuenta puede ser dueño, paseador y tener uno o más negocios. Esta
 * decisión estaba repetida en el arranque (App.jsx), el login de dueños y la
 * vuelta del login social; ahora vive acá y contempla los negocios (046):
 *
 *   · más de una app            → "¿Cómo querés entrar hoy?" (ElegirModo)
 *   · sólo paseador             → Zooni Paseadores (o completar el perfil)
 *   · sólo un negocio           → la app de ese negocio
 *   · sólo dueño / nada         → Home
 *   · sin roles (sin red)       → el último modo guardado
 *
 * Deja guardado el modo con el que entra. Devuelve [ruta, params].
 */

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
