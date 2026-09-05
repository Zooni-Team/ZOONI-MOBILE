/**
 * EditarMascotaScreen.jsx — Edición de mascota (Instruction-MisMascotas §5.6)
 *
 * Una sola pantalla con secciones colapsables (editar es buscar un campo
 * puntual, no un recorrido). Tiene botón Guardar explícito — excepción a la
 * regla de autoguardado: son datos con validación cruzada.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, Pressable, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { fetchRazas } from '../../services/authApi';
import {
  actualizarMascota, agregarFotoMascota, eliminarFotoMascota, fetchFotosMascota,
} from '../../services/petsApi';
import { sanitizarDecimal } from '../../utils/sanitizar';
import { pesoValido as esPesoValido, textoRangoPeso } from '../../constants/pesoPorEspecie';
import { resolveMascotaVisual } from '../../constants/petImages';
import { parseFechaLocal, toISODateLocal } from '../../utils/fechaLocal';
import FechaPicker from '../../components/FechaPicker';
import { alerta } from '../../utils/dialogo';

const P = {
  bgTop: '#E4F9EA', text: '#2C2C2C', textSoft: '#6B6B6B', textSoftMint: '#5A6B60',
  brandText: '#177046', cta: '#F5C842', divider: '#E8EFE9',
  sosRedText: '#B3121D', neutral: '#EDF3EF',
};

function Chip({ label, activo, onPress }) {
  return (
    <TouchableOpacity style={[e.chip, activo && e.chipActivo]} onPress={onPress}
      accessibilityRole="radio" accessibilityState={{ selected: activo }}>
      <Text style={[e.chipTxt, activo && e.chipTxtActivo]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Una de las dos opciones de "¿qué mostramos en la app?": foto o avatar. */
function OpcionVisual({ activo, onPress, titulo, fuente, icono, deshabilitado }) {
  return (
    <TouchableOpacity
      style={[e.visualOpcion, activo && e.visualOpcionOn, deshabilitado && { opacity: 0.45 }]}
      onPress={deshabilitado ? undefined : onPress}
      disabled={deshabilitado}
      accessibilityRole="radio"
      accessibilityState={{ selected: activo, disabled: !!deshabilitado }}
      accessibilityLabel={`Mostrar ${titulo}`}
    >
      {fuente
        ? <Image source={fuente} style={e.visualImg} resizeMode="cover" />
        : (
          <View style={[e.visualImg, e.visualImgVacia]}>
            <Ionicons name={icono} size={26} color={P.textSoft} />
          </View>
        )}
      <Text style={[e.visualTxt, activo && e.visualTxtOn]}>{titulo}</Text>
      {activo && <Ionicons name="checkmark-circle" size={18} color={P.brandText} />}
    </TouchableOpacity>
  );
}

function Seccion({ titulo, abierta, onToggle, children }) {
  return (
    <View style={e.seccion}>
      <TouchableOpacity style={e.seccionHeader} onPress={onToggle}
        accessibilityRole="button" accessibilityLabel={titulo}
        accessibilityState={{ expanded: abierta }}>
        <Text style={e.seccionTitulo}>{titulo}</Text>
        <Ionicons name={abierta ? 'chevron-up' : 'chevron-down'} size={18} color={P.textSoft} />
      </TouchableOpacity>
      {abierta && <View style={e.seccionBody}>{children}</View>}
    </View>
  );
}

