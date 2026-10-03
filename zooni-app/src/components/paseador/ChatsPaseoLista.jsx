/**
 * ChatsPaseoLista.jsx — Lista de conversaciones de paseos
 *
 * Una fila por paseo: foto, nombre del otro, mascota + estado, último mensaje
 * y no leídos. La usan los dos lados:
 *   rol 'paseador' → inbox de Zooni Paseadores (PaseadorChatsScreen)
 *   rol 'dueno'    → pestaña "Paseadores" de Mensajes (app de dueños)
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Avatar, C } from './PaseadorUI';
import { fetchConversacionesPaseo } from '../../services/paseadorApi';
import { tiempoRelativoCorto } from '../../utils/tiempoRelativo';

const ESTADO = {
  pendiente: { txt: 'Solicitud', color: C.ambar },
  aceptado: { txt: 'Agendado', color: C.teal },
  en_curso: { txt: 'En curso', color: C.rojo },
  finalizado: { txt: 'Finalizado', color: C.texto2 },
};

export default function ChatsPaseoLista({ rol = 'paseador', vacioTexto }) {
  const navigation = useNavigation();
  const [convs, setConvs] = useState(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setConvs(await fetchConversacionesPaseo(rol));
    } catch {
      setConvs((c) => c ?? []);
    }
  }, [rol]);

  // Se refresca al volver de un chat (para bajar los no leídos)
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (convs === null) return <ActivityIndicator color={C.teal} style={{ marginTop: 30 }} />;

  return (
    <FlatList
      data={convs}
      keyExtractor={(c) => String(c.paseo.id)}
      contentContainerStyle={st.lista}
      refreshControl={<RefreshControl refreshing={refrescando} tintColor={C.teal}
        onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />}
      ListEmptyComponent={
        <View style={st.vacio}>
          <Ionicons name="chatbubbles-outline" size={36} color="#CCCCCC" />
          <Text style={st.vacioTxt}>
            {vacioTexto ?? 'Todavía no tenés conversaciones. Aparecen cuando tenés solicitudes o paseos agendados.'}
          </Text>
        </View>
      }
      renderItem={({ item: c }) => {
        const p = c.paseo;
        const otro = rol === 'dueno'
          ? { nombre: p.paseador?.nombre ?? 'Paseador', foto: p.paseador?.foto }
          : { nombre: p.dueno.nombre, foto: null };
        const est = ESTADO[p.estado] ?? { txt: p.estado, color: C.texto2 };
        return (
          <TouchableOpacity style={st.item} activeOpacity={0.8}
            // idsPaseos: todos los paseos con esta persona, para que el chat
            // muestre el historial completo y no solo el del paseo actual.
            onPress={() => navigation.navigate('PaseadorChat', { paseoId: p.id, idsPaseos: c.idsPaseos })}
            accessibilityLabel={`Chat con ${otro.nombre} por ${p.mascota.nombre}`}>
            {rol === 'dueno'
              ? <Avatar uri={otro.foto} nombre={otro.nombre} size={50} />
              : <Avatar fuente={p.mascota.visual} nombre={p.mascota.nombre} size={50} />}
            <View style={st.info}>
              <View style={st.fila}>
                <Text style={st.nombre} numberOfLines={1}>{otro.nombre}</Text>
                <Text style={st.fecha}>{tiempoRelativoCorto(c.fecha)}</Text>
              </View>
              <View style={st.fila}>
                <Text style={[st.estado, { color: est.color }]}>{est.txt}</Text>
                <Text style={st.mascota} numberOfLines={1}> · {p.mascota.nombre}</Text>
              </View>
              <View style={st.fila}>
                {c.ultimoEsMio && <Ionicons name="checkmark" size={14} color={C.gris} />}
                <Text style={[st.preview, c.noLeidos > 0 && st.previewNoLeido]} numberOfLines={1}>
                  {c.ultimoMensaje ?? 'Tocá para escribir'}
                </Text>
                {c.noLeidos > 0 && (
                  <View style={st.badge}><Text style={st.badgeTxt}>{c.noLeidos}</Text></View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  lista: { padding: 16, flexGrow: 1 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0',
  },
  info: { flex: 1, minWidth: 0, gap: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nombre: { flex: 1, fontSize: 15, fontWeight: '800', color: C.texto },
  fecha: { fontSize: 12, color: C.gris },
  estado: { fontSize: 12, fontWeight: '800' },
  mascota: { flex: 1, fontSize: 12, color: C.texto2 },
  preview: { flex: 1, fontSize: 13, color: C.texto2 },
  previewNoLeido: { color: C.texto, fontWeight: '700' },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: C.ambar, alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  vacio: { alignItems: 'center', gap: 10, marginTop: 50, paddingHorizontal: 30 },
  vacioTxt: { fontSize: 14, color: C.texto2, textAlign: 'center', lineHeight: 20 },
});
