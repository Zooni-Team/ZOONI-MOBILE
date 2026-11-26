import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import jsPDF from 'jspdf';

import { calcularEdad } from '../utils/calcularEdad';
import { parseFechaLocal, toISODateLocal } from '../utils/fechaLocal';
import { resolveMascotaVisual } from '../constants/petImages';
import { SkeletonBloque } from '../components/ui/Skeleton';
import HamburgerDrawer from '../components/HamburgerDrawer';
import { useMisMascotas } from '../hooks/useMisMascotas';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { MASCOTA_VACIA } from '../constants/mascotaVacia';
import { construirDocPdf, construirHtmlFicha, nombreArchivo } from '../utils/fichaPdf';
import {
  fetchMascota, actualizarPeso, actualizarRaza, actualizarFechaNacimiento,
  fetchVacunas, fetchTratamientos, fetchHistorialPeso, fetchConsultas,
} from '../services/fichaMedicaApi';
import { fetchRazas } from '../services/authApi';
import OpcionPicker from '../components/OpcionPicker';
import FechaPicker from '../components/FechaPicker';
import { formatearPeso, pesoValido, textoRangoPeso } from '../constants/pesoPorEspecie';
import { imagenADataUri } from '../utils/imagenBase64';
import { colores } from '../theme';
import { formatearFecha } from '../utils/fechaLocal';
import { capitalizar } from '../utils/texto';

