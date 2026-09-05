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

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import FilterChip from './FilterChip';
import { INTEREST_OPTIONS, GENDER_OPTIONS } from '../../data/matchDemo';
import { guardarPerfilMatch } from '../../services/matchApi';

const GENEROS = GENDER_OPTIONS.filter((g) => g.key !== 'todos');
const EDAD_MINIMA = 18;
const MAX_INTERESES = 5;

const PASOS = ['foto', 'fecha', 'genero', 'intereses'];

function edadDesde(dia, mes, anio) {
  const nacimiento = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  if (hoy.getMonth() < nacimiento.getMonth()
    || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) {
    edad -= 1;
  }
  return edad;
}

/** Va insertando las barras mientras se tipea: "20032005" -> "20/03/2005". */
function formatearFecha(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  if (digitos.length > 4) return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
  if (digitos.length > 2) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return digitos;
}

/** Parsea "DD/MM/AAAA" a { dia, mes, anio } numéricos, o null si está incompleta/mal escrita. */
function parsearFecha(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const anio = Number(m[3]);
  if (mes < 1 || mes > 12 || anio < 1900) return null;
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null; // ej: 31/02
  return { dia, mes, anio };
}

/** "1998-03-20" → "20/03/1998" para prellenar el campo si ya hay fecha. */
function isoAFecha(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export default function MatchProfileSetup({ onListo, perfilActual, onCancelar }) {
  // Si ya hay foto de perfil cargada (registro / Perfil), se usa esa directo:
  // no hace falta volver a subirla.
  const fotoExistente = perfilActual?.fotoPerfilUrl ?? null;

  const [paso, setPaso] = useState(0);
  const [fotoUri, setFotoUri] = useState(null);          // foto nueva elegida acá
  const [fechaTexto, setFechaTexto] = useState(isoAFecha(perfilActual?.fechaNacimiento));
  const [genero, setGenero] = useState(perfilActual?.genero ?? null);
  const [intereses, setIntereses] = useState(perfilActual?.intereses ?? []);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // La que se muestra en la vista previa: la nueva si eligió una, si no la ya cargada
  const fotoMostrada = fotoUri ?? fotoExistente;

  const fechaParseada = useMemo(() => parsearFecha(fechaTexto), [fechaTexto]);
  const edad = fechaParseada
    ? edadDesde(fechaParseada.dia, fechaParseada.mes, fechaParseada.anio)
    : null;

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
        if (!fechaTexto) return 'Ingresá tu fecha de nacimiento';
        if (!fechaParseada) return 'Esa fecha no existe, revisala';
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
      const { dia, mes, anio } = fechaParseada;
      const fechaNacimiento = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      await guardarPerfilMatch({ fechaNacimiento, genero, intereses, fotoUri });
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
            accessibilityLabel={paso > 0 ? 'Paso anterior' : 'Cerrar'}
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
                  <Ionicons name="images-outline" size={16} color="#2C2C2C" />
                  <Text style={s.btnFotoText}>Galería</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnFoto} onPress={abrirCamara} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={16} color="#2C2C2C" />
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
              <TextInput
                style={[s.inputFecha, error && s.inputError]}
                placeholder="DD/MM/AAAA" placeholderTextColor="#AAAAAA"
                value={fechaTexto}
                onChangeText={(v) => { setFechaTexto(formatearFecha(v)); setError(null); }}
                keyboardType="number-pad"
                maxLength={10}
                autoFocus
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
                      {activo && <Ionicons name="checkmark-circle" size={22} color="#2DBD72" />}
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
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={s.btnContinuarTxt}>{esUltimo ? 'Empezar a swipear' : 'Continuar'}</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    width: 150, height: 150, borderRadius: 75, alignSelf: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#FFFFFF',
  },
  previewVacio: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFEFEF' },
  fotoBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnFoto: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F5C842', borderRadius: 24, paddingVertical: 13,
  },
  btnFotoText: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },

  inputFecha: {
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: 'transparent', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 14, textAlign: 'center',
    fontSize: 22, fontWeight: '700', letterSpacing: 2, color: '#2C2C2C',
  },
  inputError: { borderColor: '#E63946' },

  opcionesCol: { gap: 10 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  opcionOn: { borderColor: '#2DBD72' },
  opcionTxt: { fontSize: 16, color: '#2C2C2C', fontWeight: '600' },
  opcionTxtOn: { color: '#2DBD72', fontWeight: '700' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  errorTxt: { fontSize: 13, color: '#E63946', marginTop: 14, textAlign: 'center', fontWeight: '600' },

  btnContinuar: {
    backgroundColor: '#2DBD72', borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 24, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
