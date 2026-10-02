/**
 * PaseadorRegistroScreen.jsx — Alta de paseador en 2 pasos
 *
 *   Paso 1 · Tus datos      (nombre, apellido, mail, teléfono, contraseña)
 *   Paso 2 · Cómo trabajás  (zona, precios, perros por paseo, tamaños, bio)
 *
 * Con route.params.activar ({ email, hash, nombre }) viene de una cuenta de
 * dueño existente: se saltea el paso 1 y sólo se suma el perfil de paseador.
 * Con route.params.completar la cuenta YA tiene el rol de paseador pero no su
 * perfil (ej. rol asignado a mano): también se saltea el paso 1.
 *
 * La zona se elige arrastrando un círculo en el mapa (ZonaMapaPicker).
 * La FOTO DE LA CARA es obligatoria (es lo primero que ve un dueño antes de
 * dejarle su mascota): en cuenta nueva va en el paso 1; si la cuenta ya
 * existe y no tiene foto, se pide arriba del paso 2.
 * Al terminar entra directo a la app (el paseador viene a trabajar).
 */

import { useEffect, useRef, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';

import { C, PillButton, sombra } from '../../components/paseador/PaseadorUI';
import {
  HORARIOS_DEFAULT, activarPaseador, completarPerfilPaseador, fetchMiFotoPerfil, formatoPlata,
  registrarPaseador,
} from '../../services/paseadorApi';
import ZonaMapaPicker from '../../components/paseador/ZonaMapaPicker';
import { actualizarMiFotoPerfil } from '../../services/perfilApi';
import { alerta } from '../../utils/dialogo';
import { verificarDisponibilidad } from '../../services/authApi';
import { sanitizarDigitos } from '../../utils/sanitizar';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAMANOS = [
  { key: 'chico', label: 'Chico', detalle: 'hasta 10 kg' },
  { key: 'mediano', label: 'Mediano', detalle: '10–25 kg' },
  { key: 'grande', label: 'Grande', detalle: '+25 kg' },
];

function Campo({ label, error, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
      {error ? <Text style={s.errorCampo}>{error}</Text> : null}
    </View>
  );
}

/** Campo "Foto de tu cara": círculo con la vista previa + cámara / galería. */
function CampoFoto({ uri, error, onElegir }) {
  const elegir = async (camara) => {
    const permiso = camara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      alerta('Sin permiso', `Habilitá el acceso a la ${camara ? 'cámara' : 'galería'} desde la configuración del dispositivo.`);
      return;
    }
    const opciones = { quality: 0.7, allowsEditing: true, aspect: [1, 1] };
    const res = camara
      ? await ImagePicker.launchCameraAsync({ ...opciones, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync({ ...opciones, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!res.canceled && res.assets?.[0]?.uri) onElegir(res.assets[0].uri);
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>Foto de tu cara</Text>
      <View style={s.fotoFila}>
        <TouchableOpacity onPress={() => elegir(false)} accessibilityLabel="Elegir foto"
          style={[s.fotoCirculo, error && { borderColor: C.rojo }]}>
          {uri
            ? <Image source={{ uri }} style={s.fotoImg} />
            : <Ionicons name="person" size={38} color={C.gris} />}
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 8 }}>
          <TouchableOpacity style={s.fotoBtn} onPress={() => elegir(true)}>
            <Ionicons name="camera" size={16} color={C.teal} />
            <Text style={s.fotoBtnTxt}>Sacar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.fotoBtn} onPress={() => elegir(false)}>
            <Ionicons name="images" size={16} color={C.teal} />
            <Text style={s.fotoBtnTxt}>{uri ? 'Cambiar foto' : 'Elegir de la galería'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <Text style={s.ayuda}>Que se te vea bien la cara: es lo primero que ven los dueños antes de confiarte a su mascota.</Text>
      {error ? <Text style={s.errorCampo}>{error}</Text> : null}
    </View>
  );
}

export default function PaseadorRegistroScreen() {
  const navigation = useNavigation();
  const { activar, completar } = useRoute().params ?? {};
  const sinPaso1 = !!(activar || completar);

  const [paso, setPaso] = useState(sinPaso1 ? 2 : 1);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [cargando, setCargando] = useState(false);
  const scrollRef = useRef(null);
  const [foto, setFoto] = useState(null);
  // Foto que la cuenta YA tenía (dueño que activa / cuenta que completa): no se vuelve a pedir
  const [fotoExistente, setFotoExistente] = useState(activar?.fotoPerfil ?? null);
  // Si la cuenta se creó pero falló la subida de la foto, reintentar sólo la foto
  const cuentaCreadaRef = useRef(false);

  useEffect(() => {
    if (completar) fetchMiFotoPerfil().then((f) => f && setFotoExistente(f)).catch(() => {});
  }, [completar]);

  const pideFotoEnPaso2 = sinPaso1 && !fotoExistente;

  const [usuario, setUsuario] = useState({
    nombre: '', apellido: '', email: '', telefono: '', password: '', password2: '',
  });
  const [perfil, setPerfil] = useState({
    zona: '', lat: null, lng: null, radioKm: 3, precio30: '', precio60: '', maxPerros: 3,
    tamanos: ['chico', 'mediano', 'grande'], experienciaAnios: '', bio: '',
  });

  const setU = (k, v) => { setUsuario((p) => ({ ...p, [k]: v })); setErrores((e) => ({ ...e, [k]: null })); };
  const setP = (k, v) => { setPerfil((p) => ({ ...p, [k]: v })); setErrores((e) => ({ ...e, [k]: null })); };

  const validarPaso1 = async () => {
    const e = {};
    if (!foto) e.foto = 'Es necesario una foto de tu cara';
    if (usuario.nombre.trim().length < 2) e.nombre = 'El nombre es obligatorio';
    if (usuario.apellido.trim().length < 2) e.apellido = 'El apellido es obligatorio';
    if (!EMAIL_REGEX.test(usuario.email.trim())) e.email = 'Es necesario un email válido';
    if (usuario.telefono.length < 8) e.telefono = 'El teléfono es obligatorio (mínimo 8 números)';
    if (usuario.password.length < 7) e.password = 'La contraseña necesita al menos 7 caracteres';
    else if (usuario.password !== usuario.password2) e.password2 = 'Las contraseñas no coinciden';
    if (!e.email) {
      // Máximo 3 s: si la red tarda, se sigue (el servidor igual rechaza mails repetidos)
      const { mailTomado } = await Promise.race([
        verificarDisponibilidad({ email: usuario.email }).catch(() => ({ mailTomado: false })),
        new Promise((resolve) => setTimeout(() => resolve({ mailTomado: false }), 3000)),
      ]);
      if (mailTomado) e.email = 'Ya hay una cuenta con este mail. Iniciá sesión y activá el perfil de paseador.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const validarPaso2 = () => {
    const e = {};
    if (pideFotoEnPaso2 && !foto) e.foto = 'Es necesario una foto de tu cara';
    if (perfil.lat == null) e.zona = 'Es necesario marcar tu zona en el mapa';
    if (!(Number(perfil.precio30) > 0)) e.precio30 = 'Es necesario el precio del paseo de 30 minutos';
    if (!(Number(perfil.precio60) > 0)) e.precio60 = 'Es necesario el precio del paseo de 60 minutos';
    if (!perfil.tamanos.length) e.tamanos = 'Es necesario elegir al menos un tamaño de perro';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const continuar = async () => {
    setErrorGeneral(null);
    if (paso === 1) {
      setCargando(true);
      const ok = await validarPaso1().finally(() => setCargando(false));
      if (ok) {
        setPaso(2);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      } else {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      return;
    }
    if (!validarPaso2()) {
      // El error de la zona está arriba (mapa): subir. Los de precios/tamaños
      // quedan cerca, pero el resumen junto al botón los dice igual.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    const datosPerfil = {
      ...perfil,
      precio30: Number(perfil.precio30),
      precio60: Number(perfil.precio60),
      experienciaAnios: Number(perfil.experienciaAnios) || 0,
      zona: perfil.zona.trim() || 'Mi zona',
    };
    setCargando(true);
    try {
      if (!cuentaCreadaRef.current) {
        if (completar) {
          await completarPerfilPaseador(datosPerfil);
        } else if (activar) {
          await activarPaseador({ email: activar.email, hash: activar.hash, perfil: datosPerfil });
        } else {
          await registrarPaseador({ usuario, perfil: datosPerfil });
        }
        cuentaCreadaRef.current = true;
      }

      // La foto se sube con la sesión ya iniciada (va a "User".FotoPerfil,
      // la misma que usa el perfil de dueño)
      let fotoUrl = fotoExistente;
      if (foto) {
        try {
          fotoUrl = await actualizarMiFotoPerfil(foto);
        } catch (errFoto) {
          console.error('[Registro paseador] foto', errFoto);
          setErrorGeneral('Tu cuenta quedó creada, pero no se pudo subir la foto. Es necesario subirla para continuar: tocá el botón de nuevo.');
          return;
        }
      }
      // El perfil viaja a la home: si la base no lo deja leer, se usa esta copia
      const perfilLocal = {
        idUser: null,
        nombre: usuario.nombre.trim() || activar?.nombre || '',
        apellido: usuario.apellido.trim(),
        foto: fotoUrl ?? null,
        ...datosPerfil,
        zonas: [],
        disponible: false,
        horarios: HORARIOS_DEFAULT(),
        verificado: false,
      };
      navigation.reset({
        index: 0,
        routes: [{ name: 'PaseadorApp', params: { bienvenida: true, desdeRegistro: true, perfilLocal } }],
      });
    } catch (err) {
      const msg = err?.message;
      // El detalle real de Supabase queda en la consola y en pantalla
      console.error('[Registro paseador]', msg, err?.detalle ?? err);
      const detalle = err?.detalle ? `\n\nDetalle: ${err.detalle}` : '';
      if (msg === 'email_existente') {
        setPaso(1);
        setErrores({ email: 'Ya hay una cuenta con este mail.' });
      } else if (msg === 'migracion_pendiente') {
        setErrorGeneral(`No se pudo guardar tu perfil: a la base de datos le falta algo de Zooni Paseadores. Es necesario correr las migraciones 035 y 036 en el SQL Editor de Supabase.${detalle}`);
      } else if (msg === 'no_es_paseador') {
        setErrorGeneral('Esta cuenta todavía no tiene el rol de paseador. Iniciá sesión desde "Registrarse como Proveedor".');
      } else if (msg === 'credenciales') {
        setErrorGeneral('Es necesario volver a iniciar sesión: tu contraseña no coincide.');
      } else {
        setErrorGeneral(`La base de datos rechazó el registro.${detalle || `\n\nDetalle: ${err?.message ?? 'error desconocido'}`}`);
      }
    } finally {
      setCargando(false);
    }
  };

  const volver = () => {
    if (paso === 2 && !sinPaso1) setPaso(1);
    else navigation.goBack();
  };

  const toggleTamano = (k) => {
    setP('tamanos', perfil.tamanos.includes(k)
      ? perfil.tamanos.filter((t) => t !== k)
      : [...perfil.tamanos, k]);
  };

  const totalPasos = sinPaso1 ? 1 : 2;
  const pasoVisible = sinPaso1 ? 1 : paso;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.menta} />
      <View style={s.top}>
        <TouchableOpacity onPress={volver} style={s.volver} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={26} color={C.teal} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.topTitulo}>{paso === 1 ? 'Tus datos' : 'Cómo trabajás'}</Text>
          <Text style={s.topSub}>Paso {pasoVisible} de {totalPasos} · Zooni Paseadores</Text>
        </View>
      </View>
      <View style={s.progreso}>
        <View style={[s.progresoFill, { width: `${(pasoVisible / totalPasos) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {paso === 1 ? (
            <View style={s.card}>
              <CampoFoto uri={foto} error={errores.foto}
                onElegir={(u) => { setFoto(u); setErrores((e) => ({ ...e, foto: null })); }} />
              <View style={s.fila}>
                <View style={{ flex: 1 }}>
                  <Campo label="Nombre" error={errores.nombre}>
                    <TextInput style={[s.input, errores.nombre && s.inputError]} value={usuario.nombre}
                      onChangeText={(v) => setU('nombre', v.slice(0, 50))} placeholder="Juan" placeholderTextColor={C.gris} />
                  </Campo>
                </View>
                <View style={{ flex: 1 }}>
                  <Campo label="Apellido" error={errores.apellido}>
                    <TextInput style={[s.input, errores.apellido && s.inputError]} value={usuario.apellido}
                      onChangeText={(v) => setU('apellido', v.slice(0, 50))} placeholder="Pérez" placeholderTextColor={C.gris} />
                  </Campo>
                </View>
              </View>
              <Campo label="Correo electrónico" error={errores.email}>
                <TextInput style={[s.input, errores.email && s.inputError]} value={usuario.email}
                  onChangeText={(v) => setU('email', v.trim())} placeholder="vos@mail.com" placeholderTextColor={C.gris}
                  keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              </Campo>
              <Campo label="Teléfono" error={errores.telefono}>
                <TextInput style={[s.input, errores.telefono && s.inputError]} value={usuario.telefono}
                  onChangeText={(v) => setU('telefono', sanitizarDigitos(v, 15))} placeholder="11 2345 6789" placeholderTextColor={C.gris}
                  keyboardType="phone-pad" />
              </Campo>
              <Campo label="Contraseña" error={errores.password}>
                <TextInput style={[s.input, errores.password && s.inputError]} value={usuario.password}
                  onChangeText={(v) => setU('password', v)} placeholder="Mínimo 7 caracteres" placeholderTextColor={C.gris}
                  secureTextEntry autoCapitalize="none" />
              </Campo>
              <Campo label="Repetí la contraseña" error={errores.password2}>
                <TextInput style={[s.input, errores.password2 && s.inputError]} value={usuario.password2}
                  onChangeText={(v) => setU('password2', v)} placeholder="Repetila" placeholderTextColor={C.gris}
                  secureTextEntry autoCapitalize="none" />
              </Campo>
            </View>
          ) : (
            <View style={s.card}>
              {pideFotoEnPaso2 && (
                <CampoFoto uri={foto} error={errores.foto}
                  onElegir={(u) => { setFoto(u); setErrores((e) => ({ ...e, foto: null })); }} />
              )}
              {activar ? (
                <Text style={s.intro}>
                  ¡Genial{activar.nombre ? `, ${activar.nombre}` : ''}! Completá cómo trabajás y listo: vas a poder
                  cambiar entre dueño y paseador con la misma cuenta.
                </Text>
              ) : completar ? (
                <Text style={s.intro}>
                  Tu cuenta ya es de paseador. Completá cómo trabajás para empezar a recibir solicitudes.
                </Text>
              ) : null}

              <Text style={s.label}>¿Dónde paseás?</Text>
              <ZonaMapaPicker
                valor={{ lat: perfil.lat, lng: perfil.lng, radioKm: perfil.radioKm, zona: perfil.zona }}
                onCambio={(z) => {
                  setPerfil((p) => ({ ...p, lat: z.lat, lng: z.lng, radioKm: z.radioKm, zona: z.zona ?? '' }));
                  setErrores((e) => ({ ...e, zona: null }));
                }}
              />
              {errores.zona ? <Text style={s.errorCampo}>{errores.zona}</Text> : null}
              <View style={{ height: 18 }} />

              <Text style={s.label}>Tus precios</Text>
              <View style={s.fila}>
                <View style={[s.precio, errores.precio30 && s.inputError]}>
                  <Text style={s.precioDur}>30 minutos</Text>
                  <View style={s.precioInputRow}>
                    <Text style={s.precioSigno}>$</Text>
                    <TextInput style={s.precioInput} value={perfil.precio30} keyboardType="number-pad"
                      onChangeText={(v) => setP('precio30', sanitizarDigitos(v, 7))} placeholder="Precio" placeholderTextColor="#C8C8C8" />
                  </View>
                </View>
                <View style={[s.precio, errores.precio60 && s.inputError]}>
                  <Text style={s.precioDur}>60 minutos</Text>
                  <View style={s.precioInputRow}>
                    <Text style={s.precioSigno}>$</Text>
                    <TextInput style={s.precioInput} value={perfil.precio60} keyboardType="number-pad"
                      onChangeText={(v) => setP('precio60', sanitizarDigitos(v, 7))} placeholder="Precio" placeholderTextColor="#C8C8C8" />
                  </View>
                </View>
              </View>
              {(errores.precio30 || errores.precio60) && <Text style={s.errorCampo}>Es necesario un precio para 30 y para 60 minutos</Text>}
              {Number(perfil.precio30) > 0 && (
                <Text style={s.ayuda}>Por un paseo de 30 minutos vas a cobrar {formatoPlata(perfil.precio30)}.</Text>
              )}

              <Text style={[s.label, { marginTop: 16 }]}>Perros por paseo (máximo)</Text>
              <View style={s.stepper}>
                <TouchableOpacity style={s.stepBtn} onPress={() => setP('maxPerros', Math.max(1, perfil.maxPerros - 1))}
                  accessibilityLabel="Uno menos">
                  <Ionicons name="remove" size={22} color={C.teal} />
                </TouchableOpacity>
                <Text style={s.stepValor}>{perfil.maxPerros}</Text>
                <TouchableOpacity style={s.stepBtn} onPress={() => setP('maxPerros', Math.min(6, perfil.maxPerros + 1))}
                  accessibilityLabel="Uno más">
                  <Ionicons name="add" size={22} color={C.teal} />
                </TouchableOpacity>
              </View>

              <Text style={[s.label, { marginTop: 16 }]}>Tamaños que aceptás</Text>
              <View style={s.chips}>
                {TAMANOS.map((t) => {
                  const on = perfil.tamanos.includes(t.key);
                  return (
                    <TouchableOpacity key={t.key} style={[s.chip, on && s.chipOn]} onPress={() => toggleTamano(t.key)}
                      accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                      <Text style={[s.chipTxt, on && s.chipTxtOn]}>{t.label}</Text>
                      <Text style={[s.chipDetalle, on && { color: '#FFFFFF' }]}>{t.detalle}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errores.tamanos && <Text style={s.errorCampo}>{errores.tamanos}</Text>}

              <Campo label="Años de experiencia">
                <TextInput style={[s.input, { marginTop: 0 }]} value={perfil.experienciaAnios} keyboardType="number-pad"
                  onChangeText={(v) => setP('experienciaAnios', sanitizarDigitos(v, 2))} placeholder="0" placeholderTextColor={C.gris} />
              </Campo>

              <Campo label="Contales a los dueños sobre vos (opcional)">
                <TextInput style={[s.input, s.textarea]} value={perfil.bio} multiline maxLength={500}
                  onChangeText={(v) => setP('bio', v)} placeholderTextColor={C.gris}
                  placeholder="Ej: Paseo por Parque Centenario, mando fotos durante el paseo." />
              </Campo>
            </View>
          )}

          {Object.values(errores).some(Boolean) && (
            <View style={s.resumen}>
              <Text style={s.resumenTitulo}>Para continuar es necesario:</Text>
              {Object.values(errores).filter(Boolean).map((m) => (
                <Text key={m} style={s.resumenItem}>• {m}</Text>
              ))}
            </View>
          )}
          {errorGeneral && <Text style={s.errorGeneral}>{errorGeneral}</Text>}

          <PillButton
            titulo={paso === 1 ? 'Continuar' : '¡Empezar a pasear!'}
            onPress={continuar}
            cargando={cargando}
            style={{ marginTop: 18 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo, overflow: 'hidden' },
  top: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.menta, paddingHorizontal: 12, paddingVertical: 12,
  },
  volver: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitulo: { fontSize: 20, fontWeight: '800', color: C.texto },
  topSub: { fontSize: 12, fontWeight: '600', color: C.teal, marginTop: 1 },
  progreso: { height: 4, backgroundColor: C.menta },
  progresoFill: { height: 4, backgroundColor: C.teal, borderTopRightRadius: 2, borderBottomRightRadius: 2 },

  scroll: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 18, ...sombra },
  intro: { fontSize: 14, color: C.texto2, lineHeight: 20, marginBottom: 16 },
  fila: { flexDirection: 'row', gap: 10 },

  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.texto, backgroundColor: '#FFFFFF',
  },
  inputError: { borderColor: C.rojo },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  errorCampo: { fontSize: 12, color: C.rojo, marginTop: 4 },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 6 },

  precio: {
    flex: 1, borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 14, padding: 12, backgroundColor: C.fondo,
  },
  precioDur: { fontSize: 12, fontWeight: '700', color: C.teal },
  precioInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  precioSigno: { fontSize: 22, fontWeight: '900', color: C.texto, marginRight: 2 },
  precioInput: { flex: 1, fontSize: 22, fontWeight: '900', color: C.texto, paddingVertical: 2, minWidth: 0 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValor: { fontSize: 26, fontWeight: '900', color: C.texto, minWidth: 30, textAlign: 'center' },

  chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: C.menta, paddingVertical: 10,
    alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: C.teal, borderColor: C.teal },
  chipTxt: { fontSize: 14, fontWeight: '800', color: C.texto },
  chipTxtOn: { color: '#FFFFFF' },
  chipDetalle: { fontSize: 11, color: C.texto2, marginTop: 2 },

  fotoFila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fotoCirculo: {
    width: 92, height: 92, borderRadius: 46, borderWidth: 2.5, borderColor: C.teal, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.fondo, overflow: 'hidden',
  },
  fotoImg: { width: '100%', height: '100%' },
  fotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1.5, borderColor: C.teal, alignSelf: 'flex-start',
  },
  fotoBtnTxt: { fontSize: 13, fontWeight: '800', color: C.teal },
  errorGeneral: {
    fontSize: 13, color: C.rojo, marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: '#FDECEE', borderWidth: 1, borderColor: '#F5B7BD',
  },
  resumen: {
    marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: '#FDECEE',
    borderWidth: 1, borderColor: '#F5B7BD',
  },
  resumenTitulo: { fontSize: 13, fontWeight: '800', color: C.rojo, marginBottom: 4 },
  resumenItem: { fontSize: 13, color: C.texto, marginTop: 2 },
});
