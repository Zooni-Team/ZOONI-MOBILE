import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchServicios } from '../../api/comunidad';
import { hayClaveGoogle } from '../../services/lugaresApi';

const FILTROS = [
  { v: 'todos', l: 'Todos' }, { v: 'veterinaria', l: 'Veterinaria' },
  { v: 'paseador', l: 'Paseador' }, { v: 'petshop', l: 'Pet Shop' },
  { v: 'peluqueria', l: 'Peluquería' },
];
const ICONOS  = { veterinaria: 'medkit-outline', paseador: 'walk-outline', petshop: 'bag-outline', peluqueria: 'cut-outline' };
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
              <Ionicons name={ICONOS[s.tipo] || 'location-outline'} size={16} color="#FFF" />
            </View>
            <View style={styles.info}>
              <Text style={styles.nombre} numberOfLines={1}>{s.nombre}</Text>
              <Text style={styles.dir} numberOfLines={1}>{s.direccion}</Text>
              {/* Puntaje y estado solo existen en los locales traídos de Google */}
              {(s.rating != null || s.abiertoAhora != null) && (
                <View style={styles.metaRow}>
                  {s.rating != null && (
                    <View style={styles.metaItem}>
                      <Ionicons name="star" size={11} color="#F5A623" />
                      <Text style={styles.meta}>
                        {s.rating.toFixed(1)}{s.ratingCount ? ` (${s.ratingCount})` : ''}
                      </Text>
                    </View>
                  )}
                  {s.abiertoAhora != null && (
                    <Text style={[styles.meta, { color: s.abiertoAhora ? '#2DBD72' : '#E63946', fontWeight: '600' }]}>
                      {s.abiertoAhora ? 'Abierto ahora' : 'Cerrado'}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {hayClaveGoogle()
              ? 'No hay servicios en esta área'
              : 'No hay servicios cargados en esta área.\nConfigurá EXPO_PUBLIC_GOOGLE_MAPS_API_KEY para ver los negocios reales de Google Maps.'}
          </Text>
        }
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
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta:        { fontSize: 11, color: '#6B6B6B' },
  vacio:       { textAlign: 'center', color: '#AAAAAA', marginTop: 20, fontSize: 12, lineHeight: 18, paddingHorizontal: 16 },
});
