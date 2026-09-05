/**
 * PetMatchOnboarding.jsx — Crear el perfil de Match de UNA mascota, paso a paso
 *
 * Es lo que se abre al tocar "Crear perfil de {mascota}" en Match.
 *
 * POR QUÉ ASÍ
 * Antes esto era una hoja inferior con todo junto (descripción + un checkbox de
 * visibilidad) y, encima, la foto real se pedía DESPUÉS, en otra pantalla que
 * bloqueaba el swipe: se creaba el perfil y recién ahí aparecía "para aparecer
 * en Match, X necesita una foto real". Dos pasos desconectados para una sola
 * cosa. Acá se pregunta de a una y la foto entra donde corresponde, al
 * principio, porque sin ella la mascota no puede mostrarse.
 *
 * Tres preguntas, ninguna de más: foto, cómo es, y si aparece en Match.
 *
 * Todo lo que se guarda usa columnas que ya existen (Mascota.Foto,
 * Descripcion, VisibleEnMatch, PerfilMatchCreado): no hace falta migración.
 *
 * El guardado ocurre UNA sola vez, al final: si se abandona a la mitad no queda
 * una mascota marcada como "con perfil" pero sin nada cargado.
 */

import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { resolveMascotaVisual } from '../../constants/petImages';
import { crearPerfilMatchMascota } from '../../services/matchApi';
import { setFotoPrincipalMascota } from '../../services/petsApi';
import { alerta } from '../../utils/dialogo';

const PASOS = ['foto', 'descripcion', 'visibilidad'];
const MAX_DESC = 150;

