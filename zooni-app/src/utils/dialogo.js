/**
 * dialogo.js — Alertas y confirmaciones que funcionan también en web
 *
 * Alert.alert es un NO-OP en react-native-web: los diálogos con botones nunca
 * aparecen y los flujos que navegan desde un botón del Alert quedan colgados.
 * Estos helpers usan window.alert / window.confirm en web y Alert en nativo.
 */

import { Alert, Platform } from 'react-native';

/** Aviso simple, sin botones de decisión. */
export function alerta(titulo, mensaje = '') {
  if (Platform.OS === 'web') {
    window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
    return;
  }
  Alert.alert(titulo, mensaje || undefined);
}

/**
 * Después de cualquier login: si la cuenta tenía la baja pedida, entrar la
 * canceló (login_social, MIGRACION_072). Se avisa para que no sea una sorpresa.
 */
export function avisarSiSeCanceloLaBaja(usuario) {
  if (!usuario?.bajaCancelada) return;
  alerta('Recuperaste tu cuenta', 'Cancelamos la baja que habías pedido: tu perfil y tus mascotas se ven de nuevo.');
}

/**
 * Confirmación Sí/No. Devuelve Promise<boolean>.
 * opciones: { textoOk = 'Aceptar', textoCancelar = 'Cancelar', destructivo = false }
 */
export function confirmar(titulo, mensaje = '', opciones = {}) {
  const { textoOk = 'Aceptar', textoCancelar = 'Cancelar', destructivo = false } = opciones;
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(mensaje ? `${titulo}\n\n${mensaje}` : titulo));
  }
  return new Promise((resolve) => {
    Alert.alert(titulo, mensaje || undefined, [
      { text: textoCancelar, style: 'cancel', onPress: () => resolve(false) },
      { text: textoOk, style: destructivo ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}
