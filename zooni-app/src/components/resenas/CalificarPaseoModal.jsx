/**
 * CalificarPaseoModal.jsx — El dueño reseña un paseo terminado (estilo Google Maps)
 *
 *   1. Estrellas generales (obligatorias)
 *   2. Aspectos: puntualidad, trato con tu mascota, comunicación (opcionales)
 *   3. Preguntas de sí / no (opcionales)
 *   4. Texto (opcional)
 *   5. Fotos y videos del paseo (hasta MEDIA_RESENA_MAX)
 *
 * Al enviar, los archivos se suben a Storage y al paseador le llega una
 * notificación. Props: visible · paseo · onCerrar · onEnviado({ parcial })
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import {
  ASPECTOS_RESENA, MEDIA_RESENA_MAX, PREGUNTAS_RESENA, calificarPaseo,
} from '../../services/paseadorApi';
import { alerta } from '../../utils/dialogo';
import { MiniaturaMedia, VisorMedia } from './MediaResena';

const VERDE = '#2DBD72';
const MENTA = '#E8F5EC';
const AMARILLO = '#F5C842';
const TEXTO = '#2C2C2C';
const TEXTO2 = '#6B6B6B';
const ROJO = '#E63946';
const MAX_MB = 50; // file_size_limit del bucket "resenas" (042)
const ETIQUETAS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

function EstrellasInput({ valor, onCambio, size = 34, borrable = false }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity key={i} onPress={() => onCambio(borrable && valor === i ? 0 : i)} hitSlop={4}
          accessibilityLabel={`${i} ${i === 1 ? 'estrella' : 'estrellas'}`}>
          <Ionicons name={valor >= i ? 'star' : 'star-outline'} size={size} color={AMARILLO} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function CalificarPaseoModal({ visible, paseo, onCerrar, onEnviado }) {
  const [rating, setRating] = useState(0);
  const [aspectos, setAspectos] = useState({});
  const [respuestas, setRespuestas] = useState({});
  const [texto, setTexto] = useState('');
  const [media, setMedia] = useState([]); // [{ uri, mimeType, tipo }]
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [visor, setVisor] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setRating(0); setAspectos({}); setRespuestas({}); setTexto(''); setMedia([]); setError(null);
  }, [visible, paseo?.id]);

  const agregarMedia = async (camara) => {
    const permiso = camara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      alerta('Sin permiso', `Habilitá el acceso a la ${camara ? 'cámara' : 'galería'} desde la configuración del dispositivo.`);
      return;
    }
    const lugar = MEDIA_RESENA_MAX - media.length;
    const opciones = {
      mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.7, videoMaxDuration: 60,
      allowsMultipleSelection: !camara, selectionLimit: lugar,
    };
    const res = camara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (res.canceled) return;
    const pesados = [];
    const nuevos = (res.assets ?? []).filter((a) => {
      if (a.fileSize && a.fileSize > MAX_MB * 1024 * 1024) { pesados.push(a); return false; }
      return true;
    }).map((a) => ({
      uri: a.uri,
      mimeType: a.mimeType,
      tipo: a.type === 'video' || /^data:video|\.(mp4|mov|m4v|webm|3gp)$/i.test(a.uri) || a.mimeType?.startsWith('video/')
        ? 'video' : 'imagen',
    }));
    setMedia((m) => [...m, ...nuevos].slice(0, MEDIA_RESENA_MAX));
    if (pesados.length) alerta('Archivo muy pesado', `Cada foto o video puede pesar hasta ${MAX_MB} MB.`);
  };

  const enviar = async () => {
    if (!rating) { setError('Elegí cuántas estrellas le das al paseo'); return; }
    setEnviando(true);
    setError(null);
    try {
      const resultado = await calificarPaseo(paseo, { rating, resena: texto, aspectos, respuestas, media });
      onEnviado?.(resultado);
    } catch (e) {
      console.error('[Reseña]', e?.message ?? e);
      setError(media.length
        ? 'No se pudo enviar la reseña. Si subiste videos, probá con uno más corto.'
        : 'No se pudo enviar la reseña. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} style={s.volver} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={26} color={TEXTO} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.titulo} numberOfLines={1}>{paseo?.paseador?.nombre ?? 'Tu paseador'}</Text>
            <Text style={s.sub} numberOfLines={1}>Paseo con {paseo?.mascota?.nombre}</Text>
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {/* 1. General */}
            <View style={{ alignItems: 'center' }}>
              <Text style={s.pregunta}>¿Cómo estuvo el paseo?</Text>
              <View style={{ marginTop: 10 }}><EstrellasInput valor={rating} onCambio={(v) => { setRating(v); setError(null); }} size={40} /></View>
              <Text style={s.etiqueta}>{ETIQUETAS[rating] || 'Tocá las estrellas'}</Text>
            </View>

            {/* 2. Aspectos */}
            <Text style={s.seccion}>Contanos un poco más (opcional)</Text>
            {ASPECTOS_RESENA.map((a) => (
              <View key={a.key} style={s.aspecto}>
                <Text style={s.aspectoLabel}>{a.label}</Text>
                <EstrellasInput size={24} borrable valor={aspectos[a.key] ?? 0}
                  onCambio={(v) => setAspectos((x) => {
                    const n = { ...x };
                    if (v) n[a.key] = v; else delete n[a.key];
                    return n;
                  })} />
              </View>
            ))}

            {/* 3. Preguntas */}
            {PREGUNTAS_RESENA.map((p) => (
              <View key={p.key} style={s.preguntaBox}>
                <Text style={s.preguntaTxt}>{p.pregunta}</Text>
                <View style={s.siNo}>
                  {[[true, 'Sí'], [false, 'No']].map(([v, label]) => {
                    const on = respuestas[p.key] === v;
                    return (
                      <TouchableOpacity key={label} style={[s.siNoBtn, on && s.siNoOn]}
                        onPress={() => setRespuestas((x) => {
                          const n = { ...x };
                          if (on) delete n[p.key]; else n[p.key] = v;
                          return n;
                        })}
                        accessibilityRole="radio" accessibilityState={{ selected: on }}>
                        <Text style={[s.siNoTxt, on && { color: '#FFF' }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* 4. Texto */}
            <Text style={s.seccion}>Tu opinión</Text>
            <TextInput style={s.input} value={texto} onChangeText={setTexto} multiline maxLength={1000}
              placeholder="Contá cómo te fue: puntualidad, cómo trató a tu mascota, si te mandó novedades…"
              placeholderTextColor="#AAAAAA" />
            <Text style={s.contador}>{texto.length}/1000</Text>

            {/* 5. Fotos y videos */}
            <Text style={s.seccion}>Fotos y videos ({media.length}/{MEDIA_RESENA_MAX})</Text>
            <View style={s.mediaFila}>
              {media.map((m, i) => (
                <View key={`${m.uri.slice(-40)}-${i}`}>
                  <MiniaturaMedia item={m} size={78} onPress={() => setVisor(i)} />
                  <TouchableOpacity style={s.quitar} onPress={() => setMedia((x) => x.filter((_, j) => j !== i))}
                    accessibilityLabel="Quitar">
                    <Ionicons name="close" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {media.length < MEDIA_RESENA_MAX && (
                <>
                  <TouchableOpacity style={s.agregar} onPress={() => agregarMedia(false)}>
                    <Ionicons name="images-outline" size={24} color={VERDE} />
                    <Text style={s.agregarTxt}>Galería</Text>
                  </TouchableOpacity>
                  {Platform.OS !== 'web' && (
                    <TouchableOpacity style={s.agregar} onPress={() => agregarMedia(true)}>
                      <Ionicons name="camera-outline" size={24} color={VERDE} />
                      <Text style={s.agregarTxt}>Cámara</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
            <Text style={s.ayuda}>Las fotos y videos los van a ver otros dueños en las opiniones del paseador.</Text>

            {error ? <Text style={s.error}>{error}</Text> : null}
            <TouchableOpacity style={[s.btn, !rating && { opacity: 0.6 }]} onPress={enviar} disabled={enviando}>
              {enviando
                ? <><ActivityIndicator color={TEXTO} /><Text style={s.btnTxt}>{media.length ? 'Subiendo…' : 'Enviando…'}</Text></>
                : <Text style={s.btnTxt}>Publicar reseña</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
        <VisorMedia items={media} indice={visor} onCerrar={() => setVisor(null)} />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
  },
  volver: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 18, fontWeight: '800', color: TEXTO },
  sub: { fontSize: 12, color: TEXTO2 },
  scroll: { padding: 20, paddingBottom: 40 },

  pregunta: { fontSize: 20, fontWeight: '900', color: TEXTO, textAlign: 'center' },
  etiqueta: { fontSize: 14, color: TEXTO2, fontWeight: '700', marginTop: 6 },
  seccion: { fontSize: 15, fontWeight: '800', color: TEXTO, marginTop: 24, marginBottom: 10 },

  aspecto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  aspectoLabel: { fontSize: 14, color: TEXTO, fontWeight: '600', flex: 1 },

  preguntaBox: { marginTop: 14 },
  preguntaTxt: { fontSize: 14, color: TEXTO, fontWeight: '600' },
  siNo: { flexDirection: 'row', gap: 8, marginTop: 8 },
  siNoBtn: {
    flex: 1, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#DDDDDD',
    alignItems: 'center', justifyContent: 'center',
  },
  siNoOn: { backgroundColor: VERDE, borderColor: VERDE },
  siNoTxt: { fontSize: 14, fontWeight: '800', color: TEXTO },

  input: {
    minHeight: 110, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 14, padding: 12,
    fontSize: 15, color: TEXTO, textAlignVertical: 'top',
  },
  contador: { fontSize: 11, color: TEXTO2, textAlign: 'right', marginTop: 4 },

  mediaFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  agregar: {
    width: 78, height: 78, borderRadius: 12, borderWidth: 1.5, borderColor: VERDE, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: MENTA, gap: 2,
  },
  agregarTxt: { fontSize: 11, fontWeight: '800', color: VERDE },
  quitar: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  ayuda: { fontSize: 12, color: TEXTO2, marginTop: 8 },

  error: { fontSize: 13, color: ROJO, marginTop: 16, textAlign: 'center' },
  btn: {
    flexDirection: 'row', gap: 8, marginTop: 20, height: 54, borderRadius: 27, backgroundColor: AMARILLO,
    alignItems: 'center', justifyContent: 'center',
  },
  btnTxt: { fontSize: 16, fontWeight: '900', color: TEXTO },
});