export default function PetMatchOnboarding({ mascota, onListo, onCancelar }) {
  const [paso, setPaso] = useState(0);
  const [fotoUri, setFotoUri] = useState(null);
  const [descripcion, setDescripcion] = useState(mascota?.descripcion ?? '');
  const [visibleEnMatch, setVisibleEnMatch] = useState(true);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  if (!mascota) return null;

  // Si la mascota ya tiene una foto real cargada, sirve: no se vuelve a pedir.
  const fotoExistente = mascota.fotoUrl ?? null;
  const fotoMostrada = fotoUri ?? fotoExistente;

  const elegirFoto = async (desdeCamara) => {
    const permiso = desdeCamara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      alerta('Sin permiso', `Habilitá el acceso a ${desdeCamara ? 'la cámara' : 'la galería'} desde la configuración.`);
      return;
    }
    const res = desdeCamara
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) { setFotoUri(res.assets[0].uri); setError(null); }
  };

  const validarPaso = () => {
    switch (PASOS[paso]) {
      case 'foto':
        // Obligatoria: una ilustración no alcanza para que otra persona decida.
        return (!fotoUri && !fotoExistente)
          ? `Agregá una foto real de ${mascota.nombre} para continuar`
          : null;
      case 'descripcion':
        return !descripcion.trim() ? 'Contá algo, aunque sea corto' : null;
      default:
        return null;
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      // La foto primero: si falla, no queremos la mascota marcada con perfil.
      if (fotoUri) await setFotoPrincipalMascota(mascota.id, fotoUri);
      await crearPerfilMatchMascota(mascota.id, {
        descripcion: descripcion.trim() || undefined,
        visibleEnMatch,
      });
      onListo(mascota.id);
    } catch {
      alerta('No pudimos crear el perfil', 'Revisá tu conexión y probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const siguiente = () => {
    const fallo = validarPaso();
    if (fallo) { setError(fallo); return; }
    setError(null);
    if (paso < PASOS.length - 1) setPaso((p) => p + 1);
    else guardar();
  };

  const atras = () => {
    setError(null);
    if (paso > 0) setPaso((p) => p - 1);
    else onCancelar?.();
  };

  const esUltimo = paso === PASOS.length - 1;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        <View style={s.topBar}>
          <TouchableOpacity onPress={atras} style={s.backBtn}
            accessibilityLabel={paso > 0 ? 'Paso anterior' : 'Cancelar'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#2C2C2C" />
          </TouchableOpacity>
          <View style={s.progreso}>
            {PASOS.map((p, i) => (
              <View key={p} style={[s.segmento, i <= paso && s.segmentoOn]} />
            ))}
          </View>
          <Text style={s.contadorPaso}>{paso + 1}/{PASOS.length}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {PASOS[paso] === 'foto' && (
            <>
              <Text style={s.pregunta}>Una foto de {mascota.nombre}</Text>
              <Text style={s.ayuda}>
                Tiene que ser una foto real: es lo primero que ve la otra persona.
                El dibujo del Closet se sigue usando en el resto de la app.
              </Text>
              {fotoMostrada
                ? <Image source={{ uri: fotoMostrada }} style={s.preview} />
                : <Image source={resolveMascotaVisual(mascota)} style={[s.preview, s.previewIlustracion]} />}
              {!fotoMostrada && (
                <Text style={s.nota}>Así se ve hoy: es el dibujo, no una foto.</Text>
              )}
              <View style={s.botonesRow}>
                <TouchableOpacity style={s.btnSecundario} onPress={() => elegirFoto(false)} activeOpacity={0.85}>
                  <Ionicons name="images-outline" size={16} color="#2C2C2C" />
                  <Text style={s.btnSecundarioTxt}>Galería</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSecundario} onPress={() => elegirFoto(true)} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={16} color="#2C2C2C" />
                  <Text style={s.btnSecundarioTxt}>Cámara</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {PASOS[paso] === 'descripcion' && (
            <>
              <Text style={s.pregunta}>¿Cómo es {mascota.nombre}?</Text>
              <Text style={s.ayuda}>
                Qué le gusta, cómo se lleva con otros animales, su energía.
                Es lo que se lee debajo de la foto.
              </Text>
              <TextInput
                style={[s.input, error && s.inputError]}
                placeholder={`Ej: ${mascota.nombre} es tranquila, le encanta la plaza y se lleva bien con perros grandes.`}
                placeholderTextColor="#9B9B9B"
                value={descripcion}
                onChangeText={(v) => { setDescripcion(v); setError(null); }}
                multiline
                maxLength={MAX_DESC}
                autoFocus
              />
              <Text style={s.contador}>{descripcion.length}/{MAX_DESC}</Text>
            </>
          )}

          {PASOS[paso] === 'visibilidad' && (
            <>
              <Text style={s.pregunta}>¿{mascota.nombre} aparece en Match?</Text>
              <Text style={s.ayuda}>
                Podés crear el perfil ahora y mostrarlo más adelante.
                Esto se cambia cuando quieras.
              </Text>
              <View style={s.opcionesCol}>
                <Opcion
                  activo={visibleEnMatch}
                  onPress={() => setVisibleEnMatch(true)}
                  titulo="Sí, mostrala"
                  apoyo="Otras personas van a poder verla y proponer un encuentro."
                />
                <Opcion
                  activo={!visibleEnMatch}
                  onPress={() => setVisibleEnMatch(false)}
                  titulo="Todavía no"
                  apoyo="El perfil queda creado pero nadie la ve hasta que lo actives."
                />
              </View>
            </>
          )}

          {!!error && <Text style={s.errorTxt}>{error}</Text>}
        </ScrollView>

        <TouchableOpacity style={s.btnContinuar} onPress={siguiente} disabled={guardando} activeOpacity={0.85}>
          {guardando
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={s.btnContinuarTxt}>
              {esUltimo ? `Crear perfil de ${mascota.nombre}` : 'Continuar'}
            </Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Opcion({ activo, onPress, titulo, apoyo }) {
  return (
    <TouchableOpacity style={[s.opcion, activo && s.opcionOn]} onPress={onPress}
      accessibilityRole="radio" accessibilityState={{ selected: activo }}>
      <View style={{ flex: 1 }}>
        <Text style={[s.opcionTxt, activo && s.opcionTxtOn]}>{titulo}</Text>
        <Text style={s.opcionApoyo}>{apoyo}</Text>
      </View>
      {activo && <Ionicons name="checkmark-circle" size={22} color="#2DBD72" />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#D4F5E2' },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  backBtn: { width: 30 },
  progreso: { flex: 1, flexDirection: 'row', gap: 5 },
  segmento: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' },
  segmentoOn: { backgroundColor: '#2DBD72' },
  contadorPaso: { fontSize: 12, fontWeight: '700', color: '#6B6B6B', width: 30, textAlign: 'right' },

  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  pregunta: { fontSize: 24, fontWeight: '800', color: '#2C2C2C', marginBottom: 8 },
  ayuda: { fontSize: 14, color: '#6B6B6B', lineHeight: 20, marginBottom: 24 },
  nota: { fontSize: 13, color: '#6B6B6B', textAlign: 'center', marginTop: 12 },

  preview: {
    width: 170, height: 170, borderRadius: 85, alignSelf: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#FFFFFF',
  },
  previewIlustracion: { resizeMode: 'contain', borderColor: '#E8EFE9' },

  botonesRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnSecundario: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F5C842', borderRadius: 24, paddingVertical: 13,
  },
  btnSecundarioTxt: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },

  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'transparent', borderRadius: 14,
    padding: 14, minHeight: 110, fontSize: 15, color: '#2C2C2C', textAlignVertical: 'top',
  },
  inputError: { borderColor: '#E63946' },
  contador: { alignSelf: 'flex-end', fontSize: 12, color: '#6B6B6B', marginTop: 6 },

  opcionesCol: { gap: 10 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  opcionOn: { borderColor: '#2DBD72' },
  opcionTxt: { fontSize: 16, color: '#2C2C2C', fontWeight: '700' },
  opcionTxtOn: { color: '#2DBD72' },
  opcionApoyo: { fontSize: 13, color: '#6B6B6B', marginTop: 3, lineHeight: 18 },

  errorTxt: { fontSize: 13, color: '#E63946', marginTop: 14, textAlign: 'center', fontWeight: '600' },

  btnContinuar: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 24, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
