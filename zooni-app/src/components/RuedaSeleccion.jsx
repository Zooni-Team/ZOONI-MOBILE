import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colores } from '../theme';

export const ITEM_H = 40;

export function Columna({ label, opciones, valor, onSelect, centrarToken, flex = 1 }) {
  const ref = useRef(null);
  const [alto, setAlto] = useState(0);

  const indice = opciones.findIndex((o) => o.valor === valor);
  const indiceRef = useRef(indice);
  indiceRef.current = indice;

  useEffect(() => {
    if (alto <= 0 || indiceRef.current < 0) return;
    const id = requestAnimationFrame(() => {
      ref.current?.scrollTo({ y: indiceRef.current * ITEM_H, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [centrarToken, alto]);

  const relleno = Math.max(0, (alto - ITEM_H) / 2);

  return (
    <View style={[rs.col, { flex }]}>
      <Text style={rs.colLabel}>{label}</Text>
      <View style={rs.listWrap}>
        <ScrollView
          ref={ref}
          style={rs.list}
          onLayout={(e) => setAlto(e.nativeEvent.layout.height)}
          contentContainerStyle={{ paddingVertical: relleno }}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
        >
          {opciones.map((o) => (
            <TouchableOpacity
              key={o.valor}
              style={[rs.item, o.valor === valor && rs.itemOn]}
              onPress={() => onSelect(o.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: o.valor === valor }}
            >
              <Text style={[rs.itemTxt, o.valor === valor && rs.itemTxtOn]}>{o.texto}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={[rs.bandaCentro, { top: relleno }]} pointerEvents="none" />
      </View>
    </View>
  );
}

export const rs = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  container:    { backgroundColor: colores.blanco, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  titulo:       { fontSize: 16, fontWeight: '700', color: colores.texto, textAlign: 'center', marginBottom: 16 },
  row:          { flexDirection: 'row', gap: 8, height: 5 * ITEM_H + 26 },
  col:          { flex: 1 },
  colLabel:     { fontSize: 12, fontWeight: '600', color: colores.textoSecundario, textAlign: 'center', marginBottom: 6 },
  listWrap:     { flex: 1, borderWidth: 1, borderColor: colores.gris100, borderRadius: 10, overflow: 'hidden' },
  list:         { flex: 1 },
  item:         { height: ITEM_H, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  itemOn:       { backgroundColor: colores.mentaFondo },
  itemTxt:      { fontSize: 14, color: colores.texto },
  itemTxtOn:    { color: colores.verde, fontWeight: '700' },
  bandaCentro: {
    position: 'absolute', left: 0, right: 0, height: ITEM_H,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colores.gris200,
  },
  btns:         { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnCancel:    { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: colores.gris100, alignItems: 'center' },
  btnCancelTxt: { fontSize: 15, fontWeight: '700', color: colores.textoSecundario },
  btnOk:        { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: colores.verde, alignItems: 'center' },
  btnOkTxt:     { fontSize: 15, fontWeight: '700', color: colores.blanco },
});
