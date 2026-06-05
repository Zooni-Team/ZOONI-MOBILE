import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { fetchServicios } from '../api/comunidad';
import useDebounce from '../hooks/useDebounce';

const FILTROS = ['todos', 'veterinaria', 'paseador', 'petshop', 'peluqueria'];
const FILTRO_LABELS = {
  todos: 'Todos', veterinaria: 'Veterinaria', paseador: 'Paseador',
  petshop: 'Pet Shop', peluqueria: 'Peluquería',
};
const COLORES = {
  veterinaria: '#E63946', paseador: '#F5A623',
  petshop: '#F5C842', peluqueria: '#9B59B6',
};

export default function TabServicios({ bbox, onSeleccionarServicio }) {
  const [servicios, setServicios] = useState([]);
  const [filtro, setFiltro]       = useState('todos');

  const cargar = useDebounce((b, f) => {
    if (!b) return;
    fetchServicios(b, f)
      .then((d) => setServicios(d.servicios || []))
      .catch(() => {});
  }, 800);

  useEffect(() => { cargar(bbox, filtro); }, [bbox, filtro]);

  return (
    <View style={{ flex: 1 }}>
      {/* Chips de filtro */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
        {FILTROS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filtro === f && styles.chipActivo]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.chipText, filtro === f && styles.chipTextoActivo]}>
              {FILTRO_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={servicios}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => onSeleccionarServicio(item)}
            accessibilityLabel={`${item.tipo}: ${item.nombre}`}
          >
            <View style={[styles.iconCircle, { backgroundColor: COLORES[item.tipo] || '#888' }]}>
              <Text style={{ fontSize: 16 }}>
                {item.tipo === 'veterinaria' ? '🏥' :
                 item.tipo === 'paseador'    ? '🦮' :
                 item.tipo === 'petshop'     ? '🛍️' : '✂️'}
              </Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <Text style={styles.dir}>{item.direccion}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.vacio}>No hay servicios en esta área</Text>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chipsRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 2, maxHeight: 52 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    height: 34,
    justifyContent: 'center',
  },
  chipActivo: { backgroundColor: '#2DBD72' },
  chipText: { fontSize: 13, color: '#6B6B6B' },
  chipTextoActivo: { color: '#fff', fontWeight: 'bold' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  info: { flex: 1 },
  nombre: { fontWeight: 'bold', fontSize: 14, color: '#2C2C2C' },
  dir:    { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  vacio:  { textAlign: 'center', color: '#AAAAAA', marginTop: 20 },
});
