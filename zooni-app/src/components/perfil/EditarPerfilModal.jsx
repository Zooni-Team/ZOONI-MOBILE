/**
 * EditarPerfilModal.jsx — El editor de perfil, compartido
 *
 * Vive acá y no dentro de PerfilScreen porque se abre desde dos lugares: el
 * botón "Editar perfil" del perfil y el mismo botón dentro de "Así te ven" de
 * Match. Es el MISMO formulario y el mismo `actualizarMiPerfil`, así que lo que
 * se cambia desde Match aparece igual al entrar a Perfil (que recarga al
 * enfocarse) y al revés.
 *
 * `perfil` es opcional: si el que abre el modal ya tiene los datos (Perfil) los
 * pasa y el formulario aparece lleno; si no (Match), se piden con
 * `fetchMiPerfil` al abrirse.
 *
 * `onCerrar` recibe 'navegacion' cuando se cierra para irse a Configuración:
 * quien lo abrió no tiene que reabrir nada encima de la pantalla nueva (un
 * Modal se dibuja por arriba de todo, incluso de la pantalla que se acaba de
 * abrir).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { fetchMiPerfil, actualizarMiPerfil } from '../../services/perfilApi';

const { height: SH } = Dimensions.get('window');

// ─── MODAL ANIMADO (lo usa también el modal de nueva publicación) ─────────────

export function AModal({ visible, onClose, children }) {
  const sc = useRef(new Animated.Value(0.92)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) { sc.setValue(0.92); op.setValue(0); }
    Animated.parallel([
      Animated.timing(sc, { toValue: visible ? 1 : 0.92, duration: visible ? 220 : 160, useNativeDriver: true }),
      Animated.timing(op, { toValue: visible ? 1 : 0,    duration: visible ? 220 : 160, useNativeDriver: true }),
    ]).start();
  }, [visible, sc, op]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={s.modalKAV}>
        {/* Overlay: solo cierra al tocar FUERA del card */}
        <Pressable style={s.overlay} onPress={onClose}>
          <Pressable style={s.modalCardWrap} onPress={() => {}}>
            <Animated.View style={[s.modalCard, { transform: [{ scale: sc }], opacity: op }]}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
                style={{ flexShrink: 1 }}
              >
                {children}
              </ScrollView>
            </Animated.View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── INPUT con borde que cambia en focus ──────────────────────────────────────

export function FocusInput({ style, multiline, ...props }) {
  const [foc, setFoc] = useState(false);
  return (
    <TextInput
      {...props}
      multiline={multiline}
      style={[s.input, multiline && s.inputMulti, foc && s.inputFocus, style]}
      onFocus={() => setFoc(true)}
      onBlur={() => setFoc(false)}
    />
  );
}

// ─── EDITOR ───────────────────────────────────────────────────────────────────