export default function EditarMascotaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const original = route.params?.mascota;

  const [abierta, setAbierta] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [razas, setRazas] = useState([]);
  const [razaSheet, setRazaSheet] = useState(false);

  const [nombre, setNombre] = useState(original?.nombre ?? '');
  const [raza, setRaza] = useState(original?.raza ?? '');
  const [sexo, setSexo] = useState(original?.sexo ?? null);
  const [peso, setPeso] = useState(original?.peso != null ? String(original.peso) : '');
  const [tamano, setTamano] = useState(original?.tamano ?? null);
  const [senas, setSenas] = useState(original?.senas ?? '');
  const [castrado, setCastrado] = useState(original?.castrado);
  const [microchip, setMicrochip] = useState(original?.microchip ?? '');
  const [descripcion, setDescripcion] = useState(original?.descripcion ?? '');
  const [visibleEnMatch, setVisibleEnMatch] = useState(original?.visibleEnMatch ?? true);
  // Foto real vs avatar del Closet en el resto de la app (migración 032)
  const [mostrarFoto, setMostrarFoto] = useState(original?.mostrarFoto ?? true);
  const [fechaNacimiento, setFechaNacimiento] = useState(parseFechaLocal(original?.fechaNacimiento));
  const [showFecha, setShowFecha] = useState(false);

  // El avatar tal cual lo resolvería la app si la preferencia fuera "avatar":
  // se fuerza mostrarFoto:false para que no devuelva la foto.
  const avatarSource = useMemo(
    () => resolveMascotaVisual({ ...(original ?? {}), mostrarFoto: false }),
    [original],
  );

  // Galería de fotos (portada + adicionales) para Match
  const [fotos, setFotos] = useState([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  useEffect(() => {
    if (!original?.id) return;
    fetchFotosMascota(original.id, original.fotoUrl).then(setFotos).catch(() => setFotos([]));
  }, [original?.id, original?.fotoUrl]);

  const agregarFoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { alerta('Sin permiso', 'Habilitá el acceso a la galería.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      setSubiendoFoto(true);
      const nueva = await agregarFotoMascota(original.id, res.assets[0].uri);
      setFotos((prev) => [...prev, nueva]);
    } catch {
      alerta('No pudimos subir la foto', 'Probá de nuevo.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const quitarFoto = async (foto) => {
    if (foto.esPortada) { alerta('No se puede quitar la portada', 'Es la foto principal de tu mascota.'); return; }
    setFotos((prev) => prev.filter((f) => f.id !== foto.id));
    try { await eliminarFotoMascota(foto.id); } catch { /* si falla, recarga al reabrir */ }
  };

  const hayCambios = useMemo(() => {
    if (!original) return false;
    return (
      nombre !== (original.nombre ?? '') ||
      raza !== (original.raza ?? '') ||
      sexo !== (original.sexo ?? null) ||
      peso !== (original.peso != null ? String(original.peso) : '') ||
      tamano !== (original.tamano ?? null) ||
      senas !== (original.senas ?? '') ||
      castrado !== original.castrado ||
      microchip !== (original.microchip ?? '') ||
      descripcion !== (original.descripcion ?? '') ||
      visibleEnMatch !== (original.visibleEnMatch ?? true) ||
      mostrarFoto !== (original.mostrarFoto ?? true) ||
      // Se comparan las fechas en ISO y no por identidad de Date: parseFechaLocal
      // devuelve un objeto nuevo y siempre daría "cambió".
      (fechaNacimiento ? toISODateLocal(fechaNacimiento) : null) !== (original.fechaNacimiento ?? null)
    );
  }, [original, nombre, raza, sexo, peso, tamano, senas, castrado, microchip, descripcion,
    visibleEnMatch, mostrarFoto, fechaNacimiento]);

  // Catálogo de razas de Supabase filtrado por la especie de la mascota
  useEffect(() => {
    const key = (original?.especie ?? '').toLowerCase();
    fetchRazas(key).then((r) => setRazas(r.razas)).catch(() => setRazas([]));
  }, [original?.especie]);

  const nombreValido = nombre.trim().length >= 2 && nombre.trim().length <= 30;
  const microchipValido = microchip === '' || /^[0-9]{15}$/.test(microchip);
  // Peso: obligatorio y dentro del rango de SU especie. El mínimo fijo de
  // 0,1 kg dejaba afuera a hámsters, aves y ratones, que pesan bastante menos.
  const pesoNum = Number(peso.replace(',', '.'));
  const pesoOk = peso !== '' && !Number.isNaN(pesoNum) && esPesoValido(pesoNum, original?.especie);
  const puedeGuardar = hayCambios && nombreValido && microchipValido && pesoOk && !guardando;

  if (!original) {
    navigation.goBack();
    return null;
  }

  const salir = () => {
    if (!hayCambios) { navigation.goBack(); return; }
    if (Platform.OS === 'web') {
      if (window.confirm('¿Descartar los cambios?')) navigation.goBack();
      return;
    }
    Alert.alert('¿Descartar los cambios?', null, [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await actualizarMascota(original.id, {
        nombre: nombre.trim(),
        raza: raza.trim() || null,
        sexo,
        peso: pesoNum,
        tamano,
        senas: senas.trim() || null,
        castrado: castrado === undefined ? null : castrado,
        microchip: microchip || null,
        descripcion: descripcion.trim() || null,
        visibleEnMatch,
        mostrarFoto,
        fechaNacimiento: fechaNacimiento ? toISODateLocal(fechaNacimiento) : null,
      });
      navigation.goBack();
    } catch {
      setGuardando(false);
      alerta('No pudimos guardar los cambios', 'Revisá tu conexión y probá de nuevo.');
    }
  };

  return (
    <SafeAreaView style={e.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={e.header}>
        <TouchableOpacity onPress={salir} style={e.headerBtn}
          accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={P.text} />
        </TouchableOpacity>
        <Text style={e.headerTitulo} numberOfLines={1}>Editar a {original.nombre}</Text>
        <TouchableOpacity onPress={guardar} disabled={!puedeGuardar}
          accessibilityRole="button" accessibilityLabel="Guardar"
          accessibilityState={{ disabled: !puedeGuardar }}>
          {guardando
            ? <ActivityIndicator size={18} color={P.brandText} />
            : <Text style={[e.headerGuardar, !puedeGuardar && { opacity: 0.45 }]}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={e.content}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Seccion titulo="Información" abierta={abierta === 0} onToggle={() => setAbierta(abierta === 0 ? -1 : 0)}>
          <Text style={e.label}>Nombre</Text>
          <TextInput style={e.input} value={nombre} onChangeText={setNombre}
            autoCapitalize="words" maxLength={30} />
          {!nombreValido && <Text style={e.error}>Poné un nombre de 2 a 30 letras.</Text>}

          <Text style={e.label}>Raza</Text>
          {razas.length > 0 ? (
            // Menú desplegable con el catálogo real, como en el registro
            <TouchableOpacity style={[e.input, e.selectFila]} onPress={() => setRazaSheet(true)}
              accessibilityRole="button" accessibilityLabel={`Raza: ${raza || 'sin elegir'}`}>
              <Text style={[e.selectTxt, !raza && { color: P.textSoft }]} numberOfLines={1}>
                {raza || 'Elegí la raza'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={P.textSoft} />
            </TouchableOpacity>
          ) : (
            // Especies sin catálogo (Otro): campo libre
            <TextInput style={e.input} value={raza} onChangeText={setRaza} maxLength={100} />
          )}

          <Text style={e.label}>Sexo</Text>
          <View style={e.chipsFila}>
            <Chip label="Macho" activo={sexo === 'Macho'} onPress={() => setSexo('Macho')} />
            <Chip label="Hembra" activo={sexo === 'Hembra'} onPress={() => setSexo('Hembra')} />
          </View>
        </Seccion>

        <Seccion titulo="Fechas y datos" abierta={abierta === 1} onToggle={() => setAbierta(abierta === 1 ? -1 : 1)}>
          {/* La sección se llamaba "Fechas y datos" pero no tenía ninguna
              fecha: la de nacimiento solo se podía cambiar entrando a la Ficha
              Médica, que es un rodeo para algo que se edita desde acá. */}
          <Text style={e.label}>¿Cuándo nació?</Text>
          <TouchableOpacity style={e.select} onPress={() => setShowFecha(true)}
            accessibilityRole="button" accessibilityLabel="Elegir fecha de nacimiento">
            <Text style={[e.selectTxt, !fechaNacimiento && { color: P.textSoft }]}>
              {fechaNacimiento
                ? fechaNacimiento.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'Sin fecha registrada'}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={P.textSoft} />
          </TouchableOpacity>

          <Text style={e.label}>Peso (kg) *</Text>
          <TextInput style={e.input} value={peso}
            onChangeText={(v) => setPeso(sanitizarDecimal(v))}
            keyboardType="decimal-pad" maxLength={6}
            placeholder={`Entre ${textoRangoPeso(original?.especie)}`} placeholderTextColor={P.textSoft} />
          {peso === '' && <Text style={e.error}>El peso es obligatorio.</Text>}
          {peso !== '' && !pesoOk && (
            <Text style={e.error}>
              En {original?.especie ?? 'esta especie'} el peso va de {textoRangoPeso(original?.especie)}.
            </Text>
          )}

          <Text style={e.label}>Tamaño</Text>
          <View style={e.chipsFila}>
            <Chip label="Pequeño" activo={tamano === 'small'} onPress={() => setTamano('small')} />
            <Chip label="Mediano" activo={tamano === 'medium'} onPress={() => setTamano('medium')} />
            <Chip label="Grande" activo={tamano === 'large'} onPress={() => setTamano('large')} />
          </View>

          <Text style={e.label}>Señas particulares</Text>
          <TextInput style={[e.input, e.textarea]} value={senas} onChangeText={setSenas}
            multiline maxLength={200} />
        </Seccion>

        <Seccion titulo="Salud" abierta={abierta === 2} onToggle={() => setAbierta(abierta === 2 ? -1 : 2)}>
          <Text style={e.label}>¿Está castrado/a?</Text>
          <View style={e.chipsFila}>
            <Chip label="Sí" activo={castrado === true} onPress={() => setCastrado(true)} />
            <Chip label="No" activo={castrado === false} onPress={() => setCastrado(false)} />
            <Chip label="No sé" activo={castrado == null} onPress={() => setCastrado(null)} />
          </View>

          <Text style={e.label}>Número de microchip</Text>
          <TextInput style={e.input} value={microchip}
            onChangeText={(v) => setMicrochip(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad" maxLength={15} />
          {!microchipValido && <Text style={e.error}>El microchip tiene 15 números.</Text>}
        </Seccion>

        <Seccion titulo="Fotos" abierta={abierta === 4} onToggle={() => setAbierta(abierta === 4 ? -1 : 4)}>
          <Text style={e.fotosApoyo}>Estas son las fotos que ve la gente en Match. La primera es la portada.</Text>
          <View style={e.fotosGrid}>
            {fotos.map((f, i) => (
              <View key={f.id ?? `portada-${i}`} style={e.fotoItem}>
                <Image source={{ uri: f.url }} style={e.fotoImg} />
                {f.esPortada && <View style={e.portadaBadge}><Text style={e.portadaBadgeTxt}>Portada</Text></View>}
                {!f.esPortada && (
                  <TouchableOpacity style={e.fotoQuitar} onPress={() => quitarFoto(f)}
                    accessibilityLabel="Quitar foto">
                    <Ionicons name="close" size={14} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {fotos.length < 6 && (
              <TouchableOpacity style={e.fotoAgregar} onPress={agregarFoto} disabled={subiendoFoto}
                accessibilityRole="button" accessibilityLabel="Agregar foto">
                {subiendoFoto
                  ? <ActivityIndicator size="small" color={P.brandText} />
                  : <Ionicons name="add" size={28} color={P.brandText} />}
              </TouchableOpacity>
            )}
          </View>

          {/*
            Elegir qué se ve en el resto de la app.

            Hasta ahora la foto ganaba siempre: apenas cargabas una, el avatar
            que armaste en el Closet desaparecía del Home, la Ficha Médica y
            Mis Mascotas. Y la foto no se puede sacar, porque Match la exige —
            así que cargarla para Match apagaba el Closet en todos lados.

            Esto NO afecta a Match: ahí siempre se muestra la foto real.
          */}
          <View style={e.divisorSeccion} />
          <Text style={e.label}>¿Qué mostramos en la app?</Text>
          <Text style={e.fotosApoyo}>
            En Match siempre se ve la foto real; esto cambia el Home, la ficha y Mis Mascotas.
          </Text>
          <View style={e.visualRow}>
            <OpcionVisual
              activo={mostrarFoto}
              onPress={() => setMostrarFoto(true)}
              titulo="Su foto"
              fuente={original?.fotoUrl ? { uri: original.fotoUrl } : null}
              icono="camera-outline"
              deshabilitado={!original?.fotoUrl}
            />
            <OpcionVisual
              activo={!mostrarFoto}
              onPress={() => setMostrarFoto(false)}
              titulo="Su avatar"
              fuente={avatarSource}
              icono="color-palette-outline"
            />
          </View>
          {!original?.fotoUrl && (
            <Text style={e.fotosApoyo}>Todavía no hay foto real: agregá una arriba para poder elegirla.</Text>
          )}
        </Seccion>

        <Seccion titulo="Perfil social" abierta={abierta === 3} onToggle={() => setAbierta(abierta === 3 ? -1 : 3)}>
          <Text style={e.label}>Descripción</Text>
          <TextInput style={[e.input, e.textarea]} value={descripcion} onChangeText={setDescripcion}
            multiline maxLength={150} />
          <Text style={e.contador}>{descripcion.length}/150</Text>

          <TouchableOpacity style={e.toggleFila} onPress={() => setVisibleEnMatch((v) => !v)}
            accessibilityRole="switch" accessibilityState={{ checked: visibleEnMatch }}>
            <Text style={e.toggleLabel}>¿Aparece en Match?</Text>
            <Ionicons name={visibleEnMatch ? 'checkbox' : 'square-outline'} size={26}
              color={visibleEnMatch ? P.brandText : P.textSoft} />
          </TouchableOpacity>
        </Seccion>

        {/* sinFuturo: una fecha de nacimiento posterior a hoy daría una edad
            negativa (el "-1 años y 9 meses" que aparecía en el alta). */}
        <FechaPicker
          visible={showFecha}
          titulo="¿Cuándo nació?"
          valor={fechaNacimiento ?? new Date()}
          aniosAtras={30}
          sinFuturo
          onConfirmar={(d) => { setFechaNacimiento(d); setShowFecha(false); }}
          onCancelar={() => setShowFecha(false)}
        />

        {/* Bottom sheet de razas */}
        <Modal visible={razaSheet} transparent animationType="slide" onRequestClose={() => setRazaSheet(false)}>
          <Pressable style={e.scrim} onPress={() => setRazaSheet(false)}>
            <Pressable style={e.sheet} onPress={() => {}}>
              <View style={e.sheetHandle} />
              <Text style={e.sheetTitulo}>Raza</Text>
              <ScrollView style={{ maxHeight: 380 }}>
                {razas.map((r) => (
                  <TouchableOpacity key={r.id} style={e.sheetFila}
                    onPress={() => { setRaza(r.nombre); setRazaSheet(false); }}
                    accessibilityRole="radio" accessibilityState={{ selected: raza === r.nombre }}>
                    <Text style={e.sheetFilaTxt}>{r.nombre}</Text>
                    {raza === r.nombre && <Ionicons name="checkmark" size={20} color={P.brandText} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Acciones al pie, fuera de las secciones (§5.6) */}
        <TouchableOpacity style={e.pieAccion}
          onPress={() => navigation.replace('EliminarMascota', { mascota: original })}
          accessibilityRole="button" accessibilityLabel={`Eliminar a ${original.nombre}`}>
          <Text style={e.pieAccionEliminar}>Eliminar a {original.nombre}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: P.bgTop },
  header: {
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, gap: 8, marginTop: Platform.OS === 'android' ? 24 : 0,
  },
  headerBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitulo:  { flex: 1, fontSize: 17, fontWeight: '700', color: P.text, textAlign: 'center' },
  headerGuardar: { fontSize: 15, fontWeight: '700', color: P.brandText },

  content: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },

  seccion: {
    backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  seccionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 52, paddingHorizontal: 16,
  },
  seccionTitulo: { fontSize: 16, fontWeight: '700', color: P.text },
  seccionBody:   { paddingHorizontal: 16, paddingBottom: 16 },

  label: { fontSize: 14, fontWeight: '700', color: P.text, marginTop: 12, marginBottom: 6 },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: P.divider, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: P.text,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  contador: { fontSize: 12, color: P.textSoftMint, textAlign: 'right', marginTop: 4 },
  error:    { fontSize: 13, color: P.sosRedText, marginTop: 4 },

  chipsFila: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: P.neutral },
  chipActivo:    { backgroundColor: P.brandText },
  chipTxt:       { fontSize: 14, fontWeight: '600', color: P.brandText },
  chipTxtActivo: { color: '#FFF' },

  toggleFila: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, minHeight: 44,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: P.text },

  pieAccion: { alignItems: 'center', paddingVertical: 16 },
  pieAccionEliminar: { fontSize: 15, fontWeight: '700', color: P.sosRedText },

  fotosApoyo: { fontSize: 13, color: P.textSoft, marginBottom: 12, lineHeight: 18 },

  // Elección foto real / avatar del Closet
  divisorSeccion: { height: 1, backgroundColor: P.divider, marginVertical: 16 },
  visualRow: { flexDirection: 'row', gap: 12 },
  visualOpcion: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 16,
    backgroundColor: P.neutral, borderWidth: 2, borderColor: 'transparent',
  },
  visualOpcionOn: { borderColor: P.brandText, backgroundColor: '#FFFFFF' },
  visualImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF' },
  visualImgVacia: { alignItems: 'center', justifyContent: 'center' },
  visualTxt: { fontSize: 13, color: P.textSoft, fontWeight: '600' },
  visualTxtOn: { color: P.brandText, fontWeight: '700' },
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fotoItem: { width: 92, height: 92, borderRadius: 12, overflow: 'hidden' },
  fotoImg: { width: '100%', height: '100%' },
  portadaBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 3, alignItems: 'center',
  },
  portadaBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  fotoQuitar: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  fotoAgregar: {
    width: 92, height: 92, borderRadius: 12, borderWidth: 1.5, borderColor: P.brandText,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF',
  },

  selectFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectTxt:  { flex: 1, fontSize: 15, color: P.text },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8, paddingBottom: 24,
  },
  sheetHandle:  { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: P.divider, marginBottom: 8 },
  sheetTitulo:  { fontSize: 16, fontWeight: '700', color: P.text, textAlign: 'center', marginBottom: 8 },
  sheetFila:    { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 20, gap: 10 },
  sheetFilaTxt: { flex: 1, fontSize: 15, color: P.text },
});
