/**
 * HorariosEditor.jsx — Días y horarios de atención de un negocio
 *
 * Una fila por día: abierto / cerrado y de qué hora a qué hora (con la misma
 * rueda de HoraPicker que el resto de la app). Con estos horarios se arman
 * los turnos libres que ve el dueño y el "Abierto ahora" de la ficha.
 *
 * Props: valor { lun: { activo, desde, hasta }, … } · onCambio(valor) · error
 * Opcionales (los usa el paseador): base (horarios por defecto) · inactivo
 * (texto de un día sin horario) · etiquetas { desde, hasta } del selector.
 */

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../paseador/PaseadorUI';
import HoraPicker from '../HoraPicker';
import { DIAS_SEMANA, HORARIOS_NEGOCIO_DEFAULT } from '../../constants/negocios';
import { minutosDe } from '../../services/negocioApi';

const aFecha = (hhmm) => {
  const d = new Date();
  const [h, m] = String(hhmm).split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};
const aTexto = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Devuelve el primer problema de los horarios o null. */
export function validarHorarios(horarios) {
  const dias = DIAS_SEMANA.map((d) => ({ ...d, h: horarios?.[d.key] })).filter((d) => d.h?.activo);
  if (!dias.length) return 'Es necesario abrir al menos un día';
  const malo = dias.find((d) => minutosDe(d.h.hasta) <= minutosDe(d.h.desde));
  return malo ? `El ${malo.label.toLowerCase()} cierra antes de abrir` : null;
}

export default function HorariosEditor({
  valor, onCambio, error, base, inactivo = 'Cerrado', etiquetas = { desde: 'abre', hasta: 'cierra' },
}) {
  const horarios = { ...(base ?? HORARIOS_NEGOCIO_DEFAULT()), ...(valor ?? {}) };
  const [picker, setPicker] = useState(null); // { dia, campo }

  const cambiar = (dia, cambios) => onCambio({ ...horarios, [dia]: { ...horarios[dia], ...cambios } });

  const copiarLunes = () => {
    const lun = horarios.lun;
    const nuevo = { ...horarios };
    ['mar', 'mie', 'jue', 'vie'].forEach((k) => { nuevo[k] = { ...lun }; });
    onCambio(nuevo);
  };

  return (
    <View>
      {DIAS_SEMANA.map((d) => {
        const h = horarios[d.key];
        const malo = h.activo && minutosDe(h.hasta) <= minutosDe(h.desde);
        return (
          <View key={d.key} style={s.fila}>
            <TouchableOpacity style={s.dia} onPress={() => cambiar(d.key, { activo: !h.activo })}
              accessibilityRole="switch" accessibilityState={{ checked: h.activo }}
              accessibilityLabel={`${d.label}: ${h.activo ? `${h.desde} a ${h.hasta}` : inactivo.toLowerCase()}`}>
              <Ionicons name={h.activo ? 'checkbox' : 'square-outline'} size={22} color={h.activo ? C.teal : C.gris} />
              <Text style={[s.diaTxt, !h.activo && { color: C.texto2 }]}>{d.corto}</Text>
            </TouchableOpacity>
            {h.activo ? (
              <View style={s.horas}>
                <TouchableOpacity style={[s.hora, malo && s.horaMal]} onPress={() => setPicker({ dia: d.key, campo: 'desde' })}>
                  <Text style={s.horaTxt}>{h.desde}</Text>
                </TouchableOpacity>
                <Text style={s.a}>a</Text>
                <TouchableOpacity style={[s.hora, malo && s.horaMal]} onPress={() => setPicker({ dia: d.key, campo: 'hasta' })}>
                  <Text style={s.horaTxt}>{h.hasta}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={s.cerrado}>{inactivo}</Text>
            )}
          </View>
        );
      })}
      <TouchableOpacity style={s.copiar} onPress={copiarLunes}>
        <Ionicons name="copy-outline" size={15} color={C.teal} />
        <Text style={s.copiarTxt}>Usar el horario del lunes de martes a viernes</Text>
      </TouchableOpacity>
      {error ? <Text style={s.error}>{error}</Text> : null}

      <HoraPicker
        visible={!!picker}
        titulo={picker ? `${DIAS_SEMANA.find((x) => x.key === picker.dia)?.label} · ${etiquetas[picker.campo]}` : ''}
        valor={picker ? aFecha(horarios[picker.dia][picker.campo]) : new Date()}
        onConfirmar={(f) => { cambiar(picker.dia, { [picker.campo]: aTexto(f) }); setPicker(null); }}
        onCancelar={() => setPicker(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  fila: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F2F2F2',
  },
  dia: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 80, minHeight: 40 },
  diaTxt: { fontSize: 15, fontWeight: '800', color: C.texto },
  horas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hora: {
    borderWidth: 1.5, borderColor: C.menta, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  horaMal: { borderColor: C.rojo },
  horaTxt: { fontSize: 15, fontWeight: '800', color: C.texto, fontVariant: ['tabular-nums'] },
  a: { fontSize: 13, color: C.texto2 },
  cerrado: { fontSize: 14, fontWeight: '700', color: C.gris },
  copiar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, minHeight: 36 },
  copiarTxt: { fontSize: 13, fontWeight: '700', color: C.teal },
  error: { fontSize: 12, color: C.rojo, marginTop: 6 },
});