export default function EditarPerfilModal({ visible, perfil, onCerrar, onGuardado, onError }) {
  const navigation = useNavigation();

  const [nombre,    setNombre]    = useState('');
  const [apellido,  setApellido]  = useState('');
  const [bio,       setBio]       = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState(null);
  const [err,       setErr]       = useState('');
  const [cargando,  setCargando]  = useState(false);
  const [guardando, setGuardando] = useState(false);

  /*
    Salida con cambios sin guardar.

    Irse a Configuración a cambiar el @usuario descartaba en silencio lo que
    hubieras escrito en nombre, apellido, bio y zona: el modal se cierra y
    nunca se guardó nada. Ahora cualquier salida (ese link, "Cancelar", tocar
    afuera o el botón atrás) pasa por `intentarSalir`, que si hay algo tocado
    frena y ofrece guardar primero.

    `pendiente` es la salida que quedó esperando esa decisión: 'cerrar' o
    'usuario' (irse a Configuración).
  */
  const [pendiente, setPendiente] = useState(null);
  const inicial = useRef({ nombre: '', apellido: '', bio: '', ubicacion: '' });

  const hayCambios = (
    nombre.trim()    !== inicial.current.nombre
    || apellido.trim()  !== inicial.current.apellido
    || bio.trim()       !== inicial.current.bio
    || ubicacion.trim() !== inicial.current.ubicacion
  );

  // Por referencia y no como dependencias del efecto de abajo: los padres pasan
  // objetos y funciones inline, que cambian de identidad en cada render suyo, y
  // el formulario se recargaría encima de lo que el usuario está tipeando.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const perfilRef = useRef(perfil);
  perfilRef.current = perfil;

  const llenar = useCallback((u) => {
    const base = {
      nombre:    u?.nombre ?? '',
      apellido:  u?.apellido ?? '',
      bio:       u?.bio ?? '',
      ubicacion: u?.ubicacion ?? '',
    };
    // Con lo que se guardó recién: contra esto se compara para saber si quedó
    // algo sin guardar (comparado ya trimmeado, igual que como se guarda, para
    // que un espacio de más no cuente como cambio).
    inicial.current = {
      nombre: base.nombre.trim(), apellido: base.apellido.trim(),
      bio: base.bio.trim(), ubicacion: base.ubicacion.trim(),
    };
    setNombre(base.nombre);
    setApellido(base.apellido);
    setBio(base.bio);
    setUbicacion(base.ubicacion);
    setNombreUsuario(u?.nombreUsuario ?? null);
  }, []);

  /*
    Corre una vez por apertura (`visible` es la única dependencia que cambia):
    arranca siempre con lo último guardado, pero no se rellena de nuevo mientras
    está abierto, así lo que el usuario está tipeando no se pierde.
  */
  useEffect(() => {
    if (!visible) return;
    setErr('');
    setPendiente(null);
    if (perfilRef.current) { llenar(perfilRef.current); return; }

    let cancelado = false;
    setCargando(true);
    fetchMiPerfil()
      .then(({ usuario }) => { if (!cancelado) llenar(usuario); })
      .catch(() => { if (!cancelado) onErrorRef.current?.('No se pudo cargar el perfil'); })
      .finally(() => setCargando(false));
    return () => { cancelado = true; };
  }, [visible, llenar]);

  /** Ejecuta una salida ya decidida: cerrar, o cerrar e ir a Configuración. */
  function salir(destino) {
    if (destino === 'usuario') {
      onCerrar?.('navegacion');
      navigation.navigate('ConfigCuenta');
    } else {
      onCerrar?.();
    }
  }

  /** Puerta de salida: con cambios sin guardar, pregunta antes de descartarlos. */
  function intentarSalir(destino) {
    if (hayCambios) { setPendiente(destino); return; }
    salir(destino);
  }

  async function guardar(destino) {
    if (!nombre.trim()) {
      // El aviso tapa el formulario: hay que volver a él para que se vea el error.
      setPendiente(null);
      setErr('El nombre es requerido');
      return;
    }
    setErr(''); setGuardando(true);
    try {
      const actualizado = await actualizarMiPerfil({
        nombre: nombre.trim(), apellido: apellido.trim(),
        bio: bio.trim(), ubicacion: ubicacion.trim(),
      });
      // El motivo va al padre para que no reabra nada encima de Configuración.
      onGuardado?.(actualizado, destino === 'usuario' ? 'navegacion' : undefined);
      if (destino === 'usuario') navigation.navigate('ConfigCuenta');
    } catch {
      onError?.('No se pudo actualizar el perfil');
      setPendiente(null); // que se vea el mensaje de error del padre
    } finally { setGuardando(false); }
  }

  // Envuelto a propósito: TouchableOpacity/Pressable pasan el evento del toque
  // como primer argumento y se colaría como "destino".
  const cerrar = () => intentarSalir('cerrar');

  if (pendiente) {
    return (
      <AModal visible={visible} onClose={() => setPendiente(null)}>
        <View style={s.avisoIconoWrap}>
          <Ionicons name="alert-circle" size={40} color="#F0A400" />
        </View>
        <Text style={s.avisoTitulo}>Cambios sin guardar</Text>
        <Text style={s.avisoTxt}>
          {pendiente === 'usuario'
            ? 'Para cambiar tu nombre de usuario tenés que ir a Configuración, y lo que editaste acá todavía no se guardó. Si salís ahora, se pierde.'
            : 'Editaste tus datos y todavía no los guardaste. Si salís ahora, se pierde lo que escribiste.'}
        </Text>

        <TouchableOpacity style={s.btnGuardar} onPress={() => guardar(pendiente)} disabled={guardando}>
          {guardando
            ? <ActivityIndicator size="small" color="#FFF" />
            : (
              <Text style={s.btnGuardarTxt}>
                {pendiente === 'usuario' ? 'Guardar y continuar' : 'Guardar y salir'}
              </Text>
            )}
        </TouchableOpacity>
        <TouchableOpacity style={s.btnCancelar} onPress={() => setPendiente(null)} disabled={guardando}>
          <Text style={s.btnCancelarTxt}>Seguir editando</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnDescartar} onPress={() => salir(pendiente)} disabled={guardando}>
          <Text style={s.btnDescartarTxt}>Salir sin guardar</Text>
        </TouchableOpacity>
      </AModal>
    );
  }

  return (
    <AModal visible={visible} onClose={cerrar}>
      <Text style={s.modalTitulo}>Editar perfil</Text>

      {cargando ? (
        <View style={s.cargando}><ActivityIndicator size="large" color="#2DBD72" /></View>
      ) : (
        <>
          <FocusInput placeholder="Nombre" placeholderTextColor="#AAAAAA"
            value={nombre} onChangeText={(v) => { setNombre(v); setErr(''); }}
            style={[{ marginBottom: err ? 4 : 12 }, !!err && s.inputErr]} />
          {!!err && <Text style={s.errTxt}>{err}</Text>}
          <FocusInput placeholder="Apellido" placeholderTextColor="#AAAAAA"
            value={apellido} onChangeText={setApellido} style={{ marginBottom: 12 }} />

          {/* El @usuario se cambia desde Configuración (con bloqueo de 30 días) */}
          <TouchableOpacity style={s.usuarioRow}
            onPress={() => intentarSalir('usuario')}
            accessibilityRole="button" accessibilityLabel="Cambiar nombre de usuario en Configuración">
            <View>
              <Text style={s.usuarioRowLbl}>Nombre de usuario</Text>
              <Text style={s.usuarioRowVal}>{nombreUsuario ? `@${nombreUsuario}` : 'Sin usuario'}</Text>
            </View>
            <View style={s.usuarioRowRight}>
              <Text style={s.usuarioRowCfg}>Cambiar</Text>
              <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
            </View>
          </TouchableOpacity>

          <FocusInput placeholder="Contá algo sobre vos y tu mascota..." placeholderTextColor="#AAAAAA"
            value={bio} onChangeText={setBio}
            multiline numberOfLines={3} maxLength={150} textAlignVertical="top"
            style={{ marginBottom: 12 }} />
          <FocusInput placeholder="País o ciudad (ej: Argentina)" placeholderTextColor="#AAAAAA"
            value={ubicacion} onChangeText={setUbicacion} style={{ marginBottom: 20 }} />

          <TouchableOpacity style={s.btnGuardar} onPress={() => guardar('cerrar')} disabled={guardando}>
            {guardando ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={s.btnGuardarTxt}>Guardar</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.btnCancelar} onPress={cerrar}>
            <Text style={s.btnCancelarTxt}>Cancelar</Text>
          </TouchableOpacity>
        </>
      )}
    </AModal>
  );
}

