/**
 * MatchProfileSetup.jsx — Onboarding del perfil de Match, paso a paso
 *
 * MatchScreen lo muestra en vez del swipe mientras al usuario le falte algo de
 * esto: foto de perfil, fecha de nacimiento, género o intereses (ninguno de
 * estos datos se pide en el registro). También se abre desde "Editar mi perfil"
 * en la vista previa "Así te ven".
 *
 * POR QUÉ POR PASOS
 * Antes era un formulario único con las cuatro cosas juntas: una pared de
 * campos vacíos que había que scrollear, y los errores recién aparecían al
 * final, todos de golpe, al tocar "Continuar". Acá se pregunta de a una cosa,
 * con una barra de progreso arriba, y no se puede avanzar hasta que lo de ese
 * paso esté bien — el error se ve donde se cometió.
 *
 * Son cuatro pasos a propósito: es lo mínimo que la app necesita para poder
 * mostrarte y mostrarte a otros. Nada de esto es opcional, así que no hay
 * "saltar" — pero sí se puede volver atrás sin perder lo cargado.
 *
 * El guardado ocurre UNA sola vez, al terminar el último paso: si alguien
 * abandona a la mitad no queda un perfil parcial en la base.
 */

import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import FilterChip from './FilterChip';
import { INTEREST_OPTIONS, GENDER_OPTIONS } from '../../data/matchDemo';
import { guardarPerfilMatch } from '../../services/matchApi';
import { colores } from '../../theme';
import FechaPicker from '../FechaPicker';
import { calcularEdadAnios } from '../../utils/calcularEdad';
import { formatearFecha, parseFechaLocal, toISODateLocal } from '../../utils/fechaLocal';

const GENEROS = GENDER_OPTIONS.filter((g) => g.key !== 'todos');
const EDAD_MINIMA = 18;
const MAX_INTERESES = 5;

const PASOS = ['foto', 'fecha', 'genero', 'intereses'];

