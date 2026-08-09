/**
 * PerfilScreen.jsx — Perfil del usuario en Zooni
 *
 * Zona verde superior con avatar + nombre.
 * Card blanco inferior con botones, stats, bio, tabs grid/lista.
 * Modales: editar perfil, nueva publicación.
 * Conectado directo a Supabase (ver src/services/perfilApi.js) — sin backend propio.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import HamburgerDrawer from '../components/HamburgerDrawer';
import AppDialog from '../components/AppDialog';
import { HOME_BACKGROUND } from '../constants/homeAssets';
import {
  fetchMiPerfil,
  fetchMisPublicaciones,
  actualizarMiPerfil,
  actualizarMiFotoPerfil,
  crearPublicacion,
  eliminarPublicacion,
} from '../services/perfilApi';

const { height: SH } = Dimensions.get('window');

function formatFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────

function Skel({ w, h, r = 8, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    a.start(); return () => a.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0,1], outputRange: [0.4,1] });
  return <Animated.View style={[{ width:w, height:h, borderRadius:r, backgroundColor:'#E0E0E0', opacity }, style]} />;
}

// ─── TOAST (banner verde inline, justo antes de los tabs) ─────────────────────

function Toast({ visible, mensaje }) {
  const ty  = useRef(new Animated.Value(-8)).current;
  const op  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, { toValue: visible ? 0 : -8, duration: 200, useNativeDriver: true }),
      Animated.timing(op, { toValue: visible ? 1 : 0,  duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible, ty, op]);
  if (!visible && op._value === 0) return null;
  return (
    <Animated.View style={[s.toast, { opacity: op, transform: [{ translateY: ty }] }]}>
      <Ionicons name="checkmark-circle" size={18} color="#FFF" />
      <Text style={s.toastTxt}>{mensaje}</Text>
    </Animated.View>
  );
}

// ─── MODAL ANIMADO ────────────────────────────────────────────────────────────

function AModal({ visible, onClose, children }) {
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={s.modalKAV}
      >
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

function FocusInput({ style, multiline, ...props }) {
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

// ─── SCREEN ───────────────────────────────────────────────────────────────────

export default function PerfilScreen() {
  const navigation = useNavigation();

  // Estado principal
  const [perfil,        setPerfil]        = useState(null);
  const [mascotaActiva, setMascotaActiva] = useState(null);
  const [stats,         setStats]         = useState({ totalPublicaciones: 0, totalAmigos: 0 });
  const [pubs,       setPubs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState('grid'); // 'grid' | 'lista'
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modales
  const [modalEditar,   setModalEditar]   = useState(false);
  const [modalPublicar, setModalPublicar] = useState(false);
  const [pubAbierta,    setPubAbierta]    = useState(null); // publicación en el visor
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);

  // Form editar
  const [fNombre,   setFNombre]   = useState('');
  const [fApellido, setFApellido] = useState('');
  const [fBio,      setFBio]      = useState('');
  const [fUbicacion,setFUbicacion]= useState('');
  const [fErrUser,  setFErrUser]  = useState('');
  const [guardando, setGuardando] = useState(false);

  // Form publicar
  const [fImagen,   setFImagen]   = useState(null);
  const [fDesc,     setFDesc]     = useState('');
  const [imgErr,    setImgErr]    = useState(false);
  const [publicando,setPublicando]= useState(false);

  // Toast
  const [showToast,  setShowToast]  = useState(false);
  const [toastMsg,   setToastMsg]   = useState('');
  const toastRef = useRef(null);

  // Animaciones botones
  const scEditar   = useRef(new Animated.Value(1)).current;
  const scPublicar = useRef(new Animated.Value(1)).current;
  const [cfgPress, setCfgPress] = useState(false);

  const scrollRef = useRef(null);

  // ── Carga ────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [perfilData, publicaciones] = await Promise.all([
        fetchMiPerfil(),
        fetchMisPublicaciones(),
      ]);
      setPerfil(perfilData.usuario);
      setMascotaActiva(perfilData.mascotaActiva);
      setStats({ totalPublicaciones: perfilData.totalPublicaciones, totalAmigos: perfilData.totalAmigos });
      setPubs(publicaciones);
    } catch {
      mostrarToast('No se pudo cargar el perfil');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // ── Toast ────────────────────────────────────────────────────────────────
  function mostrarToast(msg) {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToastMsg(msg); setShowToast(true);
    toastRef.current = setTimeout(() => setShowToast(false), 2500);
  }

  // ── Botón press animations ────────────────────────────────────────────────
  const pi = (sc) => Animated.timing(sc, { toValue: 0.97, duration: 100, useNativeDriver: true }).start();
  const po = (sc) => Animated.timing(sc, { toValue: 1,    duration: 150, useNativeDriver: true }).start();

  // ── Abrir modales ────────────────────────────────────────────────────────
  function abrirEditar() {
    setFNombre(perfil?.nombre ?? ''); setFApellido(perfil?.apellido ?? '');
    setFBio(perfil?.bio ?? '');
    setFUbicacion(perfil?.ubicacion ?? ''); setFErrUser('');
    setModalEditar(true);
  }
  function abrirPublicar() {
    setFImagen(null); setFDesc(''); setImgErr(false);
    setModalPublicar(true);
  }
  function cerrarPublicar() {
    if (!fImagen) { setModalPublicar(false); return; }
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cancelar publicación? La imagen seleccionada se perderá.')) setModalPublicar(false);
      return;
    }
    Alert.alert('¿Cancelar publicación?', 'La imagen seleccionada se perderá.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Sí, cancelar', style: 'destructive', onPress: () => setModalPublicar(false) },
    ]);
  }

  // ── Guardar perfil (el @usuario se cambia desde Configuración) ────────────
  async function guardarPerfil() {
    if (!fNombre.trim()) { setFErrUser('El nombre es requerido'); return; }
    setFErrUser(''); setGuardando(true);
    try {
      const actualizado = await actualizarMiPerfil({
        nombre: fNombre.trim(), apellido: fApellido.trim(),
        bio: fBio.trim(), ubicacion: fUbicacion.trim(),
      });
      setPerfil((prev) => ({ ...prev, ...actualizado }));
      setModalEditar(false);
      mostrarToast('Perfil actualizado correctamente');
    } catch {
      mostrarToast('No se pudo actualizar el perfil');
    } finally { setGuardando(false); }
  }

  // ── Cambiar foto ─────────────────────────────────────────────────────────
  async function elegirFotoPerfil(modo) {
    const perm = modo === 'galeria'
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (Platform.OS === 'web') window.alert('Habilitá el acceso para elegir una foto.');
      else Alert.alert('Sin permiso', 'Habilitá el acceso desde la configuración del dispositivo.');
      return;
    }
    const res = modo === 'galeria'
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
      : await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    await subirFoto(res.assets[0].uri);
  }
  function cambiarFoto() {
    if (Platform.OS === 'web') {
      elegirFotoPerfil('galeria');
    } else {
      Alert.alert('Cambiar foto de perfil', '', [
        { text: 'Galería', onPress: () => elegirFotoPerfil('galeria') },
        { text: 'Cámara',  onPress: () => elegirFotoPerfil('camara') },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  }
  async function subirFoto(uri) {
    try {
      const fotoPerfil = await actualizarMiFotoPerfil(uri);
      setPerfil(p => ({ ...p, fotoPerfil }));
      mostrarToast('Foto actualizada correctamente');
    } catch {
      mostrarToast('No se pudo actualizar la foto');
    }
  }

  // ── Publicar ─────────────────────────────────────────────────────────────
  async function elegirImagenPublicar(modo) {
    const perm = modo === 'galeria'
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (Platform.OS === 'web') window.alert('Habilitá el acceso para elegir una foto.');
      else Alert.alert('Sin permiso', 'Habilitá el acceso desde la configuración del dispositivo.');
      return;
    }
    const res = modo === 'galeria'
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
      : await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setFImagen({ uri: res.assets[0].uri }); setImgErr(false);
  }
  function abrirPickerPublicar() {
    if (Platform.OS === 'web') {
      elegirImagenPublicar('galeria');
    } else {
      Alert.alert('Agregar foto', '', [
        { text: 'Galería', onPress: () => elegirImagenPublicar('galeria') },
        { text: 'Cámara',  onPress: () => elegirImagenPublicar('camara') },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  }
  async function publicar() {
    if (!fImagen) { setImgErr(true); return; }
    setImgErr(false); setPublicando(true);
    try {
      const nueva = await crearPublicacion({
        imagenUri: fImagen.uri, descripcion: fDesc.trim(), mascotaId: mascotaActiva?.id ?? null,
      });
      setPubs(p => [nueva, ...p]);
      setStats(s => ({ ...s, totalPublicaciones: (s.totalPublicaciones ?? 0) + 1 }));
      setModalPublicar(false);
      mostrarToast('Publicación creada correctamente');
    } catch {
      mostrarToast('No se pudo crear la publicación');
    } finally { setPublicando(false); }
  }

  // ── Eliminar publicación ──────────────────────────────────────────────────
  async function borrarPublicacion(pub) {
    setConfirmarBorrar(null);
    setPubAbierta(null);
    try {
      await eliminarPublicacion(pub.id);
      setPubs(p => p.filter(x => x.id !== pub.id));
      setStats(s => ({ ...s, totalPublicaciones: Math.max(0, (s.totalPublicaciones ?? 1) - 1) }));
      mostrarToast('Publicación eliminada');
    } catch {
      mostrarToast('No se pudo eliminar la publicación');
    }
  }

  // ── Nombre a mostrar bajo el avatar ──────────────────────────────────────
  const p = perfil ?? {};
  const displayName = p.nombreUsuario || [p.nombre, p.apellido].filter(Boolean).join(' ') || 'Usuario';
  const displayNombreCompleto = [p.nombre, p.apellido].filter(Boolean).join(' ') || p.nombreUsuario || 'Usuario';

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={HOME_BACKGROUND}
        style={s.background}
        imageStyle={s.backgroundImage}
        resizeMode="cover"
      >
      <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ══ ZONA VERDE ══════════════════════════════════════════════════ */}
        <View style={s.zonaVerde}>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity style={s.hBtn} hitSlop={{ top:12, bottom:12, left:12, right:12 }}
              onPress={() => setDrawerOpen(true)}
              accessibilityLabel="Abrir menú">
              <Ionicons name="menu" size={30} color="#0A0A0A" />
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={s.avatarWrap}>
            {loading
              ? <Skel w={84} h={84} r={42} />
              : p.fotoPerfil
                ? <TouchableOpacity onPress={cambiarFoto} accessibilityLabel="Cambiar foto">
                    <Image source={{ uri: p.fotoPerfil }} style={s.avatarImg} />
                  </TouchableOpacity>
                : <TouchableOpacity onPress={cambiarFoto} accessibilityLabel="Cambiar foto">
                    <View style={s.avatarFallback}><Ionicons name="person" size={48} color="#FFF" /></View>
                  </TouchableOpacity>
            }
          </View>

          {/* Nombre y apellido grande, @usuario abajo (estilo TikTok) */}
          {loading ? (
            <Skel w={120} h={16} r={8} style={{ alignSelf:'center', marginTop:12, marginBottom:20 }} />
          ) : (
            <View style={s.nombreBlock}>
              <Text style={s.nombreUsuario} numberOfLines={1} ellipsizeMode="tail">
                {displayNombreCompleto}
              </Text>
              {p.nombreUsuario ? (
                <Text style={s.arrobaUsuario} numberOfLines={1}>@{p.nombreUsuario}</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* ══ CARD BLANCO ═════════════════════════════════════════════════ */}
        <View style={s.card}>

          {/* ── Botones ── */}
          <Animated.View style={{ transform:[{scale:scEditar}] }}>
            <Pressable style={s.btnEditar}
              onPressIn={()=>pi(scEditar)} onPressOut={()=>po(scEditar)} onPress={abrirEditar}>
              <Text style={s.btnEditarTxt}>Editar perfil</Text>
            </Pressable>
          </Animated.View>

          <Pressable style={[s.btnConfig, cfgPress && {backgroundColor:'#F5F5F5'}]}
            onPressIn={()=>setCfgPress(true)} onPressOut={()=>setCfgPress(false)}
            onPress={()=>navigation.navigate('Configuracion')}>
            <Text style={s.btnConfigTxt}>Config</Text>
          </Pressable>

          <Animated.View style={{ transform:[{scale:scPublicar}] }}>
            <Pressable style={s.btnPublicar}
              onPressIn={()=>pi(scPublicar)} onPressOut={()=>po(scPublicar)} onPress={abrirPublicar}>
              <Text style={s.btnPublicarTxt}>Nueva publicación</Text>
            </Pressable>
          </Animated.View>

          {/* ── Stats ── */}
          <View style={s.statsRow}>
            <TouchableOpacity style={s.statCol}
              onPress={() => scrollRef.current?.scrollTo({ y: 600, animated: true })}>
              {loading ? <Skel w={50} h={40} /> : <>
                <Text style={s.statNum}>{stats.totalPublicaciones}</Text>
                <Text style={s.statLbl}>publicaciones</Text>
              </>}
            </TouchableOpacity>
            <View style={s.statSep}/>
            <TouchableOpacity style={s.statCol} onPress={() => navigation.navigate('Comunidad')}>
              {loading ? <Skel w={50} h={40} /> : <>
                <Text style={s.statNum}>{stats.totalAmigos}</Text>
                <Text style={s.statLbl}>amigos</Text>
              </>}
            </TouchableOpacity>
          </View>

          {/* ── Bio ── */}
          {loading ? (
            <View style={s.bioWrap}>
              <Skel w={140} h={14} r={6} style={{marginBottom:6}}/>
              <Skel w={200} h={12} r={6} style={{marginBottom:6}}/>
            </View>
          ) : (p.bio || p.ubicacion) ? (
            <View style={s.bioWrap}>
              {!!p.bio       && <Text style={s.bioTxt}>{p.bio}</Text>}
              {!!p.ubicacion && <Text style={s.bioTxt}>{p.ubicacion}</Text>}
            </View>
          ) : null}

          {/* ── Toast (banner inline antes de tabs) ── */}
          <Toast visible={showToast} mensaje={toastMsg} />

          {/* ── Separador ── */}
          <View style={s.tabSep}/>

          {/* ── Tabs ── */}
          <View style={s.tabsRow}>
            {['grid','lista'].map((t) => (
              <TouchableOpacity key={t} style={s.tabBtn} onPress={()=>setTab(t)}>
                <Text style={[s.tabTxt, tab===t && s.tabTxtOn]}>
                  {t === 'grid' ? 'Grid' : 'Lista'}
                </Text>
                {tab === t && <View style={s.tabLine}/>}
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Contenido ── */}
          {loading ? (
            <View style={s.grid}>
              {[0,1,2,3,4,5].map(i=><View key={i} style={[s.gridCell, {backgroundColor:'#E0E0E0'}]}/>)}
            </View>
          ) : pubs.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="camera-outline" size={48} color="#AAAAAA"/>
              <Text style={s.emptyTxt}>Aún no publicaste nada 📸</Text>
            </View>
          ) : tab === 'grid' ? (
            <View style={s.grid}>
              {pubs.map(pub => (
                <TouchableOpacity key={pub.id} style={s.gridCell} onPress={() => setPubAbierta(pub)}>
                  {pub.imagenUrl
                    ? <Image source={{uri:pub.imagenUrl}} style={s.gridImg}/>
                    : <View style={[s.gridImg,s.gridPH]}><Ionicons name="image-outline" size={28} color="#AAAAAA"/></View>
                  }
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={s.lista}>
              {pubs.map(pub => (
                <TouchableOpacity key={pub.id} style={s.listaCard} activeOpacity={0.9}
                  onPress={() => setPubAbierta(pub)}>
                  {pub.imagenUrl
                    ? <Image source={{uri:pub.imagenUrl}} style={s.listaImg}/>
                    : <View style={[s.listaImg,s.listaImgPH]}><Ionicons name="image-outline" size={36} color="#AAAAAA"/></View>
                  }
                  {!!pub.descripcion && <Text style={s.listaDesc}>{pub.descripcion}</Text>}
                  <Text style={s.listaFecha}>{formatFecha(pub.fecha)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

        </View>
      </ScrollView>
      </ImageBackground>

      {/* ══ MODAL EDITAR PERFIL ══════════════════════════════════════════ */}
      <AModal visible={modalEditar} onClose={()=>setModalEditar(false)}>
          <Text style={s.modalTitulo}>Editar perfil</Text>

          <FocusInput placeholder="Nombre" placeholderTextColor="#AAAAAA"
            value={fNombre} onChangeText={v => { setFNombre(v); setFErrUser(''); }}
            style={[{marginBottom: fErrUser ? 4 : 12}, !!fErrUser && s.inputErr]} />
          {!!fErrUser && <Text style={s.errTxt}>{fErrUser}</Text>}
          <FocusInput placeholder="Apellido" placeholderTextColor="#AAAAAA"
            value={fApellido} onChangeText={setFApellido} style={{marginBottom:12}} />

          {/* El @usuario se cambia desde Configuración (con bloqueo de 30 días) */}
          <TouchableOpacity style={s.usuarioRow}
            onPress={() => { setModalEditar(false); navigation.navigate('ConfigCuenta'); }}
            accessibilityRole="button" accessibilityLabel="Cambiar nombre de usuario en Configuración">
            <View>
              <Text style={s.usuarioRowLbl}>Nombre de usuario</Text>
              <Text style={s.usuarioRowVal}>{p.nombreUsuario ? `@${p.nombreUsuario}` : 'Sin usuario'}</Text>
            </View>
            <View style={s.usuarioRowRight}>
              <Text style={s.usuarioRowCfg}>Cambiar</Text>
              <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
            </View>
          </TouchableOpacity>

          <FocusInput placeholder="Contá algo sobre vos y tu mascota..." placeholderTextColor="#AAAAAA"
            value={fBio} onChangeText={setFBio}
            multiline numberOfLines={3} maxLength={150} textAlignVertical="top"
            style={{marginBottom:12}} />
          <FocusInput placeholder="País o ciudad (ej: Argentina)" placeholderTextColor="#AAAAAA"
            value={fUbicacion} onChangeText={setFUbicacion} style={{marginBottom:20}} />

          <TouchableOpacity style={s.btnGuardar} onPress={guardarPerfil} disabled={guardando}>
            {guardando ? <ActivityIndicator size="small" color="#FFF"/> : <Text style={s.btnGuardarTxt}>Guardar</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.btnCancelar} onPress={()=>setModalEditar(false)}>
            <Text style={s.btnCancelarTxt}>Cancelar</Text>
          </TouchableOpacity>
      </AModal>

      {/* ══ MODAL NUEVA PUBLICACIÓN ═════════════════════════════════════ */}
      <AModal visible={modalPublicar} onClose={cerrarPublicar}>
          <Text style={s.modalTitulo}>Nueva publicación</Text>

          {/* Selector imagen */}
          <TouchableOpacity
            style={[s.imgSel, imgErr && s.imgSelErr]}
            onPress={abrirPickerPublicar}>
            {fImagen ? (
              <>
                <Image source={{uri:fImagen.uri}} style={s.imgPreview}/>
                <TouchableOpacity style={s.imgEditBtn} onPress={abrirPickerPublicar}>
                  <Ionicons name="create-outline" size={20} color="#FFF"/>
                </TouchableOpacity>
              </>
            ) : (
              <View style={s.imgEmpty}>
                <Ionicons name="camera-outline" size={40} color="#AAAAAA"/>
                <Text style={s.imgEmptyTxt}>Tocá para agregar una foto</Text>
              </View>
            )}
          </TouchableOpacity>
          {imgErr && <Text style={s.errTxt}>Seleccioná una imagen</Text>}

          <FocusInput placeholder="Agregá una descripción o hashtags..." placeholderTextColor="#AAAAAA"
            value={fDesc} onChangeText={setFDesc}
            multiline numberOfLines={4} maxLength={300} textAlignVertical="top"
            style={{marginBottom:20}} />

          <TouchableOpacity style={s.btnPublicarModal} onPress={publicar} disabled={publicando}>
            {publicando ? <ActivityIndicator size="small" color="#2C2C2C"/> : <Text style={s.btnPublicarModalTxt}>Publicar</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.btnCancelar} onPress={cerrarPublicar}>
            <Text style={s.btnCancelarTxt}>Cancelar</Text>
          </TouchableOpacity>
      </AModal>

      {/* ══ VISOR DE PUBLICACIÓN (estilo Instagram) ═════════════════════ */}
      <Modal visible={!!pubAbierta} transparent animationType="slide"
        onRequestClose={() => setPubAbierta(null)}>
        <View style={s.pvRoot}>
          <View style={s.pvHeader}>
            <View style={s.pvAutor}>
              {p.fotoPerfil
                ? <Image source={{ uri: p.fotoPerfil }} style={s.pvAvatar} />
                : <View style={[s.pvAvatar, s.pvAvatarPH]}><Ionicons name="person" size={16} color="#FFF" /></View>}
              <View>
                <Text style={s.pvNombre}>{displayNombreCompleto}</Text>
                {p.nombreUsuario ? <Text style={s.pvUsuario}>@{p.nombreUsuario}</Text> : null}
              </View>
            </View>
            <TouchableOpacity onPress={() => setPubAbierta(null)} style={s.pvClose}
              accessibilityLabel="Cerrar">
              <Ionicons name="close" size={26} color="#2C2C2C" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.pvScroll} showsVerticalScrollIndicator={false}>
            {pubAbierta?.imagenUrl
              ? <Image source={{ uri: pubAbierta.imagenUrl }} style={s.pvImg} resizeMode="contain" />
              : <View style={[s.pvImg, s.pvImgPH]}><Ionicons name="image-outline" size={48} color="#AAA" /></View>}

            {!!pubAbierta?.descripcion && (
              <Text style={s.pvDesc}>
                <Text style={s.pvDescUser}>{p.nombreUsuario ? `@${p.nombreUsuario} ` : ''}</Text>
                {pubAbierta.descripcion}
              </Text>
            )}
            <Text style={s.pvFecha}>{formatFecha(pubAbierta?.fecha)}</Text>

            <TouchableOpacity style={s.pvBorrar} onPress={() => setConfirmarBorrar(pubAbierta)}
              accessibilityRole="button" accessibilityLabel="Eliminar publicación">
              <Ionicons name="trash-outline" size={16} color="#B3121D" />
              <Text style={s.pvBorrarTxt}>Eliminar publicación</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <AppDialog
        visible={!!confirmarBorrar}
        titulo="¿Eliminar publicación?"
        mensaje="No vas a poder recuperarla."
        botones={[
          { texto: 'Eliminar', estilo: 'destructive', onPress: () => borrarPublicacion(confirmarBorrar) },
          { texto: 'Cancelar', estilo: 'ghost' },
        ]}
        onCerrar={() => setConfirmarBorrar(null)}
      />

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={perfil ? {
          nombre: perfil.nombre,
          apellido: perfil.apellido,
          fotoPerfil: perfil.fotoPerfil ?? null,
        } : null}
        mascotaActiva={mascotaActiva}
        activeRoute="Perfil"
      />
    </SafeAreaView>
  );
} 

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex:1, backgroundColor:'#D4F5E2' },
  background:  { flex:1, width:'100%' },
  backgroundImage: { width:'100%', height:'100%' },
  scroll:      { flex:1, backgroundColor:'transparent' },
  scrollContent:{ flexGrow:1 },

  // Zona verde
  zonaVerde:   { backgroundColor:'transparent', paddingBottom: 24, minHeight: 200 },
  header:      { height:56, flexDirection:'row', alignItems:'center', paddingHorizontal:20, backgroundColor:'transparent', zIndex:10 },
  hBtn:        { width:44, alignItems:'center', justifyContent:'center' },

  // Avatar
  avatarWrap:  { alignItems:'center', marginTop:8 },
  avatarImg:   { width:84, height:84, borderRadius:42, resizeMode:'cover',
                 shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.12, shadowRadius:6, elevation:4 },
  avatarFallback:{ width:84, height:84, borderRadius:42, backgroundColor:'#DDDDDD',
                   alignItems:'center', justifyContent:'center',
                   shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.12, shadowRadius:6, elevation:4 },
  nombreBlock:  { alignItems:'center', marginTop:12, marginBottom:20, paddingHorizontal:20 },
  nombreUsuario:{ fontSize:20, fontWeight:'700', color:'#2C2C2C', textAlign:'center' },
  arrobaUsuario:{ fontSize:14, color:'#8A8A8A', textAlign:'center', marginTop:2 },

  // Card blanco
  card:        { backgroundColor:'#FFF', borderTopLeftRadius:28, borderTopRightRadius:28,
                 paddingHorizontal:20, paddingTop:24, paddingBottom:40 },

  // Botones acción
  btnEditar:   { backgroundColor:'#2DBD72', borderRadius:30, height:48,
                 alignItems:'center', justifyContent:'center', marginBottom:10,
                 shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.10, shadowRadius:4, elevation:3 },
  btnEditarTxt:{ fontSize:15, fontWeight:'700', color:'#FFF' },
  btnConfig:   { backgroundColor:'#FFF', borderRadius:30, height:48,
                 alignItems:'center', justifyContent:'center',
                 borderWidth:1.5, borderColor:'#DDDDDD', marginBottom:10 },
  btnConfigTxt:{ fontSize:15, fontWeight:'700', color:'#2C2C2C' },
  btnPublicar: { backgroundColor:'#F5C842', borderRadius:30, height:48,
                 alignItems:'center', justifyContent:'center',
                 shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.10, shadowRadius:4, elevation:3 },
  btnPublicarTxt:{ fontSize:15, fontWeight:'700', color:'#2C2C2C' },

  // Stats
  statsRow:    { flexDirection:'row', marginTop:24, marginBottom:16, alignItems:'center' },
  statCol:     { flex:1, alignItems:'center' },
  statSep:     { width:1, height:30, backgroundColor:'#EFEFEF' },
  statNum:     { fontSize:18, fontWeight:'700', color:'#2C2C2C' },
  statLbl:     { fontSize:12, color:'#6B6B6B', marginTop:2, textAlign:'center' },

  // Bio
  bioWrap:     { marginBottom:20 },
  bioNombre:   { fontSize:15, fontWeight:'700', color:'#2C2C2C' },
  bioTxt:      { fontSize:14, color:'#6B6B6B', marginTop:2 },

  // Toast inline
  toast:       { flexDirection:'row', alignItems:'center', gap:8,
                 backgroundColor:'#2DBD72', borderRadius:12,
                 paddingVertical:12, paddingHorizontal:16, marginBottom:16 },
  toastTxt:    { fontSize:14, fontWeight:'700', color:'#FFF', flex:1 },

  // Separador tabs
  tabSep:      { height:1, backgroundColor:'#EFEFEF' },

  // Tabs
  tabsRow:     { flexDirection:'row', marginBottom:12 },
  tabBtn:      { flex:1, alignItems:'center', paddingVertical:12 },
  tabTxt:      { fontSize:15, color:'#AAAAAA' },
  tabTxtOn:    { color:'#2C2C2C', fontWeight:'700' },
  tabLine:     { width:'30%', height:2, backgroundColor:'#2DBD72', marginTop:4 },

  // Grid
  grid:        { flexDirection:'row', flexWrap:'wrap', gap:2, backgroundColor:'transparent' },
  gridCell:    { width:'33%', aspectRatio:1, overflow:'hidden' },
  gridImg:     { width:'100%', height:'100%', resizeMode:'cover' },
  gridPH:      { backgroundColor:'#F0F0F0', alignItems:'center', justifyContent:'center' },

  // Lista
  lista:       { gap:12 },
  listaCard:   { backgroundColor:'#FFF', borderRadius:12, overflow:'hidden',
                 shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:6, elevation:3 },
  listaImg:    { width:'100%', height:200, resizeMode:'cover' },
  listaImgPH:  { backgroundColor:'#F0F0F0', alignItems:'center', justifyContent:'center' },
  listaDesc:   { fontSize:14, color:'#2C2C2C', padding:12, paddingBottom:4 },
  listaFecha:  { fontSize:12, color:'#AAAAAA', paddingHorizontal:12, paddingBottom:12 },

  // Empty
  empty:       { alignItems:'center', marginTop:40, gap:12 },
  emptyTxt:    { fontSize:15, color:'#6B6B6B', textAlign:'center' },

  // Modal
  modalKAV:    { flex:1 },
  overlay:     { flex:1, backgroundColor:'rgba(0,0,0,0.50)', justifyContent:'center', alignItems:'center', paddingHorizontal:20 },
  modalCardWrap: { width:'100%', maxHeight: SH * 0.75 },
  modalCard:   { backgroundColor:'#FFF', borderRadius:20, width:'100%',
                 paddingHorizontal:22, paddingTop:24, paddingBottom:20,
                 shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.18, shadowRadius:20, elevation:10 },
  modalTitulo: { fontSize:18, fontWeight:'700', color:'#2DBD72', textAlign:'center', marginBottom:20 },

  // Inputs
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

  // Selector imagen publicación
  imgSel:      { width:'100%', height:130, borderRadius:12,
                 backgroundColor:'#F5F5F5', borderWidth:1.5, borderColor:'#DDDDDD',
                 borderStyle:'dashed', overflow:'hidden', marginBottom:14 },
  imgSelErr:   { borderColor:'#E63946' },
  imgPreview:  { width:'100%', height:'100%', resizeMode:'cover' },
  imgEmpty:    { flex:1, alignItems:'center', justifyContent:'center', gap:8 },
  imgEmptyTxt: { fontSize:13, color:'#AAAAAA' },
  imgEditBtn:  { position:'absolute', top:8, right:8, width:34, height:34, borderRadius:17,
                 backgroundColor:'rgba(0,0,0,0.4)', alignItems:'center', justifyContent:'center' },

  // Botones modales
  btnGuardar:      { width:'100%', height:48, borderRadius:30, backgroundColor:'#2DBD72',
                     alignItems:'center', justifyContent:'center',
                     shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.12, shadowRadius:6, elevation:4 },
  btnGuardarTxt:   { fontSize:15, fontWeight:'700', color:'#FFF' },
  btnPublicarModal:{ width:'100%', height:48, borderRadius:30, backgroundColor:'#F5C842',
                     alignItems:'center', justifyContent:'center',
                     shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.12, shadowRadius:6, elevation:4 },
  btnPublicarModalTxt:{ fontSize:15, fontWeight:'700', color:'#2C2C2C' },
  btnCancelar:     { width:'100%', height:44, borderRadius:30, backgroundColor:'#E8E8E8',
                     alignItems:'center', justifyContent:'center', marginTop:10 },
  btnCancelarTxt:  { fontSize:15, fontWeight:'700', color:'#2C2C2C' },

  // Visor de publicación
  pvRoot:    { flex:1, backgroundColor:'#FFFFFF' },
  pvHeader:  { height:56, flexDirection:'row', alignItems:'center', justifyContent:'space-between',
               paddingHorizontal:12, borderBottomWidth:1, borderBottomColor:'#EFEFEF',
               marginTop: Platform.OS === 'android' ? 24 : 0 },
  pvAutor:   { flexDirection:'row', alignItems:'center', gap:10, flex:1 },
  pvAvatar:  { width:36, height:36, borderRadius:18, borderWidth:1.5, borderColor:'#2DBD72' },
  pvAvatarPH:{ backgroundColor:'#BEBEBE', alignItems:'center', justifyContent:'center' },
  pvNombre:  { fontSize:14, fontWeight:'700', color:'#2C2C2C' },
  pvUsuario: { fontSize:12, color:'#6B6B6B' },
  pvClose:   { width:40, height:40, alignItems:'center', justifyContent:'center' },
  pvScroll:  { paddingBottom:40 },
  pvImg:     { width:'100%', height:380, backgroundColor:'#000' },
  pvImgPH:   { backgroundColor:'#F0F0F0', alignItems:'center', justifyContent:'center' },
  pvDesc:    { fontSize:14, color:'#2C2C2C', lineHeight:20, paddingHorizontal:16, paddingTop:14 },
  pvDescUser:{ fontWeight:'700' },
  pvFecha:   { fontSize:12, color:'#AAAAAA', paddingHorizontal:16, paddingTop:8 },
  pvBorrar:  { flexDirection:'row', alignItems:'center', gap:8, alignSelf:'flex-start',
               paddingHorizontal:16, paddingVertical:14, marginTop:8 },
  pvBorrarTxt:{ fontSize:15, fontWeight:'700', color:'#B3121D' },
});
