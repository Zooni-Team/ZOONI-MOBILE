import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchSolicitudes, responderSolicitud } from '../api/comunidad';

export default function TabSolicitudes({ onRespuesta }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    try {
      const d = await fetchSolicitudes();
      setSolicitudes(d.solicitudes || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const responder = async (id, accion) => {
    try {
      await responderSolicitud(id, accion);
      setSolicitudes((prev) => prev.filter((s) => s.id !== id));
      if (accion === 'aceptar' && onRespuesta) onRespuesta();
    } catch {}
  };

  if (loading) return <ActivityIndicator color="#2DBD72" style={{ marginTop: 20 }} />;

  if (solicitudes.length === 0) {
    return (
      <View style={styles.vacio}>
        <Text style={styles.vacioIcon}>🔔</Text>
        <Text style={styles.vacioText}>No tenés solicitudes pendientes</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={solicitudes}
      keyExtractor={(s) => String(s.id)}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 20 }}>👤</Text>
          </View>
          <Text style={styles.nombre}>{item.nombre}</Text>
          <View style={styles.botones}>
            <TouchableOpacity
              style={styles.btnAceptar}
              onPress={() => responder(item.id, 'aceptar')}
              accessibilityLabel={`Aceptar solicitud de ${item.nombre}`}
            >
              <Text style={styles.btnAceptarText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnRechazar}
              onPress={() => responder(item.id, 'rechazar')}
              accessibilityLabel={`Rechazar solicitud de ${item.nombre}`}
            >
              <Text style={styles.btnRechazarText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 20 }}
    />
  );
}

const styles = StyleSheet.create({
  vacio: { alignItems: 'center', paddingTop: 40 },
  vacioIcon: { fontSize: 36, marginBottom: 10 },
  vacioText: { color: '#6B6B6B', fontSize: 14 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  nombre: { flex: 1, fontWeight: 'bold', fontSize: 14, color: '#2C2C2C' },
  botones: { flexDirection: 'row', gap: 8 },
  btnAceptar: {
    backgroundColor: '#2DBD72',
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  btnAceptarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnRechazar: {
    borderWidth: 1.5, borderColor: '#E63946',
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  btnRechazarText: { color: '#E63946', fontWeight: 'bold', fontSize: 16 },
});
