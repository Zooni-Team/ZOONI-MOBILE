/**
 * PaseadorChatScreen.jsx — Chat paseador ↔ dueño de un paseo
 *
 * Se abre desde una solicitud, la agenda o el paseo activo (no es un tab).
 * Mismas burbujas que el chat de Zooni: verde menta medio para el paseador
 * (derecha), blancas para el dueño (izquierda). Respuestas rápidas arriba del
 * input porque el paseador escribe con una mano y la correa en la otra.
 * Polling liviano mientras está en foco, como ChatScreen.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { Avatar, C } from '../../components/paseador/PaseadorUI';
import {
  cuandoDe, enviarMensajePaseo, fetchPaseo, getMensajesPaseo, marcarLeidosPaseo,
} from '../../services/paseadorApi';
import { etiquetaDia, horaCorta, mismoDia } from '../../utils/tiempoRelativo';

const POLL_MS = 4000;

const RAPIDAS = {
  pendiente: ['¡Hola! ¿Me contás un poco más?', '¿Tiene alguna alergia?', '¿Dónde lo paso a buscar?'],
  aceptado: ['Estoy llegando 🚶', 'Llego en 10 min', 'Ya estoy en la puerta'],
  en_curso: ['Ya salimos 🐾', 'Todo bien, está feliz 😊', 'Volvemos en 10 min'],
};

const ESTADO_TXT = {
  pendiente: 'Solicitud pendiente',
  aceptado: 'Paseo agendado',
  en_curso: 'Paseo en curso',
  finalizado: 'Paseo finalizado',
  rechazado: 'Solicitud rechazada',
  cancelado: 'Paseo cancelado',
};

export default function PaseadorChatScreen() {
  const navigation = useNavigation();
  const { paseoId } = useRoute().params ?? {};

  const [paseo, setPaseo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchPaseo(paseoId).then(setPaseo).catch(() => {});
  }, [paseoId]);

  const cargar = useCallback(async () => {
    try {
      setMensajes(await getMensajesPaseo(paseoId));
      marcarLeidosPaseo(paseoId).catch(() => {});
    } catch {
      // sin red: queda lo anterior
    }
  }, [paseoId]);

  useFocusEffect(useCallback(() => {
    cargar();
    const t = setInterval(cargar, POLL_MS);
    return () => clearInterval(t);
  }, [cargar]));

  const enviar = async (contenido = texto) => {
    const limpio = contenido.trim();
    if (!limpio || !paseo || enviando) return;
    setEnviando(true);
    setTexto('');
    try {
      setMensajes(await enviarMensajePaseo(paseo, limpio));
    } catch {
      setTexto(limpio); // que no se pierda lo escrito
    } finally {
      setEnviando(false);
    }
  };

  const rapidas = paseo ? (RAPIDAS[paseo.estado] ?? []) : [];
  const cerrado = paseo && ['rechazado', 'cancelado'].includes(paseo.estado);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.volver} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={26} color={C.teal} />
        </TouchableOpacity>
        {paseo ? (
          <>
            <Avatar fuente={paseo.mascota.visual} nombre={paseo.mascota.nombre} size={42} borde />
            <View style={{ flex: 1 }}>
              <Text style={s.titulo} numberOfLines={1}>{paseo.dueno.nombre}</Text>
              <Text style={s.sub} numberOfLines={1}>
                {paseo.mascota.nombre} · {ESTADO_TXT[paseo.estado] ?? ''} · {cuandoDe(paseo.fecha)}
              </Text>
            </View>
          </>
        ) : <View style={{ flex: 1 }} />}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={s.lista}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {mensajes.length === 0 && (
            <View style={s.vacio}>
              <Ionicons name="chatbubbles-outline" size={36} color={C.teal} />
              <Text style={s.vacioTxt}>
                Coordiná con {paseo?.dueno.nombre ?? 'el dueño'} los detalles del paseo.
              </Text>
            </View>
          )}
          {mensajes.map((m, i) => {
            const yo = m.autor === 'yo';
            const nuevoDia = i === 0 || !mismoDia(mensajes[i - 1].fecha, m.fecha);
            return (
              <Fragment key={m.id}>
                {nuevoDia && <Text style={s.dia}>{etiquetaDia(m.fecha)}</Text>}
                <View style={[s.burbuja, yo ? s.burbujaYo : s.burbujaOtro]}>
                  <Text style={s.burbujaTxt}>{m.texto}</Text>
                  <Text style={s.hora}>{horaCorta(m.fecha)}</Text>
                </View>
              </Fragment>
            );
          })}
        </ScrollView>

        {cerrado ? (
          <Text style={s.cerrado}>Este paseo ya no está activo.</Text>
        ) : (
          <>
            {rapidas.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rapidas}
                keyboardShouldPersistTaps="handled">
                {rapidas.map((r) => (
                  <TouchableOpacity key={r} style={s.rapida} onPress={() => enviar(r)} disabled={enviando}>
                    <Text style={s.rapidaTxt}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={texto}
                onChangeText={setTexto}
                placeholder="Escribile al dueño…"
                placeholderTextColor={C.gris}
                multiline
                maxLength={1000}
                onSubmitEditing={() => enviar()}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[s.enviar, (!texto.trim() || enviando) && { opacity: 0.5 }]}
                onPress={() => enviar()}
                disabled={!texto.trim() || enviando}
                accessibilityLabel="Enviar"
              >
                <Ionicons name="send" size={20} color={C.texto} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF',
    paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  volver: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 16, fontWeight: '800', color: C.texto },
  sub: { fontSize: 12, color: C.teal, fontWeight: '600', marginTop: 1 },

  lista: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  vacio: { alignItems: 'center', gap: 8, marginTop: 40, paddingHorizontal: 30 },
  vacioTxt: { fontSize: 14, color: C.texto2, textAlign: 'center' },
  dia: { alignSelf: 'center', fontSize: 12, color: C.texto2, fontWeight: '700', marginVertical: 10 },

  burbuja: { maxWidth: '80%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 6 },
  burbujaYo: { alignSelf: 'flex-end', backgroundColor: C.burbujaYo, borderBottomRightRadius: 6 },
  burbujaOtro: {
    alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderBottomLeftRadius: 6,
    borderWidth: 1, borderColor: '#EAEAEA',
  },
  burbujaTxt: { fontSize: 15, color: C.texto, lineHeight: 20 },
  hora: { fontSize: 10, color: C.texto2, alignSelf: 'flex-end', marginTop: 2 },

  rapidas: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  rapida: {
    borderWidth: 1.5, borderColor: C.teal, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  rapidaTxt: { fontSize: 13, fontWeight: '700', color: C.teal },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.borde,
  },
  input: {
    flex: 1, minHeight: 46, maxHeight: 110, borderRadius: 23, backgroundColor: C.fondo,
    borderWidth: 1, borderColor: '#E3E3E3', paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: C.texto,
  },
  enviar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.amarillo,
    alignItems: 'center', justifyContent: 'center',
  },
  cerrado: { textAlign: 'center', fontSize: 13, color: C.texto2, padding: 16 },
});
