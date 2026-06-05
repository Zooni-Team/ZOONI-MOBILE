import React, { useState } from 'react';
import {
  View, TextInput, FlatList, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { buscarUsuarios, enviarSolicitud } from '../api/comunidad';
import useDebounce from '../hooks/useDebounce';

export default function BuscadorUsuarios({ onSolicitudEnviada }) {
  const [query, setQuery]       = useState('');
  const [resultados, setRes]    = useState([]);
  const [loading, setLoading]   = useState(false);
  const [enviados, setEnviados] = useState(new Set());

  const buscar = useDebounce(async (q) => {
    if (q.trim().length < 2) { setRes([]); return; }
    setLoading(true);
    try {
      const d = await buscarUsuarios(q);
      setRes(d.resultados || []);
    } catch {}
    setLoading(false);
  }, 400);

  const handleChange = (text) => {
    setQuery(text);
    buscar(text);
  };

  const handleAgregar = async (user) => {
    try {
      await enviarSolicitud(user.usuario_id);
      setEnviados((prev) => new Set(prev).add(user.usuario_id));
      if (onSolicitudEnviada) onSolicitudEnviada(user.nombre);
    } catch (err) {
      if (err?.response?.status === 409) {
        setEnviados((prev) => new Set(prev).add(user.usuario_id));
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="🔍 Buscar usuarios..."
          value={query}
          onChangeText={handleChange}
          accessibilityLabel="Buscar usuarios por nombre o mascota"
        />
        {loading && <ActivityIndicator size="small" color="#2DBD72" style={styles.spinner} />}
      </View>

      {resultados.length === 0 && query.length >= 2 && !loading && (
        <Text style={styles.vacio}>No se encontraron usuarios</Text>
      )}
      {query.length < 2 && (
        <Text style={styles.hint}>Buscá amigos por nombre o mascota</Text>
      )}

      <FlatList
        data={resultados}
        keyExtractor={(u) => String(u.usuario_id)}
        renderItem={({ item }) => {
          const yaEnviado = enviados.has(item.usuario_id) || item.es_amigo;
          return (
            <View style={styles.item}>
              <View style={styles.avatar}>
                <Text style={{ fontSize: 20 }}>👤</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.sub}>
                  {item.mascota_nombre || ''}
                  {item.barrio ? `  ·  ${item.barrio}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btnAgregar, yaEnviado && styles.btnYaAmigo]}
                onPress={() => !yaEnviado && handleAgregar(item)}
                disabled={yaEnviado}
                accessibilityLabel={yaEnviado ? 'Ya son amigos' : `Agregar a ${item.nombre}`}
              >
                <Text style={styles.btnAgregarText}>
                  {yaEnviado ? '✓ Amigos' : '+ Agregar'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
        style={{ maxHeight: 300 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 14,
    marginBottom: 10,
    height: 44,
  },
  input: { flex: 1, fontSize: 14, color: '#2C2C2C' },
  spinner: { marginLeft: 6 },
  hint:  { color: '#AAAAAA', fontSize: 13, textAlign: 'center', marginTop: 12 },
  vacio: { color: '#AAAAAA', fontSize: 13, textAlign: 'center', marginTop: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F0F0F0',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  info: { flex: 1 },
  nombre: { fontWeight: 'bold', fontSize: 14, color: '#2C2C2C' },
  sub:    { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  btnAgregar: {
    backgroundColor: '#2DBD72',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  btnYaAmigo: { backgroundColor: '#EEEEEE' },
  btnAgregarText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
