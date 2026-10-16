/**
 * ModalidadCobro.jsx — "¿Cuándo te paga?" de un dueño
 *
 * Tres opciones: cada paseo / fin de semana / fin de mes. Con las dos últimas
 * los paseos se acumulan en la cuenta corriente y, al cerrarse el período, si
 * el dueño debe plata, al paseador le llega un recordatorio.
 * Se usa en la cuenta corriente y en el resumen del paseo recién terminado.
 *
 * Props: modalidad · proximoCierre (Date | null) · onCambiar(key) · titulo
 */

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from './PaseadorUI';
import { MODALIDADES_COBRO, proximoCierre as calcularCierre } from '../../services/paseadorApi';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const diaDe = (d) => `el ${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

export default function ModalidadCobro({
  modalidad = 'por_paseo', proximoCierre, onCambiar, titulo = '¿Cuándo te paga?',
}) {
  const [guardando, setGuardando] = useState(null);
  const cierre = proximoCierre ?? calcularCierre(modalidad);

  const elegir = async (key) => {
    if (key === modalidad || guardando || !onCambiar) return;
    setGuardando(key);
    try {
      await onCambiar(key);
    } finally {
      setGuardando(null);
    }
  };

  return (
    <View style={s.caja}>
      <Text style={s.titulo}>{titulo}</Text>
      <View style={s.opciones}>
        {MODALIDADES_COBRO.map((m) => {
          const on = (guardando ?? modalidad) === m.key;
          return (
            <TouchableOpacity key={m.key} style={[s.opcion, on && s.opcionOn]} onPress={() => elegir(m.key)}
              accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Ionicons name={m.icono} size={15} color={on ? '#FFF' : C.teal} />
              <Text style={[s.opcionTxt, on && { color: '#FFF' }]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={s.ayuda}>
        {cierre
          ? `Los paseos se suman a su cuenta. Si te debe, te avisamos ${diaDe(cierre)}.`
          : 'Anotá el pago cada vez que te paga. Lo que no pague queda en su cuenta.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { marginTop: 16 },
  titulo: { fontSize: 13, fontWeight: '700', color: C.texto, marginBottom: 8 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1.5, borderColor: C.menta,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF',
  },
  opcionOn: { backgroundColor: C.teal, borderColor: C.teal },
  opcionTxt: { fontSize: 13, fontWeight: '700', color: C.texto },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 8 },
});