function FilaDato({ icono, label, valor, onEditar, editando, children }) {
  return (
    <View style={s.dataCard}>
      <View style={s.dataRow}>
        <View style={s.dataLeft}>
          <Ionicons name={icono} size={18} color={colores.verde} />
          <Text style={s.dataLabel}>{label}</Text>
        </View>
        <View style={s.dataRight}>
          {editando ? children : (
            <>
              <Text style={s.dataValor}>{valor}</Text>
              {onEditar && (
                <TouchableOpacity onPress={onEditar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="create-outline" size={16} color={colores.textoSecundario} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function BotonNav({ icono, iconoColor, texto, onPress }) {
  return (
    <TouchableOpacity style={s.navCard} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icono} size={20} color={iconoColor} />
      <Text style={s.navTexto}>{texto}</Text>
      <Text style={s.navFlecha}>›</Text>
    </TouchableOpacity>
  );
}

export default function FichaMedicaScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const [petId, setPetId] = useState(route.params?.petId || route.params?.mascotaId || null);

  const [mascota,        setMascota]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [editandoPeso,   setEditandoPeso]   = useState(false);
  const [pesoBorrador,   setPesoBorrador]   = useState('');
  const [guardandoPeso,  setGuardandoPeso]  = useState(false);
  const [showRazaPicker,   setShowRazaPicker]   = useState(false);
  const [razasDisponibles, setRazasDisponibles] = useState([]);
  const [cargandoRazas,    setCargandoRazas]    = useState(false);
  const [guardandoRaza,    setGuardandoRaza]    = useState(false);
  const [editandoFecha,  setEditandoFecha]  = useState(false);
  const [fechaBorrador,  setFechaBorrador]  = useState(new Date());
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [generandoPdf,   setGenerandoPdf]   = useState(false);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [historialVisible,  setHistorialVisible]  = useState(false);
  const [historialPeso,     setHistorialPeso]     = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const { usuario, mascotaActiva: mascotaActivaDemo } = useUsuarioActivo();
  const { mascotas } = useMisMascotas();

  const pesoInputRef = useRef(null);

  useEffect(() => {
    if (petId != null || !mascotas.length) return;
    setPetId((mascotas.find((mx) => mx.esActiva) ?? mascotas[0]).id);
  }, [petId, mascotas]);

  const cambiarMascota = (direccion) => {
    if (mascotas.length < 2) return;
    const i = mascotas.findIndex((mx) => mx.id === petId);
    const desde = i === -1 ? 0 : i;
    setPetId(mascotas[(desde + direccion + mascotas.length) % mascotas.length].id);
  };

  const cargarMascota = useCallback(async (silencioso = false) => {
    if (!petId) { setLoading(false); return; }
    if (!silencioso) setLoading(true);
    try {
      const data = await fetchMascota(petId);
      if (!data) {
        Alert.alert('No encontrada', 'La mascota no existe.', [{ text: 'Volver', onPress: () => navigation.goBack() }]);
      } else {
        setMascota(data);
      }
    } catch {
      Alert.alert('Error de conexión', 'No se pudo cargar la ficha médica.');
    } finally {
      setLoading(false);
    }
  }, [petId, navigation]);

  useEffect(() => { cargarMascota(); }, [cargarMascota]);

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarMascota(true);
    if (historialPeso !== null) await cargarHistorial();
    setRefreshing(false);
  };

  const cargarHistorial = async () => {
    setCargandoHistorial(true);
    try { setHistorialPeso(await fetchHistorialPeso(petId)); }
    catch { setHistorialPeso([]); }
    finally { setCargandoHistorial(false); }
  };

  const toggleHistorial = async () => {
    if (historialVisible) { setHistorialVisible(false); return; }
    setHistorialVisible(true);
    if (historialPeso === null) await cargarHistorial();
  };

  const abrirEditPeso = () => {
    setPesoBorrador(mascota.peso != null ? String(mascota.peso).replace('.', ',') : '');
    setEditandoPeso(true);
    setTimeout(() => pesoInputRef.current?.focus(), 100);
  };

  const confirmarPeso = async () => {
    const n = parseFloat(pesoBorrador.replace(',', '.'));
    if (isNaN(n) || !pesoValido(n, mascota?.especie)) {
      Alert.alert('Valor inválido', `Ingresá un peso entre ${textoRangoPeso(mascota?.especie)}.`);
      return;
    }
    setGuardandoPeso(true);
    try {
      const actualizada = await actualizarPeso(petId, n);
      setMascota((p) => ({ ...p, peso: actualizada.peso }));
      setEditandoPeso(false);
      if (historialPeso !== null) cargarHistorial();
    } catch { Alert.alert('Error', 'No se pudo actualizar el peso.'); }
    finally { setGuardandoPeso(false); }
  };

  const abrirEditRaza = async () => {
    setShowRazaPicker(true);
    setCargandoRazas(true);
    try {
      const { razas } = await fetchRazas(mascota.especie);
      setRazasDisponibles(razas.length ? razas : [{ id: null, nombre: 'Sin raza definida' }]);
    } catch {
      setRazasDisponibles([{ id: null, nombre: 'Sin raza definida' }]);
    } finally {
      setCargandoRazas(false);
    }
  };

  const seleccionarRaza = async (opcion) => {
    setShowRazaPicker(false);
    setGuardandoRaza(true);
    try {
      const actualizada = await actualizarRaza(petId, opcion.nombre);
      setMascota((p) => ({ ...p, raza: actualizada.raza }));
    } catch { Alert.alert('Error', 'No se pudo actualizar la raza.'); }
    finally { setGuardandoRaza(false); }
  };

  const abrirEditFecha = () => {
    setFechaBorrador(parseFechaLocal(mascota.fecha_nacimiento) ?? new Date());
    setEditandoFecha(true);
  };

  const confirmarFecha = async (fecha) => {
    setEditandoFecha(false);
    setGuardandoFecha(true);
    const iso = toISODateLocal(fecha);
    try {
      const actualizada = await actualizarFechaNacimiento(petId, iso);
      setMascota((p) => ({ ...p, fecha_nacimiento: actualizada.fecha_nacimiento }));
    } catch { Alert.alert('Error', 'No se pudo actualizar la fecha de nacimiento.'); }
    finally { setGuardandoFecha(false); }
  };

  const formatPeso = (p) => (p == null ? 'Sin registrar' : formatearPeso(p));

  const generarPDF = async () => {
    setGenerandoPdf(true);
    try {
      const [vac, trat, consultas] = petId
        ? await Promise.all([
          fetchVacunas(petId),
          fetchTratamientos(petId),
          fetchConsultas(petId).catch(() => []),
        ])
        : [{ aplicadas: [], sugeridas: [] }, { aplicados: [] }, []];

      const fotoDataUri = await imagenADataUri(petImg);

      const datos = {
        mascota: mascota ?? m,
        usuario,
        vacunas: vac.aplicadas ?? [],
        tratamientos: trat.aplicados ?? [],
        consultas: consultas ?? [],
      };

      if (Platform.OS === 'web') {
        construirDocPdf(jsPDF, datos, fotoDataUri).save(nombreArchivo(m.nombre));
      } else {
        const html = construirHtmlFicha(datos, fotoDataUri);
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Ficha médica de ${m.nombre}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('PDF generado', `El archivo se guardó en:\n${uri}`);
        }
      }
    } catch (e) {
      Alert.alert('Error', `No se pudo generar el PDF.\n\n${e?.message ?? e}`);
    } finally {
      setGenerandoPdf(false);
    }
  };

  const demoMascota = !loading && (!petId || !mascota);
  const interactuable = !loading && !demoMascota;
  const m = mascota ?? MASCOTA_VACIA;
  const edad = calcularEdad(m.fecha_nacimiento);
  const petImg = resolveMascotaVisual(m);

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={s.screenBackground}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={s.headerBtn} accessibilityLabel="Abrir menú"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu" size={30} color={colores.negroSuave} />
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
              colors={[colores.verde]} tintColor={colores.verde} />
          }>

          <View style={s.heroSection}>
            {loading ? (
              <SkeletonBloque width={140} height={30} borderRadius={8} style={{ marginBottom: 12 }} />
            ) : (
              <Text style={s.heroNombre}>{m.nombre}</Text>
            )}
            {loading ? (
              <SkeletonBloque width={110} height={110} borderRadius={20} />
            ) : (
              <Image source={petImg} style={s.heroImg} resizeMode="contain" accessibilityLabel={`Ilustración de ${m.nombre}`} />
            )}

            {!loading && mascotas.length > 1 && (
              <>
                <TouchableOpacity
                  style={[s.petArrow, s.petArrowLeft]}
                  onPress={() => cambiarMascota(-1)}
                  accessibilityRole="button"
                  accessibilityLabel="Mascota anterior"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-back" size={24} color={colores.texto} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.petArrow, s.petArrowRight]}
                  onPress={() => cambiarMascota(1)}
                  accessibilityRole="button"
                  accessibilityLabel="Mascota siguiente"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-forward" size={24} color={colores.texto} />
                </TouchableOpacity>
              </>
            )}
          </View>

        <View style={s.whiteCard}>

          {demoMascota && (
            <View style={s.demoBanner}>
              <Ionicons name="alert-circle-outline" size={14} color={colores.ambar} />
              <Text style={s.demoBannerTxt}>Vista previa — conectá el backend para ver datos reales</Text>
            </View>
          )}

          <Text style={s.secTitulo}>Datos</Text>

          <FilaDato icono="paw-outline"     label="Especie:" valor={capitalizar(m.especie)} />

          <FilaDato icono="pricetag-outline" label="Raza:"
            valor={guardandoRaza ? 'Actualizando...' : (m.raza || 'Sin especificar')}
            onEditar={interactuable ? abrirEditRaza : undefined} editando={false} />

          <FilaDato icono="barbell-outline" label="Peso:" valor={formatPeso(m.peso)}
            onEditar={interactuable ? abrirEditPeso : undefined} editando={editandoPeso}>
            <View style={s.editRow}>
              <TextInput ref={pesoInputRef} style={s.editInput} value={pesoBorrador}
                onChangeText={setPesoBorrador} keyboardType="decimal-pad"
                placeholder="Ej: 20,5" placeholderTextColor={colores.textoTenue} />
              <Text style={s.editUnidad}>kg</Text>
              {guardandoPeso
                ? <ActivityIndicator size="small" color={colores.verde} style={{ marginLeft: 6 }} />
                : <>
                    <TouchableOpacity onPress={confirmarPeso} style={s.btnOk}>
                      <Ionicons name="checkmark" size={16} color={colores.blanco} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditandoPeso(false)} style={s.btnCancel}>
                      <Ionicons name="close" size={16} color={colores.blanco} />
                    </TouchableOpacity>
                  </>
              }
            </View>
          </FilaDato>

          {interactuable && (
            <>
              <TouchableOpacity style={s.histToggle} onPress={toggleHistorial}
                accessibilityLabel={historialVisible ? 'Ocultar historial de peso' : 'Ver historial de peso'}>
                <Ionicons name={historialVisible ? 'chevron-up' : 'chevron-down'} size={14} color={colores.verde} />
                <Text style={s.histToggleTxt}>
                  {historialVisible ? 'Ocultar historial de peso' : 'Ver historial de peso'}
                </Text>
              </TouchableOpacity>

              {historialVisible && (
                <View style={s.histCard}>
                  {cargandoHistorial ? (
                    <ActivityIndicator size="small" color={colores.verde} style={{ paddingVertical: 12 }} />
                  ) : !historialPeso?.length ? (
                    <Text style={s.histEmpty}>
                      Todavía no hay registros — se guarda uno cada vez que actualizás el peso.
                    </Text>
                  ) : (
                    historialPeso.map((h, i) => {
                      const anterior = historialPeso[i + 1];
                      const delta = anterior ? h.peso - anterior.peso : null;
                      return (
                        <View key={h.id} style={[s.histRow, i === historialPeso.length - 1 && s.histRowLast]}>
                          <Text style={s.histFecha}>{formatearFecha(h.fecha)}</Text>
                          <Text style={s.histPeso}>{formatPeso(h.peso)}</Text>
                          <Text style={[
                            s.histDelta,
                            delta > 0 && s.histDeltaUp,
                            delta < 0 && s.histDeltaDown,
                          ]}>
                            {delta == null || delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </>
          )}

          <FilaDato icono="gift-outline" label="Edad:"
            valor={guardandoFecha ? 'Actualizando...' : edad}
            onEditar={interactuable ? abrirEditFecha : undefined}
            editando={false} />

          <FechaPicker visible={editandoFecha} titulo="Fecha de nacimiento"
            valor={fechaBorrador} aniosAtras={30} sinFuturo
            onConfirmar={confirmarFecha} onCancelar={() => setEditandoFecha(false)} />

          <OpcionPicker
            visible={showRazaPicker}
            titulo="Raza"
            opciones={razasDisponibles}
            valor={m.raza}
            cargando={cargandoRazas}
            onSeleccionar={seleccionarRaza}
            onCerrar={() => setShowRazaPicker(false)}
          />

          <Text style={[s.secTitulo, { marginTop: 24 }]}>Secciones</Text>

          <BotonNav icono="hardware-chip-outline" iconoColor={colores.verde} texto="Virtual Vet"
            onPress={() => navigation.navigate('VirtualVet', { petId })} />
          <BotonNav icono="medical-outline"       iconoColor={colores.verde} texto="Vacunas"
            onPress={() => navigation.navigate('Vacunas', { petId: petId ?? 0 })} />
          <BotonNav icono="medkit-outline"        iconoColor={colores.rojo} texto="Tratamientos"
            onPress={() => navigation.navigate('Tratamientos', { petId: petId ?? 0 })} />
          <BotonNav icono="clipboard-outline"     iconoColor={colores.turquesa} texto="Consultas veterinarias"
            onPress={() => navigation.navigate('Consultas', { petId: petId ?? 0 })} />
          <BotonNav icono="bulb-outline"          iconoColor={colores.amarillo} texto="Consejos y curiosidades"
            onPress={() => navigation.navigate('Consejos', { petId: petId ?? 0 })} />

          <TouchableOpacity style={s.pdfBtn} onPress={generarPDF} disabled={generandoPdf || loading}
            accessibilityLabel="Descargar ficha médica en PDF">
            {generandoPdf
              ? <ActivityIndicator size="small" color={colores.blanco} />
              : <Ionicons name="document-text-outline" size={18} color={colores.blanco} />
            }
            <Text style={s.pdfBtnTxt}>{generandoPdf ? 'Generando...' : 'Descargar PDF'}</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
      </View>

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={mascota ?? mascotaActivaDemo}
        activeRoute="FichaMedica"
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: colores.menta },
  screenBackground: { flex: 1, width: '100%', backgroundColor: colores.menta },
  scroll:      { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },

  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn:   { width: 36, alignItems: 'center', justifyContent: 'center' },

  heroSection:  { alignItems: 'center', paddingTop: 12, paddingBottom: 0, backgroundColor: 'transparent' },
  heroNombre:   { fontSize: 24, fontWeight: '800', color: colores.texto, marginBottom: 12, zIndex: 2 },
  bubble:       { backgroundColor: colores.verde },
  heroPetShadow: {
    shadowColor: '#1a7a45',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 2,
  },
  heroImg:      { width: 110, height: 110 },

  petArrow: {
    position: 'absolute', bottom: 35,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center', zIndex: 4,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  petArrowLeft:  { left: 18 },
  petArrowRight: { right: 18 },

  whiteCard: { backgroundColor: colores.blanco, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, marginTop: 16 },

  demoBanner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 16 },
  demoBannerTxt: { fontSize: 12, color: colores.ambar, textAlign: 'center' },

  secTitulo: { fontSize: 13, fontWeight: '700', color: colores.textoSecundario, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },

  dataCard:  { backgroundColor: colores.blanco, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10, shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  dataRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dataLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dataRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dataIcon:  { fontSize: 18 },
  dataLabel: { fontSize: 14, color: colores.textoSecundario },
  dataValor: { fontSize: 15, fontWeight: '600', color: colores.texto, textAlign: 'right', flexShrink: 1 },
  editIcon:  { fontSize: 16 },

  editRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editInput:   { borderWidth: 1.5, borderColor: colores.verde, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, fontSize: 14, color: colores.texto, minWidth: 60, textAlign: 'center' },
  editUnidad:  { fontSize: 13, color: colores.textoSecundario },
  btnOk:       { backgroundColor: colores.verde, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  btnCancel:   { backgroundColor: colores.textoTenue, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },

  navCard:   { backgroundColor: colores.blanco, borderRadius: 16, height: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  navTexto:  { flex: 1, fontSize: 15, fontWeight: '700', color: colores.texto },
  navFlecha: { fontSize: 22, color: colores.textoTenue, lineHeight: 26 },

  pdfBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colores.verde, borderRadius: 30, height: 48, width: '65%', alignSelf: 'center', marginTop: 28, marginBottom: 10, shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  pdfBtnTxt: { fontSize: 15, fontWeight: '700', color: colores.blanco },

  histToggle:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, marginTop: -4, marginBottom: 8 },
  histToggleTxt: { fontSize: 12, fontWeight: '700', color: colores.verde },
  histCard:      { backgroundColor: colores.blanco, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 6, marginBottom: 10, shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  histRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colores.gris50 },
  histRowLast:   { borderBottomWidth: 0 },
  histFecha:     { flex: 1, fontSize: 13, color: colores.textoSecundario },
  histPeso:      { fontSize: 14, fontWeight: '600', color: colores.texto, marginRight: 12 },
  histDelta:     { fontSize: 12, fontWeight: '700', color: colores.textoTenue, width: 64, textAlign: 'right' },
  histDeltaUp:   { color: colores.ambar },
  histDeltaDown: { color: colores.turquesa },
  histEmpty:     { fontSize: 12, color: colores.textoGris, textAlign: 'center', paddingVertical: 12, lineHeight: 18 },
});
