import React, { useState, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buscarUsuarios, enviarSolicitud } from '../../api/comunidad';
import PersonaProfileModal from '../PersonaProfileModal';
import { colores } from '../../theme';

export default function BuscadorUsuarios({ onSolicitudEnviada }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [enviados, setEnviados] = useState(new Set());
  const [perfilId, setPerfilId] = useState(null);
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
        <Ionicons name="search" size={16} color={colores.textoSecundario} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          placeholder="Buscar usuarios..."
          value={query}
          onChangeText={handleChange}
          accessibilityLabel="Buscar usuarios"
        />
        {loading && <ActivityIndicator size="small" color={colores.verde} />}
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
              <TouchableOpacity style={styles.persona} onPress={() => setPerfilId(u.usuario_id)}
                accessibilityRole="button" accessibilityLabel={`Ver perfil de ${u.nombre}`}>
                <View style={styles.avatar}><Ionicons name="person" size={18} color={colores.textoTenue} /></View>
                <View style={styles.info}>
                  <Text style={styles.nombre}>{u.nombre}</Text>
                  <Text style={styles.sub}>{u.mascota_nombre}{u.barrio ? `  ·  ${u.barrio}` : ''}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAdd, ya && styles.btnYa]}
                onPress={() => !ya && agregar(u)}
                disabled={ya}
              >
                {ya
                  ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="checkmark" size={13} color={colores.textoSecundario} />
                      <Text style={[styles.btnAddText, styles.btnYaText]}>Amigos</Text>
                    </View>
                  : <Text style={styles.btnAddText}>+ Agregar</Text>
                }
              </TouchableOpacity>
            </View>
          );
        }}
        style={{ maxHeight: 300 }}
      />

      <PersonaProfileModal visible={perfilId != null} usuarioId={perfilId} onClose={() => setPerfilId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colores.gris50, borderRadius: 20, paddingHorizontal: 14, height: 44, marginBottom: 10 },
  input:       { flex: 1, fontSize: 14, color: colores.texto },
  hint:        { color: colores.textoTenue, fontSize: 13, textAlign: 'center', marginTop: 12 },
  item:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colores.gris150 },
  persona:     { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar:      { width: 38, height: 38, borderRadius: 19, backgroundColor: colores.gris150, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  info:        { flex: 1 },
  nombre:      { fontWeight: '700', fontSize: 14, color: colores.texto },
  sub:         { fontSize: 12, color: colores.textoSecundario, marginTop: 2 },
  btnAdd:      { backgroundColor: colores.verde, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  btnYa:       { backgroundColor: colores.gris250 },
  btnAddText:  { color: colores.blanco, fontWeight: '700', fontSize: 12 },
  btnYaText:   { color: colores.textoSecundario },
});
