import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchAmigos } from '../../api/comunidad';

export default function TabAmigos({ onVerEnMapa }) {
  const [amigos, setAmigos]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAmigos().then(d => setAmigos(d.amigos || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color="#2DBD72" style={{ marginTop: 20 }} />;

  if (!amigos.length) return (
    <View style={styles.vacio}>
      <Text style={styles.vacioIco}>👥</Text>
      <Text style={styles.vacioText}>No tenés amigos agregados aún</Text>
    </View>
  );

  return (
    <FlatList
      data={amigos}
      keyExtractor={a => String(a.usuario_id)}
      renderItem={({ item: a }) => (
        <View style={styles.item}>
          <View style={[styles.avatar, { borderColor: a.online ? '#2DBD72' : '#CCCCCC' }]}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.nombre}>{a.nombre}</Text>
            <Text style={styles.sub}>{a.mascota_nombre || 'Sin mascota'}{a.distancia_km != null ? `  ·  ${a.distancia_km} km` : ''}</Text>
          </View>
          <TouchableOpacity style={styles.btnVer} onPress={() => onVerEnMapa(a)}>
            <Text style={styles.btnVerText}>Ver en mapa</Text>
          </TouchableOpacity>
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 20 }}
    />
  );
}

const styles = StyleSheet.create({
  vacio:      { alignItems: 'center', paddingTop: 32 },
  vacioIco:   { fontSize: 36, marginBottom: 8 },
  vacioText:  { color: '#6B6B6B', fontSize: 14 },
  item:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  avatar:     { width: 40, height: 40, borderRadius: 20, borderWidth: 2, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  info:       { flex: 1 },
  nombre:     { fontWeight: '700', fontSize: 14, color: '#2C2C2C' },
  sub:        { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  btnVer:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1.5, borderColor: '#2DBD72', backgroundColor: '#E8FFF2' },
  btnVerText: { fontSize: 11, color: '#2DBD72', fontWeight: '600' },
});
