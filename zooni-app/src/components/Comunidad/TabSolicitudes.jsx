import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchSolicitudes, responderSolicitud } from '../../api/comunidad';
import PersonaProfileModal from '../PersonaProfileModal';
import { colores } from '../../theme';

export default function TabSolicitudes({ onRespuesta }) {
  const [lista,   setLista]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [perfilId, setPerfilId] = useState(null);

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

  if (loading) return <ActivityIndicator color={colores.verde} style={{ marginTop: 20 }} />;
  if (!lista.length) return (
    <View style={styles.vacio}>
      <Ionicons name="notifications-outline" size={34} color="#CCCCCC" style={{ marginBottom: 8 }} />
      <Text style={styles.vacioText}>No tenés solicitudes pendientes</Text>
    </View>
  );

  return (
    <>
      <FlatList
        data={lista}
        keyExtractor={s => String(s.id)}
        renderItem={({ item: s }) => (
          <View style={styles.item}>
            <TouchableOpacity style={styles.persona} onPress={() => setPerfilId(s.usuario_id)}
              accessibilityRole="button" accessibilityLabel={`Ver perfil de ${s.nombre}`}>
              <View style={styles.avatar}><Ionicons name="person" size={18} color={colores.textoTenue} /></View>
              <Text style={styles.nombre}>{s.nombre}</Text>
            </TouchableOpacity>
            <View style={styles.btns}>
              <TouchableOpacity style={styles.btnAc} onPress={() => responder(s.id, 'aceptar')}>
                <Ionicons name="checkmark" size={18} color={colores.blanco} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnRe} onPress={() => responder(s.id, 'rechazar')}>
                <Ionicons name="close" size={18} color={colores.rojo} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      <PersonaProfileModal visible={perfilId != null} usuarioId={perfilId} onClose={() => setPerfilId(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  vacio:     { alignItems: 'center', paddingTop: 32 },
  vacioText: { color: colores.textoSecundario, fontSize: 14 },
  item:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colores.gris150 },
  persona:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: colores.gris150, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  nombre:    { flex: 1, fontWeight: '700', fontSize: 14, color: colores.texto },
  btns:      { flexDirection: 'row', gap: 8 },
  btnAc:     { width: 34, height: 34, borderRadius: 17, backgroundColor: colores.verde, alignItems: 'center', justifyContent: 'center' },
  btnAcText: { color: colores.blanco, fontWeight: '700', fontSize: 16 },
  btnRe:     { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colores.rojo, alignItems: 'center', justifyContent: 'center' },
  btnReText: { color: colores.rojo, fontWeight: '700', fontSize: 16 },
});
