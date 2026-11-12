import { Text, View } from 'react-native';

/**
 * Envoltorio de un campo de formulario: label, el input que le pasen como
 * `children`, y debajo una ayuda (si no hay error) o el error. Antes
 * duplicado en NegocioRegistroScreen y PaseadorRegistroScreen
 * (faltaporhacer.md §2).
 *
 * @param {object} styles - el `s` de la pantalla que llama (claves: label,
 *   ayuda, errorCampo).
 */
export default function Campo({ styles: s, label, error, ayuda, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
      {ayuda && !error ? <Text style={s.ayuda}>{ayuda}</Text> : null}
      {error ? <Text style={s.errorCampo}>{error}</Text> : null}
    </View>
  );
}
