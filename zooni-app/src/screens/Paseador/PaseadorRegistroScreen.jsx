/**
 * PaseadorRegistroScreen.jsx — Alta de paseador en 2 pasos
 *
 *   Paso 1 · Tus datos      (nombre, apellido, mail, teléfono, contraseña)
 *   Paso 2 · Cómo trabajás  (zona, precios, perros por paseo, tamaños, bio)
 *
 * Con route.params.activar ({ email, hash, nombre }) viene de una cuenta de
 * dueño existente: se saltea el paso 1 y sólo se suma el perfil de paseador.
 * Al terminar entra directo a la app (el paseador viene a trabajar).
 */

import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { C, PillButton, sombra } from '../../components/paseador/PaseadorUI';
import { activarPaseador, formatoPlata, registrarPaseador } from '../../services/paseadorApi';
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

export default function PaseadorRegistroScreen() {
  const navigation = useNavigation();
  const { activar } = useRoute().params ?? {};

  const [paso, setPaso] = useState(activar ? 2 : 1);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [cargando, setCargando] = useState(false);

  const [usuario, setUsuario] = useState({
    nombre: '', apellido: '', email: '', telefono: '', password: '', password2: '',
  });
  const [perfil, setPerfil] = useState({
    zona: '', precio30: '', precio60: '', maxPerros: 3,
    tamanos: ['chico', 'mediano', 'grande'], experienciaAnios: '', bio: '',
  });

  const setU = (k, v) => { setUsuario((p) => ({ ...p, [k]: v })); setErrores((e) => ({ ...e, [k]: null })); };
  const setP = (k, v) => { setPerfil((p) => ({ ...p, [k]: v })); setErrores((e) => ({ ...e, [k]: null })); };

  const validarPaso1 = async () => {
    const e = {};
    if (usuario.nombre.trim().length < 2) e.nombre = 'Ingresá tu nombre';
    if (usuario.apellido.trim().length < 2) e.apellido = 'Ingresá tu apellido';
    if (!EMAIL_REGEX.test(usuario.email.trim())) e.email = 'Ingresá un email válido';
    if (usuario.telefono.length < 8) e.telefono = 'Lo necesitan los dueños para coordinar';
    if (usuario.password.length < 7) e.password = 'Mínimo 7 caracteres';
    else if (usuario.password !== usuario.password2) e.password2 = 'Las contraseñas no coinciden';
    if (!e.email) {
      const { mailTomado } = await verificarDisponibilidad({ email: usuario.email });
      if (mailTomado) e.email = 'Ya hay una cuenta con este mail. Iniciá sesión y activá el perfil de paseador.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const validarPaso2 = () => {
    const e = {};
    if (perfil.zona.trim().length < 3) e.zona = 'Contanos en qué barrio paseás';
    if (!(Number(perfil.precio30) > 0)) e.precio30 = 'Poné un precio';
    if (!(Number(perfil.precio60) > 0)) e.precio60 = 'Poné un precio';
    if (!perfil.tamanos.length) e.tamanos = 'Elegí al menos un tamaño';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const continuar = async () => {
    setErrorGeneral(null);
    if (paso === 1) {
      setCargando(true);
      const ok = await validarPaso1().finally(() => setCargando(false));
      if (ok) setPaso(2);
      return;
    }
    if (!validarPaso2()) return;

    const datosPerfil = {
      ...perfil,
      precio30: Number(perfil.precio30),
      precio60: Number(perfil.precio60),
      experienciaAnios: Number(perfil.experienciaAnios) || 0,
    };
    setCargando(true);
    try {
      if (activar) {
        await activarPaseador({ email: activar.email, hash: activar.hash, perfil: datosPerfil });
      } else {
        await registrarPaseador({ usuario, perfil: datosPerfil });
      }
      navigation.reset({ index: 0, routes: [{ name: 'PaseadorApp', params: { bienvenida: true } }] });
    } catch (err) {
      const msg = err?.message;
      if (msg === 'email_existente') {
        setPaso(1);
        setErrores({ email: 'Ya hay una cuenta con este mail.' });
      } else if (msg === 'migracion_pendiente') {
        setErrorGeneral('Falta preparar la base de datos (migración 035). Avisale al equipo.');
      } else if (msg === 'credenciales') {
        setErrorGeneral('Tu sesión venció. Volvé a iniciar sesión.');
      } else {
        setErrorGeneral('No se pudo crear tu perfil. Revisá tu conexión e intentá de nuevo.');
      }
    } finally {
      setCargando(false);
    }
  };

  const volver = () => {
    if (paso === 2 && !activar) setPaso(1);
    else navigation.goBack();
  };

  const toggleTamano = (k) => {
    setP('tamanos', perfil.tamanos.includes(k)
      ? perfil.tamanos.filter((t) => t !== k)
      : [...perfil.tamanos, k]);
  };

  const totalPasos = activar ? 1 : 2;
  const pasoVisible = activar ? 1 : paso;

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
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {paso === 1 ? (
            <View style={s.card}>
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
                  onChangeText={(v) => setU('password2', v)} placeholderTextColor={C.gris}
                  secureTextEntry autoCapitalize="none" />
              </Campo>
            </View>
          ) : (
            <View style={s.card}>
              {activar ? (
                <Text style={s.intro}>
                  ¡Genial{activar.nombre ? `, ${activar.nombre}` : ''}! Completá cómo trabajás y listo: vas a poder
                  cambiar entre dueño y paseador con la misma cuenta.
                </Text>
              ) : null}

              <Campo label="¿En qué barrio paseás?" error={errores.zona}>
                <TextInput style={[s.input, errores.zona && s.inputError]} value={perfil.zona}
                  onChangeText={(v) => setP('zona', v.slice(0, 80))} placeholder="Ej: Caballito" placeholderTextColor={C.gris} />
              </Campo>

              <Text style={s.label}>Tus precios</Text>
              <View style={s.fila}>
                <View style={[s.precio, errores.precio30 && s.inputError]}>
                  <Text style={s.precioDur}>30 min</Text>
                  <View style={s.precioInputRow}>
                    <Text style={s.precioSigno}>$</Text>
                    <TextInput style={s.precioInput} value={perfil.precio30} keyboardType="number-pad"
                      onChangeText={(v) => setP('precio30', sanitizarDigitos(v, 7))} placeholder="5000" placeholderTextColor={C.gris} />
                  </View>
                </View>
                <View style={[s.precio, errores.precio60 && s.inputError]}>
                  <Text style={s.precioDur}>60 min</Text>
                  <View style={s.precioInputRow}>
                    <Text style={s.precioSigno}>$</Text>
                    <TextInput style={s.precioInput} value={perfil.precio60} keyboardType="number-pad"
                      onChangeText={(v) => setP('precio60', sanitizarDigitos(v, 7))} placeholder="9000" placeholderTextColor={C.gris} />
                  </View>
                </View>
              </View>
              {(errores.precio30 || errores.precio60) && <Text style={s.errorCampo}>Poné un precio para cada duración</Text>}
              {Number(perfil.precio30) > 0 && (
                <Text style={s.ayuda}>Por un paseo de 30 min vas a cobrar {formatoPlata(perfil.precio30)}.</Text>
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
  safe: { flex: 1, backgroundColor: C.fondo },
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

  errorGeneral: { fontSize: 13, color: C.rojo, textAlign: 'center', marginTop: 14 },
});
