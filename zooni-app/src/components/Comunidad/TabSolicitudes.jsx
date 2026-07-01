import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchSolicitudes, responderSolicitud } from '../../api/comunidad';

export default function TabSolicitudes({ onRespuesta }) {
  const [lista,   setLista]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSolicitudes().then(d => setLista(d.solicitudes || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const responder = async (id, accion) => {
    try {
      await responderSolicitud(id, accion);
      setLista(prev => prev.filter(s => s.id !== id));
      if (accion === 'aceptar' && onRespuesta) onRespuesta();
    } catch {}
  };

  if (loading) return <ActivityIndicator color="#2DBD72" style={{ marginTop: 20 }} />;
  if (!lista.length) return (
    <View style={styles.vacio}>
      <Ionicons name="notifications-outline" size={34} color="#CCCCCC" style={{ marginBottom: 8 }} />
      <Text style={styles.vacioText}>No tenés solicitudes pendientes</Text>
    </View>
  );

  return (
    <FlatList
      data={lista}
      keyExtractor={s => String(s.id)}
      renderItem={({ item: s }) => (
        <View style={styles.item}>
          <View style={styles.avatar}><Ionicons name="person" size={18} color="#AAAAAA" /></View>
          <Text style={styles.nombre}>{s.nombre}</Text>
          <View style={styles.btns}>
            <TouchableOpacity style={styles.btnAc} onPress={() => responder(s.id, 'aceptar')}>
              <Ionicons name="checkmark" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnRe} onPress={() => responder(s.id, 'rechazar')}>
              <Ionicons name="close" size={18} color="#E63946" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 20 }}
    />
  );
}

const styles = StyleSheet.create({
  vacio:     { alignItems: 'center', paddingTop: 32 },
  vacioText: { color: '#6B6B6B', fontSize: 14 },
  item:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  avatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  nombre:    { flex: 1, fontWeight: '700', fontSize: 14, color: '#2C2C2C' },
  btns:      { flexDirection: 'row', gap: 8 },
  btnAc:     { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2DBD72', alignItems: 'center', justifyContent: 'center' },
  btnAcText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnRe:     { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#E63946', alignItems: 'center', justifyContent: 'center' },
  btnReText: { color: '#E63946', fontWeight: '700', fontSize: 16 },
});
