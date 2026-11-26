import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';

import { useMisMascotas } from '../hooks/useMisMascotas';
import { colores } from '../theme';

export default function SelectorMascota({
  valor,
  onCambiar,
  mascotas: mascotasProp,
  deshabilitado = false,
  style,
}) {
  const { mascotas: mascotasPropias } = useMisMascotas();
  const gestionaLista = mascotasProp == null;
  const mascotas = mascotasProp ?? mascotasPropias;

  useEffect(() => {
    if (!gestionaLista || valor != null || !mascotas.length) return;
    onCambiar?.((mascotas.find((m) => m.esActiva) ?? mascotas[0]).id);
  }, [gestionaLista, valor, mascotas, onCambiar]);

  if (mascotas.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[s.tira, style]}
      contentContainerStyle={s.contenido}
    >
      {mascotas.map((m) => {
        const activa = valor === m.id;
        return (
          <TouchableOpacity
            key={m.id}
            style={[s.pastilla, activa && s.pastillaOn]}
            onPress={() => onCambiar?.(m.id)}
            disabled={deshabilitado}
            accessibilityRole="button"
            accessibilityState={{ selected: activa, disabled: deshabilitado }}
            accessibilityLabel={`Ver los datos de ${m.nombre}`}
          >
            <Text style={[s.txt, activa && s.txtOn]} numberOfLines={1} selectable={false}>{m.nombre}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tira: { flexGrow: 0 },
  contenido: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  pastilla: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1.5, borderColor: 'transparent',
    flexShrink: 0,
  },
  pastillaOn: { backgroundColor: colores.blanco, borderColor: colores.verde },
  txt: {
    fontSize: 13, color: colores.textoSecundario, fontWeight: '600', maxWidth: 130,
    pointerEvents: 'none', userSelect: 'none',
  },
  txtOn: { color: colores.verde, fontWeight: '700' },
});
