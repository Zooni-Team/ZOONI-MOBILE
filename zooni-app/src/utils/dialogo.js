import { Alert, Platform } from 'react-native';

export function alerta(titulo, mensaje = '') {
  if (Platform.OS === 'web') {
    window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
    return;
  }
  Alert.alert(titulo, mensaje || undefined);
}

export function avisarSiSeCanceloLaBaja(usuario) {
  if (!usuario?.bajaCancelada) return;
  alerta('Recuperaste tu cuenta', 'Cancelamos la baja que habías pedido: tu perfil y tus mascotas se ven de nuevo.');
}

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
