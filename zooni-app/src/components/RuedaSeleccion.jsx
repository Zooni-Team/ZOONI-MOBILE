/**
 * RuedaSeleccion.jsx — Columna tipo rueda y estilos compartidos de los pickers
 *
 * La usan FechaPicker (día / mes / año) y HoraPicker (hora / minuto). Cada
 * columna se abre CENTRADA en el valor elegido, así los valores de al lado
 * quedan a la vista y moverse de a uno es un toque.
 */

import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Alto fijo de cada opción: es lo que permite calcular a qué posición hay que
// saltar para dejar la seleccionada en el medio.
export const ITEM_H = 40;

export function Columna({ label, opciones, valor, onSelect, centrarToken, flex = 1 }) {
  const ref = useRef(null);
  const [alto, setAlto] = useState(0);

  const indice = opciones.findIndex((o) => o.valor === valor);
  // El índice se lee de un ref dentro del efecto: si estuviera en las
  // dependencias, la lista saltaría sola cada vez que tocás una opción.
  const indiceRef = useRef(indice);
  indiceRef.current = indice;

  useEffect(() => {
    if (alto <= 0 || indiceRef.current < 0) return;
    // Un frame de espera: el ScrollView tiene que tener aplicado el padding de
    // centrado antes de poder saltar, si no el scroll queda corto.
    const id = requestAnimationFrame(() => {
      ref.current?.scrollTo({ y: indiceRef.current * ITEM_H, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [centrarToken, alto]);

  // Relleno arriba y abajo para que la PRIMERA y la ÚLTIMA opción también
  // puedan quedar en el centro (sin esto, el 01 nunca llega al medio).
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
        {/* Guía del centro: marca dónde queda la opción elegida. No recibe
            toques para no tapar los ítems de abajo. */}
        <View style={[rs.bandaCentro, { top: relleno }]} pointerEvents="none" />
      </View>
    </View>
  );
}

export const rs = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  container:    { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  titulo:       { fontSize: 16, fontWeight: '700', color: '#2C2C2C', textAlign: 'center', marginBottom: 16 },
  // 5 opciones a la vista: la elegida al medio, con dos arriba y dos abajo
  row:          { flexDirection: 'row', gap: 8, height: 5 * ITEM_H + 26 },
  col:          { flex: 1 },
  colLabel:     { fontSize: 12, fontWeight: '600', color: '#6B6B6B', textAlign: 'center', marginBottom: 6 },
  listWrap:     { flex: 1, borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 10, overflow: 'hidden' },
  list:         { flex: 1 },
  item:         { height: ITEM_H, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  itemOn:       { backgroundColor: '#F0FFF6' },
  itemTxt:      { fontSize: 14, color: '#2C2C2C' },
  itemTxtOn:    { color: '#2DBD72', fontWeight: '700' },
  bandaCentro: {
    position: 'absolute', left: 0, right: 0, height: ITEM_H,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E8E8E8',
  },
  btns:         { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnCancel:    { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: '#F0F0F0', alignItems: 'center' },
  btnCancelTxt: { fontSize: 15, fontWeight: '700', color: '#6B6B6B' },
  btnOk:        { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: '#2DBD72', alignItems: 'center' },
  btnOkTxt:     { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
