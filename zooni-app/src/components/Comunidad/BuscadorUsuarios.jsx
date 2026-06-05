import React, { useState, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { buscarUsuarios, enviarSolicitud } from '../../api/comunidad';

export default function BuscadorUsuarios({ onSolicitudEnviada }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [enviados, setEnviados] = useState(new Set());
  const timer = useRef(null);

  const handleChange = (text) => {
    setQuery(text);
    clearTimeout(timer.current);
    if (text.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const d = await buscarUsuarios(text);
        setResults(d.resultados || []);
      } catch {}
      setLoading(false);
    }, 400);
  };

  const agregar = async (user) => {
    try {
      await enviarSolicitud(user.usuario_id);
      setEnviados(prev => new Set(prev).add(user.usuario_id));
      if (onSolicitudEnviada) onSolicitudEnviada(user.nombre);
    } catch (err) {
      if (err?.response?.status === 409)
        setEnviados(prev => new Set(prev).add(user.usuario_id));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="🔍 Buscar usuarios..."
          value={query}
          onChangeText={handleChange}
          accessibilityLabel="Buscar usuarios"
        />
        {loading && <ActivityIndicator size="small" color="#2DBD72" />}
      </View>

      {query.length < 2 && (
        <Text style={styles.hint}>Buscá por nombre o mascota</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={u => String(u.usuario_id)}
        renderItem={({ item: u }) => {
          const ya = enviados.has(u.usuario_id) || u.es_amigo;
          return (
            <View style={styles.item}>
              <View style={styles.avatar}><Text style={{ fontSize: 18 }}>👤</Text></View>
              <View style={styles.info}>
                <Text style={styles.nombre}>{u.nombre}</Text>
                <Text style={styles.sub}>{u.mascota_nombre}{u.barrio ? `  ·  ${u.barrio}` : ''}</Text>
              </View>
              <TouchableOpacity
                style={[styles.btnAdd, ya && styles.btnYa]}
                onPress={() => !ya && agregar(u)}
                disabled={ya}
              >
                <Text style={[styles.btnAddText, ya && styles.btnYaText]}>
                  {ya ? '✓ Amigos' : '+ Agregar'}
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
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, height: 44, marginBottom: 10 },
  input:       { flex: 1, fontSize: 14, color: '#2C2C2C' },
  hint:        { color: '#AAAAAA', fontSize: 13, textAlign: 'center', marginTop: 12 },
  item:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  avatar:      { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  info:        { flex: 1 },
  nombre:      { fontWeight: '700', fontSize: 14, color: '#2C2C2C' },
  sub:         { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  btnAdd:      { backgroundColor: '#2DBD72', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  btnYa:       { backgroundColor: '#EEE' },
  btnAddText:  { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnYaText:   { color: '#6B6B6B' },
});
