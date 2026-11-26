import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colores, sombras } from '../../theme';
import { useEntrada } from './useEntrada';

export default function TarjetaRegistro({
  nombre, descripcion, lineas, destacado, queEs, onEditar, onEliminar, children,
}) {
  const entrada = useEntrada();
  return (
    <Animated.View style={[s.tarjeta, entrada]}>
      <View style={s.fila}>
      <View style={s.datos}>
        <Text style={s.nombre}>{nombre}</Text>
        {descripcion ? <Text style={s.descripcion}>{descripcion}</Text> : null}
        {lineas.map((l) => (
          <Text key={l.texto} style={[s.linea, l.color && { color: l.color }]} numberOfLines={1}>{l.texto}</Text>
        ))}
        {destacado ? <Text style={[s.destacado, { color: destacado.color }]}>{destacado.texto}</Text> : null}
      </View>
      <View style={s.acciones}>
        {onEditar ? (
          <TouchableOpacity style={[s.boton, s.botonEditar]} onPress={onEditar} activeOpacity={0.8}
            accessibilityRole="button" accessibilityLabel={`Editar ${queEs} ${nombre}`}>
            <Ionicons name="create-outline" size={20} color={colores.blanco} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[s.boton, s.botonEliminar]} onPress={onEliminar} activeOpacity={0.8}
          accessibilityRole="button" accessibilityLabel={`Eliminar ${queEs} ${nombre}`}>
          <Ionicons name="trash-outline" size={20} color={colores.blanco} />
        </TouchableOpacity>
      </View>
      </View>
      {children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.blanco,
    borderRadius: 14, borderWidth: 1, borderColor: colores.gris100,
    ...sombras.sutil,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 10,
  },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  datos: { flex: 1, minWidth: 0, paddingRight: 10, gap: 3 },
  nombre: { fontSize: 14, fontWeight: '700', color: colores.texto, marginBottom: 4 },
  descripcion: { fontSize: 12, color: colores.texto, fontStyle: 'italic', marginBottom: 4 },
  linea: { fontSize: 12, color: colores.textoSecundario },
  destacado: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  acciones: { gap: 8, alignItems: 'center', justifyContent: 'center' },
  boton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...sombras.sutil },
  botonEditar: { backgroundColor: colores.turquesa },
  botonEliminar: { backgroundColor: colores.rojo },
});