const s = StyleSheet.create({
  modalKAV:    { flex:1 },
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.50)', justifyContent:'center', alignItems:'center', paddingHorizontal:20 },
  modalCardWrap: { width:'100%', maxHeight: SH * 0.75 },
  modalCard:   { backgroundColor:'#FFF', borderRadius:20, width:'100%',
                 paddingHorizontal:22, paddingTop:24, paddingBottom:20,
                 shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.18, shadowRadius:20, elevation:10 },
  modalTitulo: { fontSize:18, fontWeight:'700', color:'#2DBD72', textAlign:'center', marginBottom:20 },
  cargando:    { paddingVertical:40 },

  // Aviso de cambios sin guardar
  avisoIconoWrap: { alignItems:'center', marginBottom:10 },
  avisoTitulo: { fontSize:18, fontWeight:'800', color:'#2C2C2C', textAlign:'center' },
  avisoTxt:    { fontSize:14, color:'#6B6B6B', textAlign:'center', lineHeight:20,
                 marginTop:8, marginBottom:20 },
  btnDescartar:{ width:'100%', height:44, borderRadius:30, alignItems:'center',
                 justifyContent:'center', marginTop:10 },
  btnDescartarTxt: { fontSize:15, fontWeight:'700', color:'#B3121D' },

  usuarioRow:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                   borderWidth:1.5, borderColor:'#EEE', borderRadius:10, backgroundColor:'#FAFAFA',
                   paddingHorizontal:14, paddingVertical:10, marginBottom:12 },
  usuarioRowLbl: { fontSize:12, color:'#8A8A8A' },
  usuarioRowVal: { fontSize:15, fontWeight:'700', color:'#2C2C2C', marginTop:2 },
  usuarioRowRight:{ flexDirection:'row', alignItems:'center', gap:4 },
  usuarioRowCfg: { fontSize:13, fontWeight:'700', color:'#177046' },

  input:       { borderWidth:1.5, borderColor:'#DDDDDD', borderRadius:10,
                 paddingHorizontal:14, paddingVertical:12,
                 fontSize:14, color:'#2C2C2C', backgroundColor:'#FFF', marginBottom:12 },
  inputMulti:  { height:80, textAlignVertical:'top' },
  inputFocus:  { borderColor:'#2DBD72' },
  inputErr:    { borderColor:'#E63946' },
  errTxt:      { fontSize:11, color:'#E63946', marginBottom:8, marginLeft:4 },

  btnGuardar:      { width:'100%', height:48, borderRadius:30, backgroundColor:'#2DBD72',
                     alignItems:'center', justifyContent:'center',
                     shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.12, shadowRadius:6, elevation:4 },
  btnGuardarTxt:   { fontSize:15, fontWeight:'700', color:'#FFF' },
  btnCancelar:     { width:'100%', height:44, borderRadius:30, backgroundColor:'#E8E8E8',
                     alignItems:'center', justifyContent:'center', marginTop:10 },
  btnCancelarTxt:  { fontSize:15, fontWeight:'700', color:'#2C2C2C' },
});
