import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { areaBuscable } from '../../services/lugaresApi';
import { formatoPlata, serviciosDe } from '../../services/paseadorApi';

const FILTROS = [
  { v: 'todos', l: 'Todos' }, { v: 'veterinaria', l: 'Veterinaria' },
  { v: 'paseador', l: 'Paseador' }, { v: 'petshop', l: 'Pet Shop' },
  { v: 'peluqueria', l: 'Peluquería' },
];
const ICONOS  = { veterinaria: 'medkit-outline', paseador: 'walk-outline', petshop: 'bag-outline', peluqueria: 'cut-outline' };
const COLORES = { veterinaria: '#E63946', paseador: '#F5A623', petshop: '#F5C842', peluqueria: '#9B59B6' };

// La foto de perfil del paseador (la misma del marcador del mapa); la huella
// queda sólo si no tiene o no carga.
function AvatarPaseador({ foto }) {
  const [fallo, setFallo] = useState(false);
  if (foto && !fallo) {
    return (
      <Image source={{ uri: foto }} style={[styles.iconCircle, styles.avatar]}
        referrerPolicy="no-referrer" onError={() => setFallo(true)} />
    );
  }
  return (
    <View style={[styles.iconCircle, { backgroundColor: '#2DBD72' }]}>
      <Ionicons name="paw" size={16} color="#FFF" />
    </View>
  );
}

/*
  La lista sale de lo mismo que ya cargó el mapa (ComunidadScreen) y el filtro
  se aplica acá: antes la pestaña volvía a consultar todo por su cuenta, con
  otra espera de 800 ms y otra búsqueda en OpenStreetMap, y cada cambio de
  filtro era otra vuelta. Ahora cambiar de filtro es instantáneo.
*/
export default function TabServicios({
  bbox, servicios = [], cargando = false, onSeleccionar, paseadores = [], onSeleccionarPaseador,
}) {
  const [filtro, setFiltro] = useState('todos');
  const lista = useMemo(
    () => (filtro === 'todos' ? servicios : servicios.filter((x) => x.tipo === filtro)),
    [servicios, filtro],
  );

  // Con el mapa muy alejado no se consulta al proveedor gratuito (barrería medio
  // país). Conviene decirlo en vez de mostrar "no hay servicios", que es falso.
  const demasiadoLejos = bbox && !areaBuscable(bbox);
  // Con paseadores de Zooni arriba, "No hay servicios en esta área" sobra
  const hayPaseadoresZooni = (filtro === 'todos' || filtro === 'paseador') && paseadores.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {FILTROS.map(f => (
          <TouchableOpacity key={f.v} style={[styles.chip, filtro === f.v && styles.chipOn]} onPress={() => setFiltro(f.v)}>
            <Text style={[styles.chipText, filtro === f.v && styles.chipTextOn]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* Paseadores registrados en Zooni (se contratan desde la app). Van como
          cabecera de la lista para que scrolleen con ella: fuera de la lista
          empujaban y aplastaban la fila de filtros. */}
      <FlatList
        style={{ flex: 1 }}
        ListHeaderComponent={hayPaseadoresZooni ? (
          <View style={styles.zooniBox}>
            <Text style={styles.zooniTitulo}>Paseadores de Zooni · se contratan desde la app</Text>
            {paseadores.map((p, i, arr) => (
              <TouchableOpacity key={`pz-${p.id}`}
                style={[styles.item, i === arr.length - 1 && { borderBottomWidth: 0 }]} onPress={() => onSeleccionarPaseador?.(p)}>
                <AvatarPaseador foto={p.foto} />
                <View style={styles.info}>
                  <Text style={styles.nombre} numberOfLines={1}>{p.nombreCompleto}</Text>
                  <Text style={styles.dir} numberOfLines={1}>
                    {p.zona} · {p.radioKm} km
                    {serviciosDe(p).length ? ` · desde ${formatoPlata(Math.min(...serviciosDe(p).map((x) => x.precio)))}` : ''}
                    {p.rating != null ? ` · ★ ${p.rating.toFixed(1).replace('.', ',')}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#2DBD72" />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
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
          cargando ? (
            <View style={styles.vacioBox}>
              <ActivityIndicator size="small" color="#2DBD72" />
              <Text style={styles.vacio}>Buscando lugares en esta zona…</Text>
            </View>
          ) : hayPaseadoresZooni ? null : (
            <Text style={styles.vacio}>
              {demasiadoLejos
                ? 'Acercá el mapa para ver las veterinarias y pet shops de la zona.'
                : 'No hay servicios en esta área'}
            </Text>
          )
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  zooniBox: { paddingHorizontal: 4, marginBottom: 4 },
  zooniTitulo: { fontSize: 12, fontWeight: '800', color: '#2DBD72', marginBottom: 4, marginLeft: 10 },
  // flexGrow/flexShrink 0: alto fijo, que la lista de abajo no la aplaste
  chips:       { flexDirection: 'row', paddingVertical: 8, height: 50, flexGrow: 0, flexShrink: 0 },
  chip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F5F5F5', marginRight: 8 },
  chipOn:      { backgroundColor: '#2DBD72' },
  chipText:    { fontSize: 13, color: '#6B6B6B' },
  chipTextOn:  { color: '#fff', fontWeight: '700' },
  item:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  iconCircle:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatar:      { borderWidth: 2, borderColor: '#2DBD72', backgroundColor: '#EEE' },
  info:        { flex: 1 },
  nombre:      { fontWeight: '700', fontSize: 14, color: '#2C2C2C' },
  dir:         { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta:        { fontSize: 11, color: '#6B6B6B' },
  vacio:       { textAlign: 'center', color: '#AAAAAA', marginTop: 20, fontSize: 12, lineHeight: 18, paddingHorizontal: 16 },
  vacioBox:    { alignItems: 'center', marginTop: 20, gap: 4 },
});
