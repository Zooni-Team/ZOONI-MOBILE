/**
 * PaseadorRegistroScreen.jsx — Alta de paseador en 2 pasos
 *
 *   Paso 1 · Tus datos      (nombre, apellido, género, nacimiento, mail, teléfono, contraseña)
 *   Paso 2 · Cómo trabajás  (zona, tiempos de paseo y precios, perros por paseo, tamaños, bio)
 *
 * Con route.params.activar ({ email, hash, nombre }) viene de una cuenta de
 * dueño existente: se saltea el paso 1 y sólo se suma el perfil de paseador.
 * Con route.params.social ({ email, nombre, apellido, foto, proveedor }) viene
 * de "Continuar con Google / Facebook / Apple" sin cuenta: el paso 1 no pide
 * mail ni contraseña y la foto del proveedor sirve como foto de la cara.
 * Con route.params.activarSocial ({ nombre, fotoPerfil }) es un dueño que entró
 * con su proveedor y se suma como paseador: como `activar`, sin contraseña.
 * Con route.params.completar la cuenta YA tiene el rol de paseador pero no su
 * perfil (ej. rol asignado a mano): también se saltea el paso 1.
 *
 * La zona se elige arrastrando un círculo en el mapa (ZonaMapaPicker) y el
 * radio lo escribe el paseador en km: no viene ninguno elegido de entrada.
 * Los tiempos de paseo tampoco son fijos: el paseador carga cuántos minutos
 * dura cada paseo que ofrece y cuánto cobra (ServiciosEditor).
 * La FOTO DE LA CARA es obligatoria (es lo primero que ve un dueño antes de
 * dejarle su mascota): en cuenta nueva va en el paso 1; si la cuenta ya
 * existe y no tiene foto, se pide arriba del paso 2.
 * Al terminar entra directo a la app (el paseador viene a trabajar).
 *
 * La edad se pide como FECHA DE NACIMIENTO (igual que en mascotas): una edad
 * fija queda vieja. Hay que ser mayor de EDAD_MINIMA para pasear perros ajenos.
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
  HORARIOS_DEFAULT, activarPaseador, activarPaseadorSocial, completarPerfilPaseador, fetchMiFotoPerfil,
  registrarPaseadorSocial,
  registrarPaseador, validarServicios,
} from '../../services/paseadorApi';
import CantidadPerros from '../../components/paseador/CantidadPerros';
import ServiciosEditor, { filasDesdeServicios, serviciosDesdeFilas } from '../../components/paseador/ServiciosEditor';
import FechaPicker from '../../components/FechaPicker';
import ZonaMapaPicker, { RADIO_MAX, RADIO_MIN } from '../../components/paseador/ZonaMapaPicker';
import { actualizarMiFotoPerfil } from '../../services/perfilApi';
import { alerta } from '../../utils/dialogo';
import { verificarDisponibilidad } from '../../services/authApi';
import BotonesSociales from '../../components/BotonesSociales';
import { volverOLogin } from '../../utils/volverOLogin';
import { sanitizarDigitos } from '../../utils/sanitizar';
import { toISODateLocal } from '../../utils/fechaLocal';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EDAD_MINIMA = 18;
const EDAD_MAXIMA = 100;
const GENEROS = [
  { key: 'masculino', label: 'Masculino' },
  { key: 'femenino', label: 'Femenino' },
  { key: 'prefiero_no_decir', label: 'Prefiero no decir' },
];
const TAMANOS = [
  { key: 'chico', label: 'Chico', detalle: 'hasta 10 kg' },
  { key: 'mediano', label: 'Mediano', detalle: '10–25 kg' },
  { key: 'grande', label: 'Grande', detalle: '+25 kg' },
];

function edadDe(nacimiento, hoy = new Date()) {
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const cumplioEsteAnio = hoy.getMonth() > nacimiento.getMonth()
    || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
  if (!cumplioEsteAnio) edad -= 1;
  return edad;
}

function Campo({ label, error, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
      {error ? <Text style={s.errorCampo}>{error}</Text> : null}
    </View>
  );
}

/** Input de contraseña con el ojito para mostrarla u ocultarla. */
function InputPassword({ value, onChangeText, placeholder, error }) {
  const [ver, setVer] = useState(false);
  return (
    <View style={[s.input, s.inputPassWrap, error && s.inputError]}>
      <TextInput style={s.inputPass} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={C.gris}
        secureTextEntry={!ver} autoCapitalize="none" autoCorrect={false}
        autoComplete="new-password" textContentType="newPassword" />
      <TouchableOpacity onPress={() => setVer((v) => !v)} hitSlop={8}
        accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        <Ionicons name={ver ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.texto2} />
      </TouchableOpacity>
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
  const { activar, completar, social, activarSocial } = useRoute().params ?? {};
  const sinPaso1 = !!(activar || completar || activarSocial);

  const [paso, setPaso] = useState(sinPaso1 ? 2 : 1);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [cargando, setCargando] = useState(false);
  const scrollRef = useRef(null);
  const [foto, setFoto] = useState(null);
  // Foto que la cuenta YA tenía (dueño que activa / cuenta que completa): no se vuelve a pedir
  const [fotoExistente, setFotoExistente] = useState(activar?.fotoPerfil ?? activarSocial?.fotoPerfil ?? null);
  // Foto del proveedor (Google / Facebook): sirve de foto de la cara si no elige otra
  const fotoSocial = /^https:\/\//.test(social?.foto ?? '') ? social.foto : null;
  // Si la cuenta se creó pero falló la subida de la foto, reintentar sólo la foto
  const cuentaCreadaRef = useRef(false);

  useEffect(() => {
    if (completar) fetchMiFotoPerfil().then((f) => f && setFotoExistente(f)).catch(() => {});
  }, [completar]);

  const pideFotoEnPaso2 = sinPaso1 && !fotoExistente;

  const [usuario, setUsuario] = useState({
    nombre: social?.nombre ?? '', apellido: social?.apellido ?? '', genero: null, fechaNacimiento: null,
    email: social?.email ?? '', telefono: '', password: '', password2: '',
  });
  const [verFecha, setVerFecha] = useState(false);
  const edad = usuario.fechaNacimiento ? edadDe(usuario.fechaNacimiento) : null;
  const [perfil, setPerfil] = useState({
    zona: '', lat: null, lng: null, radioKm: null, maxPerros: 3,
    tamanos: ['chico', 'mediano', 'grande'], bio: '',
  });

  const [filasServicios, setFilasServicios] = useState(() => filasDesdeServicios([]));

  const setU = (k, v) => { setUsuario((p) => ({ ...p, [k]: v })); setErrores((e) => ({ ...e, [k]: null })); };
  const setP = (k, v) => { setPerfil((p) => ({ ...p, [k]: v })); setErrores((e) => ({ ...e, [k]: null })); };

  const validarPaso1 = async () => {
    const e = {};
    if (!foto && !fotoSocial) e.foto = 'Es necesario una foto de tu cara';
    if (usuario.nombre.trim().length < 2) e.nombre = 'El nombre es obligatorio';
    if (usuario.apellido.trim().length < 2) e.apellido = 'El apellido es obligatorio';
    if (!usuario.genero) e.genero = 'Es necesario elegir una opción de género';
    if (!usuario.fechaNacimiento) e.fechaNacimiento = 'Es necesario tu fecha de nacimiento';
    else if (edad < EDAD_MINIMA) e.fechaNacimiento = `Para ser paseador es necesario tener al menos ${EDAD_MINIMA} años`;
    else if (edad > EDAD_MAXIMA) e.fechaNacimiento = 'Revisá tu fecha de nacimiento';
    if (usuario.telefono.length < 8) e.telefono = 'El teléfono es obligatorio (mínimo 8 números)';
    // Con Google / Facebook / Apple el mail lo verificó el proveedor y no hay contraseña
    if (!social) {
      if (!EMAIL_REGEX.test(usuario.email.trim())) e.email = 'Es necesario un email válido';
      if (usuario.password.length < 7) e.password = 'La contraseña necesita al menos 7 caracteres';
      else if (usuario.password !== usuario.password2) e.password2 = 'Las contraseñas no coinciden';
    }
    if (!social && !e.email) {
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
    if (perfil.radioKm == null) e.radioKm = `Es necesario elegir tu radio de atención (entre ${String(RADIO_MIN).replace('.', ',')} y ${RADIO_MAX} km)`;
    const errServicios = validarServicios(filasServicios);
    if (errServicios) e.servicios = errServicios;
    if (!(perfil.maxPerros >= 1)) e.maxPerros = 'Es necesario indicar cuántos perros sacás por paseo (al menos 1)';
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
      servicios: serviciosDesdeFilas(filasServicios),
      zona: perfil.zona.trim() || 'Mi zona',
    };
    setCargando(true);
    try {
      if (!cuentaCreadaRef.current) {
        if (completar) {
          await completarPerfilPaseador(datosPerfil);
        } else if (activar) {
          await activarPaseador({ email: activar.email, hash: activar.hash, perfil: datosPerfil });
        } else if (activarSocial) {
          await activarPaseadorSocial(datosPerfil);
        } else if (social) {
          await registrarPaseadorSocial({
            usuario: { ...usuario, fechaNacimiento: toISODateLocal(usuario.fechaNacimiento) },
            perfil: datosPerfil,
            // Si eligió una foto propia se sube después; si no, queda la del proveedor
            fotoPerfil: foto ? null : fotoSocial,
          });
        } else {
          await registrarPaseador({
            usuario: { ...usuario, fechaNacimiento: toISODateLocal(usuario.fechaNacimiento) },
            perfil: datosPerfil,
          });
        }
        cuentaCreadaRef.current = true;
      }

      // La foto se sube con la sesión ya iniciada (va a "User".FotoPerfil,
      // la misma que usa el perfil de dueño)
      let fotoUrl = fotoExistente ?? (foto ? null : fotoSocial);
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
        nombre: usuario.nombre.trim() || activar?.nombre || activarSocial?.nombre || '',
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
      } else if (/servicios_invalidos/.test(err?.detalle ?? '')) {
        setErrores({ servicios: 'Revisá tus tiempos de paseo: cada uno necesita duración y precio' });
      } else if (/genero_invalido|edad_invalida/.test(err?.detalle ?? '')) {
        setPaso(1);
        setErrores(String(err.detalle).includes('genero_invalido')
          ? { genero: 'Es necesario elegir una opción de género' }
          : { fechaNacimiento: `Para ser paseador es necesario tener al menos ${EDAD_MINIMA} años` });
      } else if (msg === 'sesion_social_vencida') {
        setErrorGeneral(`Se venció el inicio de sesión con ${social?.proveedor ?? 'tu cuenta'}. Volvé al inicio y entrá de nuevo.`);
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
    else volverOLogin(navigation, 'PaseadorLogin');
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
              {social ? (
                <View style={s.socialInfo}>
                  <Ionicons name="shield-checkmark" size={18} color={C.teal} />
                  <Text style={s.socialInfoTxt}>
                    Entraste con {social.proveedor} (<Text style={{ fontWeight: '800' }}>{social.email}</Text>).
                    No hace falta contraseña: completá tus datos y listo.
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: -16, marginBottom: 14 }}>
                  <BotonesSociales intencion="paseador" titulo="Registrate más rápido con" />
                </View>
              )}
              <CampoFoto uri={foto ?? fotoSocial} error={errores.foto}
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
              <Campo label="Género" error={errores.genero}>
                <View style={s.generos}>
                  {GENEROS.map((g) => {
                    const on = usuario.genero === g.key;
                    return (
                      <TouchableOpacity key={g.key} style={[s.genero, on && s.chipOn, errores.genero && s.inputError]}
                        onPress={() => setU('genero', g.key)}
                        accessibilityRole="radio" accessibilityState={{ selected: on }}>
                        <Text style={[s.generoTxt, on && s.chipTxtOn]}>{g.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Campo>
              <Campo label="Fecha de nacimiento" error={errores.fechaNacimiento}>
                <TouchableOpacity style={[s.input, s.fechaBtn, errores.fechaNacimiento && s.inputError]}
                  onPress={() => setVerFecha(true)} accessibilityLabel="Elegir fecha de nacimiento">
                  <Text style={[s.fechaTxt, !usuario.fechaNacimiento && { color: C.gris }]}>
                    {usuario.fechaNacimiento
                      ? usuario.fechaNacimiento.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Elegí tu fecha de nacimiento'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={C.teal} />
                </TouchableOpacity>
                {edad != null && !errores.fechaNacimiento ? <Text style={s.ayuda}>Tenés {edad} años</Text> : null}
              </Campo>
              {!social && (
                <Campo label="Correo electrónico" error={errores.email}>
                  <TextInput style={[s.input, errores.email && s.inputError]} value={usuario.email}
                    onChangeText={(v) => setU('email', v.trim())} placeholder="vos@mail.com" placeholderTextColor={C.gris}
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                    // Sin esto el navegador guardaba el TELÉFONO (el campo justo antes de la
                    // contraseña) como usuario, y después lo rellenaba en el login
                    autoComplete="username" textContentType="username" />
                </Campo>
              )}
              <Campo label="Teléfono" error={errores.telefono}>
                <TextInput style={[s.input, errores.telefono && s.inputError]} value={usuario.telefono}
                  onChangeText={(v) => setU('telefono', sanitizarDigitos(v, 15))} placeholder="11 2345 6789" placeholderTextColor={C.gris}
                  keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
              </Campo>
              {!social && (
                <>
                  <Campo label="Contraseña" error={errores.password}>
                    <InputPassword value={usuario.password} error={errores.password}
                      onChangeText={(v) => setU('password', v)} placeholder="Mínimo 7 caracteres" />
                  </Campo>
                  <Campo label="Repetí la contraseña" error={errores.password2}>
                    <InputPassword value={usuario.password2} error={errores.password2}
                      onChangeText={(v) => setU('password2', v)} placeholder="Repetila" />
                  </Campo>
                </>
              )}
            </View>
          ) : (
            <View style={s.card}>
              {pideFotoEnPaso2 && (
                <CampoFoto uri={foto} error={errores.foto}
                  onElegir={(u) => { setFoto(u); setErrores((e) => ({ ...e, foto: null })); }} />
              )}
              {activar || activarSocial ? (
                <Text style={s.intro}>
                  ¡Genial{(activar ?? activarSocial).nombre ? `, ${(activar ?? activarSocial).nombre}` : ''}! Completá cómo trabajás y listo: vas a poder
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
                  setErrores((e) => ({ ...e, zona: null, ...(z.radioKm != null ? { radioKm: null } : {}) }));
                }}
              />
              {errores.zona ? <Text style={s.errorCampo}>{errores.zona}</Text> : null}
              {errores.radioKm ? <Text style={s.errorCampo}>{errores.radioKm}</Text> : null}
              <View style={{ height: 18 }} />

              <Text style={s.label}>Tus paseos y precios</Text>
              <ServiciosEditor
                filas={filasServicios}
                error={errores.servicios}
                onCambio={(f) => { setFilasServicios(f); setErrores((e) => ({ ...e, servicios: null })); }}
              />

              <Text style={[s.label, { marginTop: 16 }]}>Perros por paseo (máximo)</Text>
              <CantidadPerros valor={perfil.maxPerros} error={!!errores.maxPerros}
                onCambio={(n) => setP('maxPerros', n)} />
              {errores.maxPerros ? <Text style={s.errorCampo}>{errores.maxPerros}</Text> : null}

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

              <Campo label="Contales a los dueños sobre vos (opcional)">
                <TextInput style={[s.input, s.textarea]} value={perfil.bio} multiline maxLength={500}
                  onChangeText={(v) => setP('bio', v)} placeholderTextColor={C.gris}
                  placeholder="Ej: Paseo por Parque Centenario, mando fotos durante el paseo." />
              </Campo>
            </View>
          )}

          <FechaPicker
            visible={verFecha}
            titulo="Fecha de nacimiento"
            valor={usuario.fechaNacimiento ?? new Date(new Date().getFullYear() - 25, 0, 1)}
            aniosAtras={EDAD_MAXIMA}
            sinFuturo
            onConfirmar={(d) => { setU('fechaNacimiento', d); setVerFecha(false); }}
            onCancelar={() => setVerFecha(false)}
          />

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
  socialInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.menta,
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  socialInfoTxt: { flex: 1, fontSize: 13, color: C.texto, lineHeight: 18 },

  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.texto, backgroundColor: '#FFFFFF',
  },
  inputError: { borderColor: C.rojo },
  inputPassWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
  inputPass: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.texto },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  errorCampo: { fontSize: 12, color: C.rojo, marginTop: 4 },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 6 },



  chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  generos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genero: {
    flexGrow: 1, borderRadius: 14, borderWidth: 1.5, borderColor: C.menta, paddingVertical: 11,
    paddingHorizontal: 12, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  generoTxt: { fontSize: 14, fontWeight: '700', color: C.texto },
  fechaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fechaTxt: { fontSize: 15, color: C.texto, flex: 1 },
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
