/**
 * MensajesScreen.jsx — Inbox de conversaciones
 *
 * Dos pestañas:
 *   - Personas: mis chats de Match (services/chatStore.js → tabla Mensaje/idMatch)
 *   - Servicios: veterinarias, paseadores, petshops y peluquerías de Comunidad
 *     (api/comunidad → tabla servicios), con la conversación que ya tenga
 *     cada uno si le escribí antes.
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { fetchServicios } from '../api/comunidad';
import { fetchMisConversacionesMatch, fetchMisUltimosMensajesServicios } from '../services/chatStore';

const ICONOS_SERVICIO = { veterinaria: 'medkit-outline', paseador: 'walk-outline', petshop: 'bag-outline', peluqueria: 'cut-outline' };
const COLORES_SERVICIO = { veterinaria: '#E63946', paseador: '#F5A623', petshop: '#F5C842', peluqueria: '#9B59B6' };

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h`;
  const dias = Math.floor(hrs / 24);
  return dias === 1 ? 'ayer' : `${dias} días`;
}

export default function MensajesScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState('Personas');
  const [conversaciones, setConversaciones] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [convs, todosServicios, ultimosPorServicio] = await Promise.all([
        fetchMisConversacionesMatch(),
        fetchServicios(),
        fetchMisUltimosMensajesServicios(),
      ]);
      setConversaciones(convs);
      setServicios(
        (todosServicios.servicios ?? [])
          .map((s) => ({ ...s, ...ultimosPorServicio.get(s.id) }))
          .sort((a, b) => {
            if (a.fecha && !b.fecha) return -1;
            if (!a.fecha && b.fecha) return 1;
            if (a.fecha && b.fecha) return new Date(b.fecha) - new Date(a.fecha);
            return a.nombre.localeCompare(b.nombre);
          })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const abrirChatPersona = (c) => {
    navigation.navigate('Chat', { chatId: c.chatId, nombre: c.nombre, fotoPerfilUrl: c.fotoPerfilUrl });
  };

  const abrirChatServicio = (s) => {
    navigation.navigate('Chat', {
      servicioId: s.id,
      nombre: s.nombre,
      tipoServicio: s.tipo?.charAt(0).toUpperCase() + s.tipo?.slice(1),
    });
  };

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Volver"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
        </TouchableOpacity>
        <Text style={st.titulo}>Mensajes</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={st.tabs}>
        {['Personas', 'Servicios'].map((t) => (
          <TouchableOpacity key={t} style={[st.tabBtn, tab === t && st.tabBtnOn]} onPress={() => setTab(t)}>
            <Text style={[st.tabTxt, tab === t && st.tabTxtOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#2DBD72" style={{ marginTop: 30 }} />
      ) : tab === 'Personas' ? (
        <FlatList
          data={conversaciones}
          keyExtractor={(c) => String(c.chatId)}
          contentContainerStyle={st.lista}
          ListEmptyComponent={
            <View style={st.vacio}>
              <Ionicons name="chatbubbles-outline" size={36} color="#CCCCCC" style={{ marginBottom: 8 }} />
              <Text style={st.vacioTxt}>Todavía no tenés conversaciones.{'\n'}¡Hacé match en Match para empezar a chatear!</Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <TouchableOpacity style={st.item} onPress={() => abrirChatPersona(c)}>
              {c.fotoPerfilUrl ? (
                <Image source={{ uri: c.fotoPerfilUrl }} style={st.avatar} />
              ) : (
                <View style={st.avatarFallback}><Text style={st.avatarLetra}>{c.nombre?.[0] ?? '?'}</Text></View>
              )}
              <View style={st.info}>
                <Text style={st.nombre} numberOfLines={1}>{c.nombre}</Text>
                <Text style={st.preview} numberOfLines={1}>{c.ultimoMensaje ?? 'Todavía no hay mensajes'}</Text>
              </View>
              <View style={st.derecha}>
                {c.fecha && <Text style={st.fecha}>{timeAgo(c.fecha)}</Text>}
                {c.noLeidos > 0 && <View style={st.badge}><Text style={st.badgeTxt}>{c.noLeidos}</Text></View>}
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={servicios}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={st.lista}
          ListEmptyComponent={<Text style={st.vacioTxt}>No hay servicios cargados todavía</Text>}
          renderItem={({ item: s }) => (
            <TouchableOpacity style={st.item} onPress={() => abrirChatServicio(s)}>
              <View style={[st.iconCircle, { backgroundColor: COLORES_SERVICIO[s.tipo] || '#888' }]}>
                <Ionicons name={ICONOS_SERVICIO[s.tipo] || 'storefront-outline'} size={18} color="#FFF" />
              </View>
              <View style={st.info}>
                <Text style={st.nombre} numberOfLines={1}>{s.nombre}</Text>
                <Text style={st.preview} numberOfLines={1}>{s.ultimoMensaje ?? 'Tocá para escribirle'}</Text>
              </View>
              {s.fecha && <Text style={st.fecha}>{timeAgo(s.fecha)}</Text>}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
  },
  titulo: { fontSize: 18, fontWeight: '800', color: '#2C2C2C' },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center', backgroundColor: '#F5F5F5' },
  tabBtnOn: { backgroundColor: '#2DBD72' },
  tabTxt: { fontSize: 14, fontWeight: '600', color: '#6B6B6B' },
  tabTxtOn: { color: '#FFFFFF' },

  lista: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  item: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 12,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#C8F0D8',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetra: { fontSize: 17, fontWeight: '800', color: '#27AE60' },
  iconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  nombre: { fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
  preview: { fontSize: 13, color: '#6B6B6B', marginTop: 2 },
  derecha: { alignItems: 'flex-end', gap: 6 },
  fecha: { fontSize: 11, color: '#AAAAAA' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#2DBD72', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  vacio: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  vacioTxt: { color: '#6B6B6B', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
