/**
 * ChatScreen.jsx — Conversación 1 a 1 de Match
 *
 * Se navega desde MatchCelebrationOverlay ("Enviar mensaje") con
 * { chatId, nombre, fotoPerfilUrl }. Sin backend de chat conectado todavía:
 * los mensajes se guardan localmente (ver services/chatStore.js) y se
 * reemplaza por la API/sockets real cuando se conecte.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { agregarMensaje, getMensajes } from '../services/chatStore';

const RESPUESTAS_AUTOMATICAS = [
  '¡Hola! 🐾 Qué bueno matchear con vos',
  '¡Hola! Me encantó el perfil de tu mascota 🐶',
  '¡Hey! ¿Coordinamos un paseo juntos? 🐾',
];

function formatHora(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { chatId, nombre, fotoPerfilUrl } = route.params ?? {};

  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!chatId) return;
    const guardados = await getMensajes(chatId);
    setMensajes(guardados);
  }, [chatId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [mensajes]);

  async function enviarMensaje() {
    const contenido = texto.trim();
    if (!contenido || !chatId || enviando) return;

    setEnviando(true);
    setTexto('');

    const nuevo = {
      id: Date.now(),
      texto: contenido,
      autor: 'yo',
      fecha: new Date().toISOString(),
    };
    const actualizados = await agregarMensaje(chatId, nuevo);
    setMensajes(actualizados);
    setEnviando(false);

    // Primer mensaje de la conversación: simulamos una respuesta amistosa
    // (sin backend de chat en tiempo real conectado todavía).
    if (actualizados.length === 1) {
      setTimeout(async () => {
        const respuesta = {
          id: Date.now() + 1,
          texto: RESPUESTAS_AUTOMATICAS[Math.floor(Math.random() * RESPUESTAS_AUTOMATICAS.length)],
          autor: 'otro',
          fecha: new Date().toISOString(),
        };
        const conRespuesta = await agregarMensaje(chatId, respuesta);
        setMensajes(conRespuesta);
      }, 1200);
    }
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}
          accessibilityLabel="Volver" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
        </TouchableOpacity>

        {fotoPerfilUrl ? (
          <Image source={{ uri: fotoPerfilUrl }} style={s.avatar} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.avatarLetter}>{nombre?.[0] ?? '?'}</Text>
          </View>
        )}
        <Text style={s.nombre} numberOfLines={1}>{nombre ?? 'Match'}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {mensajes.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyEmoji}>🎉</Text>
              <Text style={s.emptyTxt}>¡Es un match! Escribile algo a {nombre ?? 'tu match'} 👋</Text>
            </View>
          ) : (
            mensajes.map((m) => (
              <View key={m.id} style={[s.burbujaWrap, m.autor === 'yo' ? s.burbujaWrapYo : s.burbujaWrapOtro]}>
                <View style={[s.burbuja, m.autor === 'yo' ? s.burbujaYo : s.burbujaOtro]}>
                  <Text style={[s.burbujaTxt, m.autor === 'yo' && s.burbujaTxtYo]}>{m.texto}</Text>
                </View>
                <Text style={[s.hora, m.autor === 'yo' && s.horaYo]}>{formatHora(m.fecha)}</Text>
              </View>
            ))
          )}
        </ScrollView>

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Escribí un mensaje..."
            placeholderTextColor="#AAAAAA"
            value={texto}
            onChangeText={setTexto}
            multiline
            returnKeyType="send"
            onSubmitEditing={enviarMensaje}
          />
          <TouchableOpacity
            style={[s.btnEnviar, !texto.trim() && s.btnEnviarDisabled]}
            onPress={enviarMensaje}
            disabled={!texto.trim() || enviando}
            accessibilityLabel="Enviar mensaje"
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#C8F0D8' },

  header: {
    height: 60, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 12, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#EFEFEF',
  },
  backBtn: { width: 28, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#C8F0D8',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 15, fontWeight: '800', color: '#27AE60' },
  nombre: { flex: 1, fontSize: 16, fontWeight: '700', color: '#2C2C2C' },

  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 16, paddingBottom: 8 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyEmoji: { fontSize: 40 },
  emptyTxt: { fontSize: 15, color: '#6B6B6B', textAlign: 'center', paddingHorizontal: 30 },

  burbujaWrap: { maxWidth: '78%', marginBottom: 12 },
  burbujaWrapYo: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  burbujaWrapOtro: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  burbuja: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  burbujaYo: { backgroundColor: '#2DBD72', borderBottomRightRadius: 4 },
  burbujaOtro: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4 },
  burbujaTxt: { fontSize: 14, color: '#2C2C2C', lineHeight: 20 },
  burbujaTxtYo: { color: '#FFFFFF' },
  hora: { fontSize: 10, color: '#6B6B6B', marginTop: 3, marginHorizontal: 4 },
  horaYo: { color: '#6B6B6B' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#EFEFEF',
  },
  input: {
    flex: 1, maxHeight: 100, borderRadius: 22,
    borderWidth: 1.5, borderColor: '#DDDDDD', backgroundColor: '#FAFAFA',
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#2C2C2C',
  },
  btnEnviar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#2DBD72',
    alignItems: 'center', justifyContent: 'center',
  },
  btnEnviarDisabled: { backgroundColor: '#BEE8CE' },
});
