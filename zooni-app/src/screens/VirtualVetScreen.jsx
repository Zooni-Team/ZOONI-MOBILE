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
import HamburgerDrawer from '../components/HamburgerDrawer';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import {
  construirContextoMascota,
  fetchMascotasParaChat,
  preguntarZooniVet,
  sugerenciasIniciales,
} from '../services/zoonivetApi';
import { colores } from '../theme';
import { horaCorta } from '../utils/tiempoRelativo';
import { alerta } from '../utils/dialogo';

const C = {
  bgTop: '#E4F9EA',
  bgBottom: '#A8E6BC',
  surface: colores.blanco,
  bubbleUser: '#7FD9A0',
  bubbleBot: colores.blanco,
  text: colores.texto,
  textSoft: colores.textoSecundario,
  textSoftMint: colores.verdeGrisaceo,
  brandText: colores.verdeOscuro,
  brand: colores.verde,
  cta: colores.amarillo,
  ctaSoft: '#F7D060',
  sosFill: '#D62031',
  sosText: colores.rojoOscuro,
  amberText: '#A05F00',
  amberTint: '#FFF8E6',
  divider: colores.mentaGris,
  typingDot: '#8FA89A',
};

let idSeq = 0;
const nuevoId = () => `m${Date.now()}_${idSeq++}`;

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
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
  }, [dots]);
  return (
    <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: v }] }]} />
      ))}
    </View>
  );
}

