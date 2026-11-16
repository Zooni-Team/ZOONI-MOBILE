/**
 * ModalFormulario.jsx — Ventana centrada con un formulario corto: título, los
 * campos (hijos), "Guardar" y "Cancelar". La usan Vacunas y Tratamientos.
 *
 * También exporta CampoTexto y CampoFecha para que los dos formularios tengan
 * los mismos bordes, el mismo foco y el mismo lugar para el error.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Keyboard, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatearFecha } from '../../utils/fechaLocal';
import { colores, sombras } from '../../theme';

const PANTALLA = Dimensions.get('window');
const ANCHO = Math.min(PANTALLA.width * 0.88, 360);

/**
 * @param {boolean}  visible
 * @param {string}   titulo
 * @param {string}   textoGuardar   "Guardar" / "Guardar cambios"
 * @param {boolean}  guardando      deshabilita y muestra el spinner
 * @param {string}   [error]        por qué no se pudo guardar (se ve arriba de los botones:
 *                                  un Toast de la pantalla quedaría tapado por el modal)
 */
export default function ModalFormulario({ visible, titulo, textoGuardar = 'Guardar', guardando, error, onGuardar, onCerrar, children }) {
  // `montado` sigue en true mientras dura la animación de salida.
  const [montado, setMontado] = useState(visible);
  const escala = useRef(new Animated.Value(0.92)).current;
  const opacidad = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMontado(true);
      Animated.parallel([
        Animated.timing(escala, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(opacidad, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      return;
    }
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(escala, { toValue: 0.92, duration: 160, useNativeDriver: true }),
      Animated.timing(opacidad, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => setMontado(false));
  }, [visible, escala, opacidad]);

  return (
    <Modal visible={montado} transparent animationType="none" onRequestClose={onCerrar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        {/* Tocar afuera cierra; tocar la tarjeta no. */}
        <TouchableOpacity style={s.fondo} activeOpacity={1} onPress={onCerrar} accessible={false}>
          <TouchableOpacity activeOpacity={1} accessible={false}>
            <Animated.View style={[s.tarjeta, { transform: [{ scale: escala }], opacity: opacidad }]}>
              {/* flexShrink: 1 y no flex: 1: la tarjeta mide lo que mide el
                  formulario y sólo desplaza si no entra en la pantalla. */}
              <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={s.titulo} accessibilityRole="header">{titulo}</Text>
                {children}
                {error ? <Text style={s.errorGeneral} accessibilityRole="alert">{error}</Text> : null}
              </ScrollView>
              {/* Los botones van fuera del scroll: siempre a la vista. */}
              <View style={s.pie}>
                <TouchableOpacity style={s.btnCancelar} onPress={onCerrar} disabled={guardando}
                  activeOpacity={0.85} accessibilityRole="button">
                  <Text style={s.btnCancelarTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnGuardar, guardando && s.btnOcupado]} onPress={onGuardar}
                  disabled={guardando} activeOpacity={0.85} accessibilityRole="button">
                  {guardando
                    ? <ActivityIndicator size="small" color={colores.blanco} />
                    : <Text style={s.btnGuardarTxt}>{textoGuardar}</Text>}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** TextInput con rótulo, borde verde al enfocar y el error debajo. */
export function CampoTexto({ etiqueta, error, multilinea, bloqueado, style, ...props }) {
  const [enfocado, setEnfocado] = useState(false);
  return (
    <View style={s.campo}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <TextInput
        style={[s.input, multilinea && s.inputMulti, enfocado && s.inputFoco, bloqueado && s.inputBloqueado, error && s.inputError, style]}
        placeholderTextColor={colores.textoSecundario}
        accessibilityLabel={etiqueta}
        editable={!bloqueado}
        multiline={multilinea}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        {...props}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

/** Campo que abre el FechaPicker de la pantalla. `valor` es un Date o null. */
export function CampoFecha({ etiqueta, valor, vacio = 'Elegir fecha', error, onAbrir }) {
  return (
    <View style={s.campo}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <TouchableOpacity style={[s.input, s.inputFecha, error && s.inputError]} onPress={onAbrir} activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${valor ? formatearFecha(valor) : 'sin elegir'}`}>
        <Text style={[s.fechaTxt, !valor && s.fechaVacia]}>{valor ? formatearFecha(valor) : vacio}</Text>
        <Ionicons name="calendar-outline" size={18} color={colores.textoSecundario} />
      </TouchableOpacity>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center' },
  tarjeta: {
    backgroundColor: colores.blanco, borderRadius: 20, width: ANCHO,
    // En píxeles y no en '%': el porcentaje se resuelve contra un padre de alto
    // automático y la tarjeta terminaba recortando el final del formulario.
    maxHeight: PANTALLA.height * 0.9,
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 18,
    ...sombras.modal,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  titulo: { fontSize: 18, fontWeight: '700', color: colores.verdeOscuro, textAlign: 'center', marginBottom: 20 },

  campo: { marginBottom: 12 },
  etiqueta: { fontSize: 13, fontWeight: '700', color: colores.texto, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: colores.gris300, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
    fontSize: 14, color: colores.texto, backgroundColor: colores.blanco,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  inputFoco: { borderColor: colores.verde },
  inputBloqueado: { backgroundColor: colores.gris50 },
  inputError: { borderColor: colores.rojo },
  inputFecha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fechaTxt: { flex: 1, fontSize: 14, color: colores.texto },
  fechaVacia: { color: colores.textoSecundario },
  error: { fontSize: 12, color: colores.rojo, marginTop: 4, marginLeft: 4 },
  errorGeneral: {
    fontSize: 13, color: colores.rojoOscuro, backgroundColor: colores.rojoFondo,
    borderRadius: 10, padding: 10, textAlign: 'center',
  },

  pie: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: colores.gris100,
  },
  btnGuardar: {
    flex: 1, height: 48, borderRadius: 30,
    backgroundColor: colores.verde, alignItems: 'center', justifyContent: 'center',
    ...sombras.suave,
  },
  btnOcupado: { opacity: 0.7 },
  btnGuardarTxt: { fontSize: 15, fontWeight: '700', color: colores.blanco },
  btnCancelar: {
    height: 48, paddingHorizontal: 22, borderRadius: 30,
    backgroundColor: colores.gris100, alignItems: 'center', justifyContent: 'center',
  },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: colores.textoSecundario },
});
