import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAmigos } from '../../api/comunidad';
import PersonaProfileModal from '../PersonaProfileModal';
import { estadoPresencia } from '../../utils/tiempoRelativo';
import { colores } from '../../theme';

export default function TabAmigos({ onVerEnMapa }) {
  const [amigos, setAmigos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [perfilId, setPerfilId] = useState(null);

  useEffect(() => {
    fetchAmigos().then(d => setAmigos(d.amigos || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color={colores.verde} style={{ marginTop: 20 }} />;

  if (!amigos.length) return (
    <View style={styles.vacio}>
      <Ionicons name="people-outline" size={36} color="#CCCCCC" style={{ marginBottom: 8 }} />
      <Text style={styles.vacioText}>No tenés amigos agregados aún</Text>
    </View>
  );

  return (
    <>
      <FlatList
        data={amigos}
        keyExtractor={a => String(a.usuario_id)}
        renderItem={({ item: a }) => (
          <View style={styles.item}>
            {/* Tocar avatar + nombre abre la ficha de perfil */}
            <TouchableOpacity style={styles.persona} onPress={() => setPerfilId(a.usuario_id)}
              accessibilityRole="button" accessibilityLabel={`Ver perfil de ${a.nombre}`}>
              <View style={styles.avatarWrap}>
                <View style={[styles.avatar, { borderColor: a.online ? colores.verde : '#CCCCCC' }]}>
                  <Ionicons name="person" size={18} color={colores.textoTenue} />
                </View>
                {/* Punto verde de presencia, como en cualquier app de mensajes */}
                {a.online && <View style={styles.puntoOnline} />}
              </View>
              <View style={styles.info}>
                <Text style={styles.nombre}>{a.nombre}</Text>
                <Text style={styles.sub}>{a.mascota_nombre || 'Sin mascota'}{a.distancia_km != null ? `  ·  ${a.distancia_km} km` : ''}</Text>
                {/* Última vez en línea: "En línea" o "Últ. vez hace 20 minutos" */}
                <Text style={[styles.presencia, a.online && styles.presenciaOnline]}>
                  {estadoPresencia(a.ultima_conexion).texto}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnVer} onPress={() => onVerEnMapa(a)}>
              <Text style={styles.btnVerText}>Ver en mapa</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      <PersonaProfileModal visible={perfilId != null} usuarioId={perfilId} onClose={() => setPerfilId(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  vacio:      { alignItems: 'center', paddingTop: 32 },
  vacioText:  { color: colores.textoSecundario, fontSize: 14 },
  item:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colores.gris150 },
  persona:    { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { marginRight: 10 },
  avatar:     { width: 40, height: 40, borderRadius: 20, borderWidth: 2, backgroundColor: colores.gris150, alignItems: 'center', justifyContent: 'center' },
  puntoOnline: {
    position: 'absolute', right: 0, bottom: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colores.verde, borderWidth: 2, borderColor: colores.blanco,
  },
  info:       { flex: 1 },
  nombre:     { fontWeight: '700', fontSize: 14, color: colores.texto },
  sub:        { fontSize: 12, color: colores.textoSecundario, marginTop: 2 },
  presencia:       { fontSize: 11, color: colores.textoDeshabilitado, marginTop: 2 },
  presenciaOnline: { color: colores.verde, fontWeight: '600' },
  btnVer:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1.5, borderColor: colores.verde, backgroundColor: '#E8FFF2' },
  btnVerText: { fontSize: 11, color: colores.verde, fontWeight: '600' },
});
