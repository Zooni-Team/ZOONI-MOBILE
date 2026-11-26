import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { fetchMiPerfil, actualizarMiPerfil } from '../../services/perfilApi';
import { colores } from '../../theme';

const { height: SH } = Dimensions.get('window');

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

  const [pendiente, setPendiente] = useState(null);
  const inicial = useRef({ nombre: '', apellido: '', bio: '', ubicacion: '' });

  const hayCambios = (
    nombre.trim()    !== inicial.current.nombre
    || apellido.trim()  !== inicial.current.apellido
    || bio.trim()       !== inicial.current.bio
    || ubicacion.trim() !== inicial.current.ubicacion
  );

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

  function salir(destino) {
    if (destino === 'usuario') {
      onCerrar?.('navegacion');
      navigation.navigate('ConfigCuenta');
    } else {
      onCerrar?.();
    }
  }

  function intentarSalir(destino) {
    if (hayCambios) { setPendiente(destino); return; }
    salir(destino);
  }

  async function guardar(destino) {
    if (!nombre.trim()) {
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
      onGuardado?.(actualizado, destino === 'usuario' ? 'navegacion' : undefined);
      if (destino === 'usuario') navigation.navigate('ConfigCuenta');
    } catch {
      onError?.('No se pudo actualizar el perfil');
      setPendiente(null);
    } finally { setGuardando(false); }
  }

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
            ? <ActivityIndicator size="small" color={colores.blanco} />
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
        <View style={s.cargando}><ActivityIndicator size="large" color={colores.verde} /></View>
      ) : (
        <>
          <FocusInput placeholder="Nombre" placeholderTextColor={colores.textoTenue}
            value={nombre} onChangeText={(v) => { setNombre(v); setErr(''); }}
            style={[{ marginBottom: err ? 4 : 12 }, !!err && s.inputErr]} />
          {!!err && <Text style={s.errTxt}>{err}</Text>}
          <FocusInput placeholder="Apellido" placeholderTextColor={colores.textoTenue}
            value={apellido} onChangeText={setApellido} style={{ marginBottom: 12 }} />

          <TouchableOpacity style={s.usuarioRow}
            onPress={() => intentarSalir('usuario')}
            accessibilityRole="button" accessibilityLabel="Cambiar nombre de usuario en Configuración">
            <View>
              <Text style={s.usuarioRowLbl}>Nombre de usuario</Text>
              <Text style={s.usuarioRowVal}>{nombreUsuario ? `@${nombreUsuario}` : 'Sin usuario'}</Text>
            </View>
            <View style={s.usuarioRowRight}>
              <Text style={s.usuarioRowCfg}>Cambiar</Text>
              <Ionicons name="chevron-forward" size={16} color={colores.gris550} />
            </View>
          </TouchableOpacity>

          <FocusInput placeholder="Contá algo sobre vos y tu mascota..." placeholderTextColor={colores.textoTenue}
            value={bio} onChangeText={setBio}
            multiline numberOfLines={3} maxLength={150} textAlignVertical="top"
            style={{ marginBottom: 12 }} />
          <FocusInput placeholder="País o ciudad (ej: Argentina)" placeholderTextColor={colores.textoTenue}
            value={ubicacion} onChangeText={setUbicacion} style={{ marginBottom: 20 }} />

          <TouchableOpacity style={s.btnGuardar} onPress={() => guardar('cerrar')} disabled={guardando}>
            {guardando ? <ActivityIndicator size="small" color={colores.blanco} /> : <Text style={s.btnGuardarTxt}>Guardar</Text>}
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
  modalCard:   { backgroundColor:colores.blanco, borderRadius:20, width:'100%',
                 paddingHorizontal:22, paddingTop:24, paddingBottom:20,
                 shadowColor:colores.negro, shadowOffset:{width:0,height:8}, shadowOpacity:0.18, shadowRadius:20, elevation:10 },
  modalTitulo: { fontSize:18, fontWeight:'700', color:colores.verde, textAlign:'center', marginBottom:20 },
  cargando:    { paddingVertical:40 },

  avisoIconoWrap: { alignItems:'center', marginBottom:10 },
  avisoTitulo: { fontSize:18, fontWeight:'800', color:colores.texto, textAlign:'center' },
  avisoTxt:    { fontSize:14, color:colores.textoSecundario, textAlign:'center', lineHeight:20,
                 marginTop:8, marginBottom:20 },
  btnDescartar:{ width:'100%', height:44, borderRadius:30, alignItems:'center',
                 justifyContent:'center', marginTop:10 },
  btnDescartarTxt: { fontSize:15, fontWeight:'700', color:colores.rojoOscuro },

  usuarioRow:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                   borderWidth:1.5, borderColor:colores.gris100, borderRadius:10, backgroundColor:colores.gris30,
                   paddingHorizontal:14, paddingVertical:10, marginBottom:12 },
  usuarioRowLbl: { fontSize:12, color:colores.gris550 },
  usuarioRowVal: { fontSize:15, fontWeight:'700', color:colores.texto, marginTop:2 },
  usuarioRowRight:{ flexDirection:'row', alignItems:'center', gap:4 },
  usuarioRowCfg: { fontSize:13, fontWeight:'700', color:colores.verdeOscuro },

  input:       { borderWidth:1.5, borderColor:colores.gris300, borderRadius:10,
                 paddingHorizontal:14, paddingVertical:12,
                 fontSize:14, color:colores.texto, backgroundColor:colores.blanco, marginBottom:12 },
  inputMulti:  { height:80, textAlignVertical:'top' },
  inputFocus:  { borderColor:colores.verde },
  inputErr:    { borderColor:colores.rojo },
  errTxt:      { fontSize:11, color:colores.rojo, marginBottom:8, marginLeft:4 },

  btnGuardar:      { width:'100%', height:48, borderRadius:30, backgroundColor:colores.verde,
                     alignItems:'center', justifyContent:'center',
                     shadowColor:colores.negro, shadowOffset:{width:0,height:3}, shadowOpacity:0.12, shadowRadius:6, elevation:4 },
  btnGuardarTxt:   { fontSize:15, fontWeight:'700', color:colores.blanco },
  btnCancelar:     { width:'100%', height:44, borderRadius:30, backgroundColor:colores.gris200,
                     alignItems:'center', justifyContent:'center', marginTop:10 },
  btnCancelarTxt:  { fontSize:15, fontWeight:'700', color:colores.texto },
});
