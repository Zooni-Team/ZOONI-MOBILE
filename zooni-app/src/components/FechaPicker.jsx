/**
 * FechaPicker.jsx — Selector de fecha (día / mes / año) en un modal propio
 *
 * @react-native-community/datetimepicker no está instalado, así que la app usa
 * este picker de tres columnas. Estaba copiado y pegado en Vacunas,
 * Tratamientos y Consultas con variantes mínimas (el rango de años); acá queda
 * uno solo, parametrizable, para que las pantallas se vean y se comporten
 * igual. También lo usa el Paso 2 del registro para la fecha de nacimiento.
 *
 * Props:
 *   visible, titulo, valor (Date), onConfirmar(Date), onCancelar
 *   aniosAtras   — cuántos años hacia atrás ofrece la lista (default 20)
 *   aniosAdelante— cuántos hacia adelante (default 0; Tratamientos usa 5)
 */

import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Date → "2026-8-14": identifica el día sin depender del objeto Date. */
function toClave(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function FechaPicker({
  visible, titulo, valor, onConfirmar, onCancelar,
  aniosAtras = 20, aniosAdelante = 0,
}) {
  const hoy = new Date();
  const hoyAnio = hoy.getFullYear();

  const inicial = valor ?? hoy;
  const [dia,  setDia]  = useState(inicial.getDate());
  const [mes,  setMes]  = useState(inicial.getMonth() + 1);
  const [anio, setAnio] = useState(inicial.getFullYear());

  /*
    Cada vez que se ABRE, el picker vuelve a la fecha que corresponde: la
    guardada si el campo ya tiene uno, o el día de HOY si está vacío.

    Antes el efecto solo corría `if (valor)`, así que con el campo vacío
    quedaban los números de la última vez que se abrió (o los del montaje, que
    podían ser de días atrás si la app quedó abierta) — de ahí que apareciera
    "una fecha cualquiera". Se calcula `hoy` en el momento de abrir, no al
    montar la pantalla, para que a la medianoche también sea el día correcto.
  */
  useEffect(() => {
    if (!visible) return;
    const v = valor ?? new Date();
    setDia(v.getDate());
    setMes(v.getMonth() + 1);
    setAnio(v.getFullYear());
    // `valor` se compara por día calendario y no por identidad: los llamadores
    // pasan `formFecha ?? new Date()`, que es un objeto nuevo en cada render y
    // reiniciaría la selección del usuario en pleno uso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, valor ? toClave(valor) : null]);

  const diasEnMes = new Date(anio, mes, 0).getDate();
  const dias  = Array.from({ length: diasEnMes }, (_, i) => i + 1);
  // Del más reciente al más viejo: lo habitual es elegir una fecha cercana
  const anios = Array.from(
    { length: aniosAtras + aniosAdelante + 1 },
    (_, i) => hoyAnio + aniosAdelante - i,
  );

  const confirmar = () => onConfirmar(new Date(anio, mes - 1, Math.min(dia, diasEnMes)));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <View style={fp.overlay}>
        <View style={fp.container}>
          <Text style={fp.titulo}>{titulo}</Text>
          <View style={fp.row}>
            <View style={fp.col}>
              <Text style={fp.colLabel}>Día</Text>
              <ScrollView style={fp.list} showsVerticalScrollIndicator={false}>
                {dias.map((d) => (
                  <TouchableOpacity key={d} style={[fp.item, dia === d && fp.itemOn]} onPress={() => setDia(d)}>
                    <Text style={[fp.itemTxt, dia === d && fp.itemTxtOn]}>{String(d).padStart(2, '0')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={[fp.col, { flex: 2 }]}>
              <Text style={fp.colLabel}>Mes</Text>
              <ScrollView style={fp.list} showsVerticalScrollIndicator={false}>
                {MESES.map((m, i) => (
                  <TouchableOpacity key={m} style={[fp.item, mes === i + 1 && fp.itemOn]} onPress={() => setMes(i + 1)}>
                    <Text style={[fp.itemTxt, mes === i + 1 && fp.itemTxtOn]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={fp.col}>
              <Text style={fp.colLabel}>Año</Text>
              <ScrollView style={fp.list} showsVerticalScrollIndicator={false}>
                {anios.map((a) => (
                  <TouchableOpacity key={a} style={[fp.item, anio === a && fp.itemOn]} onPress={() => setAnio(a)}>
                    <Text style={[fp.itemTxt, anio === a && fp.itemTxtOn]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={fp.btns}>
            <TouchableOpacity style={fp.btnCancel} onPress={onCancelar}>
              <Text style={fp.btnCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fp.btnOk} onPress={confirmar}>
              <Text style={fp.btnOkTxt}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const fp = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  container:    { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  titulo:       { fontSize: 16, fontWeight: '700', color: '#2C2C2C', textAlign: 'center', marginBottom: 16 },
  row:          { flexDirection: 'row', gap: 8, height: 180 },
  col:          { flex: 1 },
  colLabel:     { fontSize: 12, fontWeight: '600', color: '#6B6B6B', textAlign: 'center', marginBottom: 6 },
  list:         { flex: 1, borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 10 },
  item:         { paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  itemOn:       { backgroundColor: '#F0FFF6' },
  itemTxt:      { fontSize: 14, color: '#2C2C2C' },
  itemTxtOn:    { color: '#2DBD72', fontWeight: '700' },
  btns:         { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnCancel:    { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: '#F0F0F0', alignItems: 'center' },
  btnCancelTxt: { fontSize: 15, fontWeight: '700', color: '#6B6B6B' },
  btnOk:        { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: '#2DBD72', alignItems: 'center' },
  btnOkTxt:     { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