export default function MatchProfileSetup({ onListo, perfilActual, onCancelar }) {
  // Si ya hay foto de perfil cargada (registro / Perfil), se usa esa directo:
  // no hace falta volver a subirla.
  const fotoExistente = perfilActual?.fotoPerfilUrl ?? null;

  const [paso, setPaso] = useState(0);
  const [fotoUri, setFotoUri] = useState(null);          // foto nueva elegida acá
  const [fechaNacimiento, setFechaNacimiento] = useState(() => parseFechaLocal(perfilActual?.fechaNacimiento));
  const [verFecha, setVerFecha] = useState(false);
  const [genero, setGenero] = useState(perfilActual?.genero ?? null);
  const [intereses, setIntereses] = useState(perfilActual?.intereses ?? []);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // La que se muestra en la vista previa: la nueva si eligió una, si no la ya cargada
  const fotoMostrada = fotoUri ?? fotoExistente;

  const edad = calcularEdadAnios(fechaNacimiento);

  const toggleInteres = (label) => {
    setError(null);
    setIntereses((list) => {
      if (list.includes(label)) return list.filter((i) => i !== label);
      // Tope de 5: la tarjeta muestra 3 y el resto queda en "+N". Sin límite,
      // se elegían quince y no significaban nada.
      if (list.length >= MAX_INTERESES) return list;
      return [...list, label];
    });
  };

  const elegirDeGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Sin permiso', 'Habilitá el acceso a la galería desde la configuración del dispositivo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) { setFotoUri(res.assets[0].uri); setError(null); }
  };

  const abrirCamara = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Sin permiso', 'Habilitá el acceso a la cámara desde la configuración del dispositivo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) { setFotoUri(res.assets[0].uri); setError(null); }
  };

  /** Qué falta en el paso actual (null = se puede avanzar). */
  const validarPaso = () => {
    switch (PASOS[paso]) {
      case 'foto':
        return (!fotoUri && !fotoExistente) ? 'Agregá una foto para poder continuar' : null;
      case 'fecha':
        if (!fechaNacimiento) return 'Elegí tu fecha de nacimiento';
        if (edad < EDAD_MINIMA) return `Tenés que ser mayor de ${EDAD_MINIMA} años`;
        return null;
      case 'genero':
        return !genero ? 'Elegí una opción para continuar' : null;
      case 'intereses':
        return !intereses.length ? 'Elegí al menos un interés' : null;
      default:
        return null;
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarPerfilMatch({ fechaNacimiento: toISODateLocal(fechaNacimiento), genero, intereses, fotoUri });
      onListo();
    } catch {
      Alert.alert('Error', 'No se pudo guardar tu perfil. Revisá tu internet e intentá de nuevo.');
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
    else onCancelar?.();   // en el primer paso, la flecha cierra (si se puede)
  };

  const esUltimo = paso === PASOS.length - 1;
  const puedeVolver = paso > 0 || !!onCancelar;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Barra de progreso: un segmento por paso, como los onboarding de las
            apps de citas. Deja ver cuánto falta, que es lo que evita el abandono. */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={atras} disabled={!puedeVolver}
            style={[s.backBtn, !puedeVolver && { opacity: 0 }]}
            accessibilityLabel={paso > 0 ? 'Paso anterior' : 'Volver a la pantalla anterior'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color={colores.texto} />
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
              <Text style={s.pregunta}>¿Con qué foto querés aparecer?</Text>
              <Text style={s.ayuda}>
                Es la foto tuya que van a ver los demás junto a tu mascota.
              </Text>
              {fotoMostrada
                ? <Image source={{ uri: fotoMostrada }} style={s.preview} />
                : (
                  <View style={[s.preview, s.previewVacio]}>
                    <Ionicons name="person" size={48} color="#BBBBBB" />
                  </View>
                )}
              {fotoExistente && !fotoUri && (
                <Text style={s.nota}>Estamos usando la foto de tu perfil. Podés cambiarla.</Text>
              )}
              <View style={s.fotoBtnsRow}>
                <TouchableOpacity style={s.btnFoto} onPress={elegirDeGaleria} activeOpacity={0.85}>
                  <Ionicons name="images-outline" size={16} color={colores.texto} />
                  <Text style={s.btnFotoText}>Galería</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnFoto} onPress={abrirCamara} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={16} color={colores.texto} />
                  <Text style={s.btnFotoText}>Cámara</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {PASOS[paso] === 'fecha' && (
            <>
              <Text style={s.pregunta}>¿Cuándo naciste?</Text>
              <Text style={s.ayuda}>
                Solo mostramos tu edad, nunca la fecha. Tenés que ser mayor de {EDAD_MINIMA}.
              </Text>
              <TouchableOpacity
                style={[s.inputFecha, error && s.inputError]}
                onPress={() => setVerFecha(true)}
                accessibilityRole="button"
                accessibilityLabel="Elegir fecha de nacimiento"
              >
                <Text style={[s.inputFechaTxt, !fechaNacimiento && { color: colores.textoTenue }]}>
                  {formatearFecha(fechaNacimiento, 'numericaCeros', { vacio: 'DD/MM/AAAA' })}
                </Text>
              </TouchableOpacity>
              <FechaPicker
                visible={verFecha}
                titulo="Fecha de nacimiento"
                valor={fechaNacimiento ?? new Date(new Date().getFullYear() - 25, 0, 1)}
                aniosAtras={100}
                sinFuturo
                onConfirmar={(d) => { setFechaNacimiento(d); setVerFecha(false); setError(null); }}
                onCancelar={() => setVerFecha(false)}
              />
              {edad != null && edad >= EDAD_MINIMA && (
                <Text style={s.nota}>Vas a aparecer como {edad} años.</Text>
              )}
            </>
          )}

          {PASOS[paso] === 'genero' && (
            <>
              <Text style={s.pregunta}>¿Cómo te identificás?</Text>
              <Text style={s.ayuda}>Sirve para los filtros de búsqueda de otras personas.</Text>
              <View style={s.opcionesCol}>
                {GENEROS.map((g) => {
                  const activo = genero === g.key;
                  return (
                    <TouchableOpacity
                      key={g.key}
                      style={[s.opcion, activo && s.opcionOn]}
                      onPress={() => { setGenero(g.key); setError(null); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: activo }}
                    >
                      <Text style={[s.opcionTxt, activo && s.opcionTxtOn]}>{g.label}</Text>
                      {activo && <Ionicons name="checkmark-circle" size={22} color={colores.verde} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {PASOS[paso] === 'intereses' && (
            <>
              <Text style={s.pregunta}>¿Qué te gusta hacer?</Text>
              <Text style={s.ayuda}>
                Elegí hasta {MAX_INTERESES}. Aparecen en tu tarjeta y ayudan a que te encuentren.
              </Text>
              <View style={s.chipsWrap}>
                {INTEREST_OPTIONS.map((label) => {
                  const activo = intereses.includes(label);
                  // Los no elegidos se apagan al llegar al tope, para que se
                  // entienda por qué dejan de responder.
                  const bloqueado = !activo && intereses.length >= MAX_INTERESES;
                  return (
                    <View key={label} style={bloqueado ? { opacity: 0.4 } : null}>
                      <FilterChip label={label} selected={activo} onPress={() => toggleInteres(label)} />
                    </View>
                  );
                })}
              </View>
              <Text style={s.nota}>{intereses.length}/{MAX_INTERESES} elegidos</Text>
            </>
          )}

          {!!error && <Text style={s.errorTxt}>{error}</Text>}
        </ScrollView>

        <TouchableOpacity style={s.btnContinuar} onPress={siguiente} disabled={guardando} activeOpacity={0.85}>
          {guardando
            ? <ActivityIndicator size="small" color={colores.blanco} />
            : <Text style={s.btnContinuarTxt}>{esUltimo ? 'Empezar a swipear' : 'Continuar'}</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colores.mentaClara },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  backBtn: { width: 30 },
  progreso: { flex: 1, flexDirection: 'row', gap: 5 },
  segmento: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' },
  segmentoOn: { backgroundColor: colores.verde },
  contadorPaso: { fontSize: 12, fontWeight: '700', color: colores.textoSecundario, width: 30, textAlign: 'right' },

  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  pregunta: { fontSize: 24, fontWeight: '800', color: colores.texto, marginBottom: 8 },
  ayuda: { fontSize: 14, color: colores.textoSecundario, lineHeight: 20, marginBottom: 24 },
  nota: { fontSize: 13, color: colores.textoSecundario, textAlign: 'center', marginTop: 12 },

  preview: {
    width: 150, height: 150, borderRadius: 75, alignSelf: 'center',
    backgroundColor: colores.blanco, borderWidth: 3, borderColor: colores.blanco,
  },
  previewVacio: { alignItems: 'center', justifyContent: 'center', backgroundColor: colores.gris200 },
  fotoBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnFoto: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colores.amarillo, borderRadius: 24, paddingVertical: 13,
  },
  btnFotoText: { fontSize: 14, fontWeight: '700', color: colores.texto },

  inputFecha: {
    backgroundColor: colores.blanco, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center',
  },
  inputFechaTxt: { fontSize: 22, fontWeight: '700', letterSpacing: 2, color: colores.texto },
  inputError: { borderColor: colores.rojo },

  opcionesCol: { gap: 10 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colores.blanco, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  opcionOn: { borderColor: colores.verde },
  opcionTxt: { fontSize: 16, color: colores.texto, fontWeight: '600' },
  opcionTxtOn: { color: colores.verde, fontWeight: '700' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  errorTxt: { fontSize: 13, color: colores.rojo, marginTop: 14, textAlign: 'center', fontWeight: '600' },

  btnContinuar: {
    backgroundColor: colores.verde, borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 24, marginBottom: 20,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: colores.blanco },
});
