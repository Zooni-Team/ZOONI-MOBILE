/**
 * CampoFormulario.jsx — Piezas de formulario compartidas por los registros de
 * Negocio y de Paseador (antes cada pantalla tenía su copia).
 *
 *   <Campo label="Email" error={errores.email} ayuda="Lo usás para entrar">
 *     <TextInput style={estilosCampo.input} … />
 *   </Campo>
 *   <InputPassword value={…} onChangeText={…} placeholder="Contraseña" error={!!errores.pass} />
 *
 * `estilosCampo.input` / `.inputError` sirven para los TextInput comunes que
 * van adentro de un Campo, así todos los bordes quedan iguales.
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colores } from '../../theme';
import { C } from '../paseador/PaseadorUI';

/** Rótulo + control + ayuda (si no hay error) + mensaje de error. */
export function Campo({ label, error, ayuda, children }) {
  return (
    <View style={estilosCampo.campo}>
      <Text style={estilosCampo.label}>{label}</Text>
      {children}
      {ayuda && !error ? <Text style={estilosCampo.ayuda}>{ayuda}</Text> : null}
      {error ? <Text style={estilosCampo.error}>{error}</Text> : null}
    </View>
  );
}

/** Contraseña nueva con el ojito para mostrarla. */
export function InputPassword({ value, onChangeText, placeholder, error }) {
  const [ver, setVer] = useState(false);
  return (
    <View style={[estilosCampo.input, estilosCampo.passWrap, error && estilosCampo.inputError]}>
      <TextInput style={estilosCampo.pass} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={C.gris}
        secureTextEntry={!ver} autoCapitalize="none" autoCorrect={false}
        autoComplete="new-password" textContentType="newPassword" />
      <TouchableOpacity onPress={() => setVer((v) => !v)} hitSlop={8}
        accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        <Ionicons name={ver ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.texto2} />
      </TouchableOpacity>
    </View>
  );
}

export const estilosCampo = StyleSheet.create({
  campo: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colores.gris500, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.texto, backgroundColor: colores.blanco,
  },
  inputError: { borderColor: C.rojo },
  passWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
  pass: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.texto },
  error: { fontSize: 12, color: C.rojo, marginTop: 4 },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 4 },
});
