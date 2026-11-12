import { useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Input de contraseña con el ojito para mostrarla u ocultarla. Antes
 * duplicado en NegocioRegistroScreen y PaseadorRegistroScreen
 * (faltaporhacer.md §2).
 *
 * @param {object} styles - el `s` de la pantalla que llama (claves: input,
 *   inputPassWrap, inputError, inputPass).
 * @param {object} colores - la paleta de la pantalla que llama (claves: gris,
 *   texto2).
 */
export default function InputPassword({ styles: s, colores: C, value, onChangeText, placeholder, error }) {
  const [ver, setVer] = useState(false);
  return (
    <View style={[s.input, s.inputPassWrap, error && s.inputError]}>
      <TextInput
        style={s.inputPass}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.gris}
        secureTextEntry={!ver}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TouchableOpacity
        onPress={() => setVer((v) => !v)}
        hitSlop={8}
        accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        <Ionicons name={ver ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.texto2} />
      </TouchableOpacity>
    </View>
  );
}
