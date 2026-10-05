/**
 * volverOLogin.js — "Volver" seguro
 *
 * Cuando la app se abre directo en una pantalla de registro (al volver de
 * Google / Facebook / Apple) no hay nada atrás en el historial: goBack() no
 * haría nada. En ese caso se vuelve al login.
 */
export function volverOLogin(navigation, login = 'Login') {
  if (navigation.canGoBack()) navigation.goBack();
  else navigation.reset({ index: 0, routes: [{ name: login }] });
}
