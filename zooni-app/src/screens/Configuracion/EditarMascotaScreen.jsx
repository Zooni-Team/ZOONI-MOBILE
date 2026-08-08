/**
 * EditarMascotaScreen.jsx — Edición de mascota (Instruction-MisMascotas §5.6)
 *
 * Una sola pantalla con secciones colapsables (editar es buscar un campo
 * puntual, no un recorrido). Tiene botón Guardar explícito — excepción a la
 * regla de autoguardado: son datos con validación cruzada.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { fetchRazas } from '../../services/authApi';
import { actualizarMascota } from '../../services/petsApi';
import { sanitizarDecimal } from '../../utils/sanitizar';
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
      visibleEnMatch !== (original.visibleEnMatch ?? true)
    );
  }, [original, nombre, raza, sexo, peso, tamano, senas, castrado, microchip, descripcion, visibleEnMatch]);

  // Catálogo de razas de Supabase filtrado por la especie de la mascota
  useEffect(() => {
    const key = (original?.especie ?? '').toLowerCase();
    fetchRazas(key).then((r) => setRazas(r.razas)).catch(() => setRazas([]));
  }, [original?.especie]);

  const nombreValido = nombre.trim().length >= 2 && nombre.trim().length <= 30;
  const microchipValido = microchip === '' || /^[0-9]{15}$/.test(microchip);
  // Peso: obligatorio, solo números, entre 0,1 y 120 kg (la columna es
  // DECIMAL(5,2): más de 999.99 revienta en la base con un 400)
  const pesoNum = Number(peso.replace(',', '.'));
  const pesoValido = peso !== '' && !Number.isNaN(pesoNum) && pesoNum >= 0.1 && pesoNum <= 120;
  const puedeGuardar = hayCambios && nombreValido && microchipValido && pesoValido && !guardando;

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
          <Text style={e.label}>Peso (kg) *</Text>
          <TextInput style={e.input} value={peso}
            onChangeText={(v) => setPeso(sanitizarDecimal(v))}
            keyboardType="decimal-pad" maxLength={5}
            placeholder="Entre 0,1 y 120" placeholderTextColor={P.textSoft} />
          {peso === '' && <Text style={e.error}>El peso es obligatorio.</Text>}
          {peso !== '' && !pesoValido && <Text style={e.error}>El peso va de 0,1 a 120 kg.</Text>}

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