function SosCard({ onVerVets }) {
  return (
    <View style={styles.sosCard}>
      <View style={styles.sosHeaderRow}>
        <Ionicons name="add" size={20} color={colores.blanco} style={styles.sosCross} />
        <Text style={styles.sosTitle}>Esto puede ser urgente</Text>
      </View>
      <Text style={styles.sosBody}>
        No pierdas tiempo: llevalo a una veterinaria con guardia ahora mismo.
      </Text>
      <TouchableOpacity style={styles.sosBtn} onPress={onVerVets}>
        <Text style={styles.sosBtnText}>Ver veterinarias abiertas</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.sosBtn} onPress={() => Linking.openURL('tel:08003330160')
          .catch(() => alerta('Llamá al 0800-333-0160', 'Este dispositivo no puede hacer llamadas: marcalo desde un teléfono.'))}>
        <Text style={styles.sosBtnText}>¿Comió algo tóxico? 0800-333-0160</Text>
      </TouchableOpacity>
    </View>
  );
}

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
      <Text style={[styles.timestamp, esUser ? styles.tsRight : styles.tsLeft]}>{horaCorta(msg.ts)}</Text>
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const listRef = useRef(null);
  const abortRef = useRef(null);

  const mascotaSel = mascotas.find((m) => m.id === petId) ?? null;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const activas = await fetchMascotasParaChat();
        if (cancelado) return;
        setMascotas(activas);
        setPetId((prev) => prev ?? activas[0]?.id ?? null);
      } catch {
        if (!cancelado) setMascotas([]);
      } finally {
        if (!cancelado) setCargandoMascotas(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (petId == null) { setCtx(null); setMensajes([]); return; }
    let cancelado = false;
    setCargandoCtx(true);
    const nombreFallback = mascotas.find((m) => m.id === petId)?.nombre ?? null;
    setMensajes([mensajeBienvenida({ nombre: nombreFallback })]);
    (async () => {
      try {
        const c = await construirContextoMascota(petId);
        if (cancelado) return;
        setCtx(c);
        if (c) setMensajes([mensajeBienvenida(c)]);
      } catch {
        if (!cancelado) setCtx(null);
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
    const historial = mensajes
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content, firma: m.firma }));

    setMensajes((prev) => [...prev, userMsg]);
    setInput('');
    setEnviando(true);
    scrollAlFondo();

    abortRef.current = new AbortController();
    try {
      const { texto: respuesta, emergencia, firma } = await preguntarZooniVet({
        ctx,
        historial,
        mensaje: limpio,
        signal: abortRef.current.signal,
      });
      setMensajes((prev) => [
        ...prev,
        { id: nuevoId(), role: 'assistant', content: respuesta, status: 'sent', emergencia, firma, ts: Date.now() },
      ]);
    } catch (e) {
      setMensajes((prev) => [...prev, mensajeError(e)]);
    } finally {
      setEnviando(false);
      abortRef.current = null;
      scrollAlFondo();
    }
  }, [enviando, ctx, mensajes, scrollAlFondo]);

  const detener = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const cambiarMascota = useCallback((id) => {
    setSelectorAbierto(false);
    if (id === petId) return;
    setPetId(id);
  }, [petId]);

  const preguntadas = mensajes.filter((m) => m.role === 'user').map((m) => m.content);
  const chips = ctx ? sugerenciasIniciales(ctx, preguntadas) : [];
  const mostrarChips = ctx && !enviando && chips.length > 0;

  const sinMascotas = !cargandoMascotas && mascotas.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bgTop} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setDrawerOpen(true)}
          accessibilityLabel="Abrir menú" hitSlop={12}>
          <Ionicons name="menu" size={28} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ZooniVet</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
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

        {mostrarChips && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
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
                editable={!enviando && petId != null}
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

        <Text style={styles.disclaimer}>ZooniVet te orienta, no reemplaza a tu veterinaria.</Text>
      </KeyboardAvoidingView>

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

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={mascotaSel}
        activeRoute="ChatBot"
      />
    </SafeAreaView>
  );
}

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
  if (e?.code === 'SIN_API_KEY' || e?.code === 'SERVICIO_NO_DISPONIBLE') {
    content = 'ZooniVet no está disponible en este momento. Probá de nuevo más tarde.';
  } else if (e?.code === 'API_KEY_INVALIDA' || e?.code === 'GROQ_ERROR') {
    content = 'El servicio que me hace pensar no respondió. Probá de nuevo en un rato.';
  } else if (e?.code === 'CUPO_AGOTADO') {
    content = e.message || 'Llegaste al límite de mensajes de hoy. Mañana podés seguir.';
  } else if (e?.code === 'RATE_LIMIT') {
    content = 'Llegaste al límite de mensajes por ahora. Probá de nuevo en un rato.';
  } else if (e?.name === 'AbortError') {
    content = 'Corté la respuesta. Preguntame de nuevo cuando quieras.';
  }
  return { id: nuevoId(), role: 'assistant', content, status: 'error', ts: Date.now() };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgTop },
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
    shadowColor: colores.negro,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ctxAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: C.brand, backgroundColor: colores.gris100 },
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
  bubble: {
    maxWidth: '78%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14,
    shadowColor: colores.negro, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
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
  sosTitle: { color: colores.blanco, fontSize: 16, fontWeight: '800' },
  sosBody: { color: colores.blanco, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  sosBtn: { backgroundColor: colores.blanco, borderRadius: 24, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  sosBtnText: { color: C.sosText, fontSize: 15, fontWeight: '700' },

  chipsScroll: { flexGrow: 0, maxHeight: 48, marginBottom: 14 },
  chipsRow: { paddingHorizontal: 12, paddingRight: 24, gap: 10, alignItems: 'center' },
  chip: {
    height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: colores.blanco,
    borderWidth: 1.5, borderColor: C.brandText, alignItems: 'center', justifyContent: 'center',
  },
  chipText: { color: C.brandText, fontSize: 14, fontWeight: '600' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 12, paddingTop: 4 },
  inputBox: {
    flex: 1, backgroundColor: colores.blanco, borderWidth: 1, borderColor: C.divider,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 4, minHeight: 48, justifyContent: 'center',
  },
  input: { fontSize: 15, lineHeight: 21, color: C.text, maxHeight: 120 },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.cta, alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
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
  sheet: { backgroundColor: colores.blanco, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  sheetAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.brand, backgroundColor: colores.gris100 },
  sheetName: { fontSize: 15, fontWeight: '700', color: C.text },
  sheetBreed: { fontSize: 13, color: C.textSoft, marginTop: 2 },
});
