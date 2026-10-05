/**
 * ServiciosEditor.jsx — El paseador arma sus propios tiempos de paseo
 *
 * Cada fila es un paseo que ofrece: cuántos minutos dura y cuánto cobra.
 * No hay duraciones fijas (antes eran siempre 30 y 60): arranca con una fila
 * vacía y se pueden sumar hasta SERVICIOS_MAX.
 *
 * Props:
 *   filas    [{ id, minutos: '45', precio: '7000' }] — strings, como se tipean
 *   onCambio(filas)
 *   error    texto del error (pinta los campos vacíos/incorrectos en rojo)
 *
 * filasDesdeServicios / serviciosDesdeFilas pasan de y hacia [{ minutos, precio }].
 */

import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from './PaseadorUI';
import {
  SERVICIOS_MAX, SERVICIO_MAX_MINUTOS, SERVICIO_MIN_MINUTOS, formatoPlata,
} from '../../services/paseadorApi';
import { sanitizarDigitos } from '../../utils/sanitizar';

let siguienteId = 1;
const filaVacia = () => ({ id: siguienteId++, minutos: '', precio: '' });

export function filasDesdeServicios(servicios) {
  const filas = (servicios ?? []).map((x) => ({
    id: siguienteId++, minutos: String(x.minutos), precio: String(Math.round(x.precio)),
  }));
  return filas.length ? filas : [filaVacia()];
}

export function serviciosDesdeFilas(filas) {
  return filas
    .map((f) => ({ minutos: Number(f.minutos), precio: Number(f.precio) }))
    .sort((a, b) => a.minutos - b.minutos);
}

export default function ServiciosEditor({ filas, onCambio, error }) {
  const cambiar = (id, k, v) => onCambio(filas.map((f) => (f.id === id ? { ...f, [k]: v } : f)));
  const quitar = (id) => onCambio(filas.filter((f) => f.id !== id));
  const agregar = () => onCambio([...filas, filaVacia()]);

  const minutosMal = (f) => {
    const m = Number(f.minutos);
    return !(m >= SERVICIO_MIN_MINUTOS && m <= SERVICIO_MAX_MINUTOS);
  };

  return (
    <View>
      {filas.map((f, i) => (
        <View key={f.id} style={[s.fila, i > 0 && { marginTop: 10 }]}>
          <View style={[s.caja, error && minutosMal(f) && s.cajaError]}>
            <Text style={s.cajaLabel}>Duración</Text>
            <View style={s.cajaInputRow}>
              <TextInput style={s.cajaInput} value={f.minutos} keyboardType="number-pad"
                onChangeText={(v) => cambiar(f.id, 'minutos', sanitizarDigitos(v, 3))}
                placeholder="Ej: 45" placeholderTextColor="#C8C8C8"
                accessibilityLabel={`Duración del paseo ${i + 1} en minutos`} />
              <Text style={s.cajaUnidad}>min</Text>
            </View>
          </View>
          <View style={[s.caja, error && !(Number(f.precio) > 0) && s.cajaError]}>
            <Text style={s.cajaLabel}>Precio</Text>
            <View style={s.cajaInputRow}>
              <Text style={s.signo}>$</Text>
              <TextInput style={s.cajaInput} value={f.precio} keyboardType="number-pad"
                onChangeText={(v) => cambiar(f.id, 'precio', sanitizarDigitos(v, 7))}
                placeholder="Precio" placeholderTextColor="#C8C8C8"
                accessibilityLabel={`Precio del paseo ${i + 1}`} />
            </View>
          </View>
          {filas.length > 1 ? (
            <TouchableOpacity onPress={() => quitar(f.id)} hitSlop={8} style={s.quitar}
              accessibilityLabel={`Quitar el paseo ${i + 1}`}>
              <Ionicons name="trash-outline" size={20} color={C.texto2} />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      {filas.length < SERVICIOS_MAX && (
        <TouchableOpacity style={s.agregar} onPress={agregar}>
          <Ionicons name="add-circle-outline" size={18} color={C.teal} />
          <Text style={s.agregarTxt}>Agregar otro tiempo de paseo</Text>
        </TouchableOpacity>
      )}

      {error ? <Text style={s.error}>{error}</Text> : (
        <Text style={s.ayuda}>
          {filas.some((f) => Number(f.minutos) > 0 && Number(f.precio) > 0)
            ? filas.filter((f) => Number(f.minutos) > 0 && Number(f.precio) > 0)
              .map((f) => `${f.minutos} min a ${formatoPlata(f.precio)}`).join(' · ')
            : `Vos elegís cuánto dura cada paseo (entre ${SERVICIO_MIN_MINUTOS} y ${SERVICIO_MAX_MINUTOS} minutos) y cuánto cobrás.`}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caja: {
    flex: 1, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 14, padding: 12, backgroundColor: C.fondo,
  },
  cajaError: { borderColor: C.rojo },
  cajaLabel: { fontSize: 12, fontWeight: '700', color: C.teal },
  cajaInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  cajaInput: { flex: 1, fontSize: 22, fontWeight: '900', color: C.texto, paddingVertical: 2, minWidth: 0 },
  cajaUnidad: { fontSize: 14, fontWeight: '700', color: C.texto2, marginLeft: 2 },
  signo: { fontSize: 22, fontWeight: '900', color: C.texto, marginRight: 2 },
  quitar: { width: 32, alignItems: 'center' },
  agregar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: C.teal,
  },
  agregarTxt: { fontSize: 13, fontWeight: '800', color: C.teal },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 8 },
  error: { fontSize: 12, color: C.rojo, marginTop: 8 },
});
