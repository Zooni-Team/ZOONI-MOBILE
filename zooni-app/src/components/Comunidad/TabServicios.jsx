import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { fetchServicios } from '../../api/comunidad';

const FILTROS = [
  { v: 'todos', l: 'Todos' }, { v: 'veterinaria', l: 'Veterinaria' },
  { v: 'paseador', l: 'Paseador' }, { v: 'petshop', l: 'Pet Shop' },
  { v: 'peluqueria', l: 'Peluquería' },
];
const EMOJIS  = { veterinaria: '🏥', paseador: '🦮', petshop: '🛍️', peluqueria: '✂️' };
const COLORES = { veterinaria: '#E63946', paseador: '#F5A623', petshop: '#F5C842', peluqueria: '#9B59B6' };

export default function TabServicios({ bbox, onSeleccionar }) {
  const [lista,  setLista]  = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!bbox) return;
      fetchServicios(bbox, filtro).then(d => setLista(d.servicios || [])).catch(() => {});
    }, 800);
    return () => clearTimeout(timer.current);
  }, [bbox, filtro]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {FILTROS.map(f => (
          <TouchableOpacity key={f.v} style={[styles.chip, filtro === f.v && styles.chipOn]} onPress={() => setFiltro(f.v)}>
            <Text style={[styles.chipText, filtro === f.v && styles.chipTextOn]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={lista}
        keyExtractor={s => String(s.id)}
        renderItem={({ item: s }) => (
          <TouchableOpacity style={styles.item} onPress={() => onSeleccionar(s)}>
            <View style={[styles.iconCircle, { backgroundColor: COLORES[s.tipo] || '#888' }]}>
              <Text style={{ fontSize: 16 }}>{EMOJIS[s.tipo] || '📍'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.nombre}>{s.nombre}</Text>
              <Text style={styles.dir}>{s.direccion}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.vacio}>No hay servicios en esta área</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chips:       { flexDirection: 'row', paddingVertical: 8, maxHeight: 50 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F5F5F5', marginRight: 8 },
  chipOn:      { backgroundColor: '#2DBD72' },
  chipText:    { fontSize: 13, color: '#6B6B6B' },
  chipTextOn:  { color: '#fff', fontWeight: '700' },
  item:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  iconCircle:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  info:        { flex: 1 },
  nombre:      { fontWeight: '700', fontSize: 14, color: '#2C2C2C' },
  dir:         { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  vacio:       { textAlign: 'center', color: '#AAAAAA', marginTop: 20 },
});
