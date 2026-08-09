/**
 * VirtualVetScreen.jsx — ZooniVet, el asistente veterinario con IA (Instruction-ChatBot)
 *
 * Chat sobre una mascota concreta del usuario: trae sus datos reales (edad,
 * peso, vacunas, consultas) y se los inyecta al modelo de Groq como contexto.
 * El modelo orienta pero nunca diagnostica ni receta, y ante lo concreto de
 * salud siempre deriva al veterinario. Ante una emergencia, corta y manda a SOS.
 *
 * La llamada a Groq NO se hace desde acá: va a la Edge Function `zoonivet-chat`,
 * que guarda la API key como secret. Ver src/services/zoonivetApi.js.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
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

import { resolveMascotaVisual } from '../constants/petImages';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import {
  construirContextoMascota,
  fetchMascotasParaChat,
  preguntarZooniVet,
  sugerenciasIniciales,
} from '../services/zoonivetApi';

// ─── Tokens de estilo (sección 3.1) ─────────────────────────────────────────
const C = {
  bgTop: '#E4F9EA',
  bgBottom: '#A8E6BC',
  surface: '#FFFFFF',
  bubbleUser: '#A8E6C0',
  bubbleBot: '#FFFFFF',
  text: '#2C2C2C',
  textSoft: '#6B6B6B',
  textSoftMint: '#5A6B60',
  brandText: '#177046',
  brand: '#2DBD72',
  cta: '#F5C842',
  ctaSoft: '#F7D060',
  sosFill: '#D62031',
  sosText: '#B3121D',
  amberText: '#A05F00',
  amberTint: '#FFF8E6',
  divider: '#E8EFE9',
  typingDot: '#8FA89A',
};

let idSeq = 0;
const nuevoId = () => `m${Date.now()}_${idSeq++}`;

function horaDe(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Indicador de "escribiendo" (tres puntos) ───────────────────────────────
function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: -3, duration: 300, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);
  return (
    <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: v }] }]} />
      ))}
    </View>
  );
}

// ─── Card de derivación a SOS (C4) ──────────────────────────────────────────
function SosCard({ onVerVets }) {
  return (
    <View style={styles.sosCard}>
      <View style={styles.sosHeaderRow}>
        <Ionicons name="add" size={20} color="#FFFFFF" style={styles.sosCross} />
        <Text style={styles.sosTitle}>Esto puede ser urgente</Text>
      </View>
      <Text style={styles.sosBody}>
        No pierdas tiempo: comunicate con un veterinario ahora mismo.
      </Text>
      <TouchableOpacity style={styles.sosBtn} onPress={() => Linking.openURL('tel:08001234567')}>
        <Text style={styles.sosBtnText}>Llamar ahora: 0800-123-4567</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.sosBtn} onPress={onVerVets}>
        <Text style={styles.sosBtnText}>Ver veterinarias abiertas</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Burbuja de mensaje ─────────────────────────────────────────────────────
function Burbuja({ msg, onVerVets }) {
  if (msg.role === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{msg.content}</Text>
      </View>
    );
  }
  const esUser = msg.role === 'user';
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={[styles.bubbleRow, esUser ? styles.rowRight : styles.rowLeft]}>
        {!esUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="medkit" size={15} color={C.brandText} />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            esUser ? styles.bubbleUser : styles.bubbleBot,
            msg.status === 'error' && styles.bubbleError,
          ]}
        >
          <Text style={styles.bubbleText}>{msg.content}</Text>
        </View>
      </View>
      {msg.emergencia && <SosCard onVerVets={onVerVets} />}
      <Text style={[styles.timestamp, esUser ? styles.tsRight : styles.tsLeft]}>{horaDe(msg.ts)}</Text>
    </View>
  );
}

export default function VirtualVetScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { usuario } = useUsuarioActivo();
  const petParam = route.params?.pet ?? route.params?.petId ?? null;

  const [mascotas, setMascotas] = useState([]);
  const [cargandoMascotas, setCargandoMascotas] = useState(true);
  const [petId, setPetId] = useState(petParam);
  const [ctx, setCtx] = useState(null);
  const [cargandoCtx, setCargandoCtx] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  const listRef = useRef(null);
  const abortRef = useRef(null);

  const mascotaSel = mascotas.find((m) => m.id === petId) ?? null;

  // Carga inicial de mascotas activas.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const activas = await fetchMascotasParaChat();
        if (cancelado) return;
        setMascotas(activas);
        // Preselección: param de ruta, o la primera activa.
        setPetId((prev) => prev ?? activas[0]?.id ?? null);
      } catch {
        if (!cancelado) setMascotas([]);
      } finally {
        if (!cancelado) setCargandoMascotas(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // Al elegir/cambiar mascota: traer su contexto y arrancar conversación nueva.
  useEffect(() => {
    if (petId == null) { setCtx(null); return; }
    let cancelado = false;
    setCargandoCtx(true);
    (async () => {
      try {
        const c = await construirContextoMascota(petId);
        if (cancelado) return;
        setCtx(c);
        setMensajes(c ? [mensajeBienvenida(c)] : []);
      } catch {
        if (!cancelado) { setCtx(null); setMensajes([]); }
      } finally {
        if (!cancelado) setCargandoCtx(false);
      }
    })();
    return () => { cancelado = true; };
  }, [petId]);

  const scrollAlFondo = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd?.({ animated: true }));
  }, []);

  const enviar = useCallback(async (texto) => {
    const limpio = String(texto ?? '').trim();
    if (!limpio || enviando || !ctx) return;

    const userMsg = { id: nuevoId(), role: 'user', content: limpio, status: 'sent', ts: Date.now() };
    // Historial que ve el modelo: solo turnos reales (user/assistant), sin la card de SOS.
    const historial = mensajes
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    setMensajes((prev) => [...prev, userMsg]);
    setInput('');
    setEnviando(true);
    scrollAlFondo();

    abortRef.current = new AbortController();
    try {
      const { texto: respuesta, emergencia } = await preguntarZooniVet({
        ctx,
        usuario: { nombre: usuario?.nombre },
        historial,
        mensaje: limpio,
        signal: abortRef.current.signal,
      });
      setMensajes((prev) => [
        ...prev,
        { id: nuevoId(), role: 'assistant', content: respuesta, status: 'sent', emergencia, ts: Date.now() },
      ]);
    } catch (e) {
      setMensajes((prev) => [...prev, mensajeError(e)]);
    } finally {
      setEnviando(false);
      abortRef.current = null;
      scrollAlFondo();
    }
  }, [enviando, ctx, mensajes, usuario, scrollAlFondo]);

  const detener = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const cambiarMascota = useCallback((id) => {
    setSelectorAbierto(false);
    if (id === petId) return;
    setPetId(id);
  }, [petId]);

  const cantUser = mensajes.filter((m) => m.role === 'user').length;
  const mostrarChips = ctx && !enviando && cantUser < 3;
  const chips = ctx ? sugerenciasIniciales(ctx) : [];

  // ── Render ────────────────────────────────────────────────────────────────
  const sinMascotas = !cargandoMascotas && mascotas.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bgTop} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ZooniVet</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        {/* Card de contexto de la mascota / selector */}
        {sinMascotas ? (
          <View style={styles.emptyCard}>
            <Ionicons name="paw" size={64} color={C.brand} />
            <Text style={styles.emptyTitle}>Necesito conocer a tu mascota</Text>
            <Text style={styles.emptyDesc}>
              Cargá su nombre, raza y edad para que pueda darte respuestas útiles.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AltaMascota')}>
              <Text style={styles.emptyBtnText}>Agregar mi mascota</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.ctxCard}
            activeOpacity={0.85}
            onPress={() => setSelectorAbierto(true)}
          >
            {mascotaSel ? (
              <Image source={resolveMascotaVisual(mascotaSel)} style={styles.ctxAvatar} />
            ) : (
              <View style={[styles.ctxAvatar, styles.ctxAvatarPh]} />
            )}
            <View style={styles.flex}>
              <Text style={styles.ctxName}>{mascotaSel?.nombre ?? 'Elegí una mascota'}</Text>
              {mascotaSel && (
                <Text style={styles.ctxBreed}>
                  {[mascotaSel.raza, mascotaSel.especie].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-down" size={18} color={C.textSoft} />
          </TouchableOpacity>
        )}

        {/* Lista de mensajes */}
        <View style={styles.listWrap}>
          {cargandoCtx ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.brand} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={mensajes}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Burbuja msg={item} onVerVets={() => navigation.navigate('SOS')} />
              )}
              onContentSizeChange={scrollAlFondo}
              ListFooterComponent={enviando ? <TypingDots /> : null}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {/* Chips de sugerencia */}
        {mostrarChips && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {chips.map((c) => (
              <TouchableOpacity key={c} style={styles.chip} onPress={() => enviar(c)}>
                <Text style={styles.chipText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input + enviar */}
        {!sinMascotas && (
          <View style={styles.inputRow}>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.input}
                placeholder={enviando ? 'ZooniVet está escribiendo…' : 'Escribí tu mensaje para ZooniVet…'}
                placeholderTextColor={C.textSoft}
                value={input}
                onChangeText={setInput}
                multiline
                editable={!enviando && !!ctx}
                maxLength={1000}
              />
            </View>
            {enviando ? (
              <TouchableOpacity style={styles.sendBtn} onPress={detener}>
                <Ionicons name="stop" size={18} color={C.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || !ctx) && styles.sendBtnOff]}
                onPress={() => enviar(input)}
                disabled={!input.trim() || !ctx}
              >
                <Ionicons name="arrow-up" size={20} color={C.text} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Disclaimer permanente */}
        <Text style={styles.disclaimer}>ZooniVet te orienta, no reemplaza a tu veterinaria.</Text>
      </KeyboardAvoidingView>

      {/* Bottom sheet: selector de mascota */}
      <Modal visible={selectorAbierto} transparent animationType="fade" onRequestClose={() => setSelectorAbierto(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectorAbierto(false)}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>¿De qué mascota hablamos?</Text>
            {mascotas.map((m) => (
              <TouchableOpacity key={m.id} style={styles.sheetItem} onPress={() => cambiarMascota(m.id)}>
                <Image source={resolveMascotaVisual(m)} style={styles.sheetAvatar} />
                <View style={styles.flex}>
                  <Text style={styles.sheetName}>{m.nombre}</Text>
                  <Text style={styles.sheetBreed}>
                    {[m.raza, m.especie].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {m.id === petId && <Ionicons name="checkmark-circle" size={22} color={C.brand} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Mensajes de sistema/bienvenida/error ───────────────────────────────────
function mensajeBienvenida(ctx) {
  const nombre = ctx?.nombre ?? 'tu mascota';
  return {
    id: nuevoId(),
    role: 'assistant',
    content: `¡Hola! Soy ZooniVet. Puedo ayudarte con dudas sobre ${nombre}: su salud, su alimentación, sus vacunas o su rutina. Contame qué necesitás.`,
    status: 'sent',
    ts: Date.now(),
  };
}

function mensajeError(e) {
  let content = 'No pude responderte. Probá de nuevo.';
  if (e?.code === 'SIN_API_KEY') {
    content = 'No tengo configurada la API key de Groq. Avisale al equipo para poder responderte.';
  } else if (e?.code === 'RATE_LIMIT') {
    content = 'Llegaste al límite de mensajes por ahora. Probá de nuevo en un rato.';
  } else if (e?.name === 'AbortError') {
    content = 'Corté la respuesta. Preguntame de nuevo cuando quieras.';
  }
  return { id: nuevoId(), role: 'assistant', content, status: 'error', ts: Date.now() };
}

// ─── Estilos ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBottom },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: C.bgTop,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text },

  ctxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ctxAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.brand, backgroundColor: '#EEE' },
  ctxAvatarPh: { backgroundColor: C.divider },
  ctxName: { fontSize: 16, fontWeight: '700', color: C.brandText },
  ctxBreed: { fontSize: 13, color: C.textSoft, marginTop: 2 },

  listWrap: { flex: 1, marginHorizontal: 12, marginTop: 10 },
  listContent: { paddingVertical: 12, paddingHorizontal: 4 },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', maxWidth: '100%' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  botAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.divider, alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: C.bubbleUser, borderBottomRightRadius: 6 },
  bubbleBot: { backgroundColor: C.bubbleBot, borderWidth: 1, borderColor: C.divider, borderBottomLeftRadius: 6 },
  bubbleError: { borderColor: C.sosText, borderWidth: 1.5 },
  bubbleText: { fontSize: 15, lineHeight: 21, color: C.text },

  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 64, justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.typingDot },

  timestamp: { fontSize: 11, color: C.textSoft, marginTop: 4 },
  tsLeft: { textAlign: 'left', marginLeft: 40 },
  tsRight: { textAlign: 'right' },

  systemRow: { alignItems: 'center', marginVertical: 8 },
  systemText: {
    fontSize: 11, fontWeight: '600', color: C.textSoft,
    backgroundColor: '#F1F7F3', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden',
  },

  sosCard: { backgroundColor: C.sosFill, borderRadius: 18, padding: 16, marginTop: 10, width: '92%' },
  sosHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sosCross: { fontWeight: '800' },
  sosTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  sosBody: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  sosBtn: { backgroundColor: '#FFFFFF', borderRadius: 24, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  sosBtnText: { color: C.sosText, fontSize: 15, fontWeight: '700' },

  chipsRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: C.brandText, alignItems: 'center', justifyContent: 'center',
  },
  chipText: { color: C.brandText, fontSize: 14, fontWeight: '600' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 12, paddingTop: 4 },
  inputBox: {
    flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.divider,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 4, minHeight: 48, justifyContent: 'center',
  },
  input: { fontSize: 15, lineHeight: 21, color: C.text, maxHeight: 120 },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.cta, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  sendBtnOff: { opacity: 0.45 },

  disclaimer: { fontSize: 11, color: C.textSoftMint, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 16 },

  emptyCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 24, margin: 12, alignItems: 'center', gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 8 },
  emptyDesc: { fontSize: 14, color: C.textSoft, textAlign: 'center' },
  emptyBtn: { backgroundColor: C.cta, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, marginTop: 12 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: C.text },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sheetAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.brand, backgroundColor: '#EEE' },
  sheetName: { fontSize: 15, fontWeight: '700', color: C.text },
  sheetBreed: { fontSize: 13, color: C.textSoft, marginTop: 2 },
});
