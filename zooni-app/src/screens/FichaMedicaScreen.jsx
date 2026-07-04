/**
 * FichaMedicaScreen.jsx — Pantalla "Ficha Médica" de Zooni
 *
 * Sin dependencias externas más allá de las ya instaladas en el proyecto.
 * Navegación: desde Home con { petId } o { mascotaId }.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { calcularEdad } from '../utils/calcularEdad';
import { resolvePetImage } from '../constants/petImages';
import SkeletonLoader from '../components/SkeletonLoader';
import HamburgerDrawer from '../components/HamburgerDrawer';
import { useUsuarioActivo } from '../hooks/useUsuarioActivo';
import { fetchMascota, actualizarPeso, actualizarFechaNacimiento } from '../services/fichaMedicaApi';

// ─── FECHA PICKER (modal propio, sin dependencias externas) ──────────────────

function FechaPicker({ visible, valor, onConfirmar, onCancelar }) {
  const [dia,  setDia]  = useState(valor.getDate());
  const [mes,  setMes]  = useState(valor.getMonth() + 1);
  const [anio, setAnio] = useState(valor.getFullYear());

  useEffect(() => {
    setDia(valor.getDate());
    setMes(valor.getMonth() + 1);
    setAnio(valor.getFullYear());
  }, [valor]);

  const diasEnMes = new Date(anio, mes, 0).getDate();
  const dias  = Array.from({ length: diasEnMes }, (_, i) => i + 1);
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const hoyAnio = new Date().getFullYear();
  const anios = Array.from({ length: 31 }, (_, i) => hoyAnio - i);

  const confirmar = () => onConfirmar(new Date(anio, mes - 1, Math.min(dia, diasEnMes)));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancelar}>
      <View style={fp.overlay}>
        <View style={fp.container}>
          <Text style={fp.titulo}>Fecha de nacimiento</Text>
          <View style={fp.row}>
            {/* Día */}
            <View style={fp.col}>
              <Text style={fp.colLabel}>Día</Text>
              <ScrollView style={fp.list} showsVerticalScrollIndicator={false}>
                {dias.map((d) => (
                  <TouchableOpacity key={d} style={[fp.item, dia === d && fp.itemOn]} onPress={() => setDia(d)}>
                    <Text style={[fp.itemTxt, dia === d && fp.itemTxtOn]}>{String(d).padStart(2,'0')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* Mes */}
            <View style={[fp.col, { flex: 2 }]}>
              <Text style={fp.colLabel}>Mes</Text>
              <ScrollView style={fp.list} showsVerticalScrollIndicator={false}>
                {meses.map((m, i) => (
                  <TouchableOpacity key={m} style={[fp.item, mes === i+1 && fp.itemOn]} onPress={() => setMes(i+1)}>
                    <Text style={[fp.itemTxt, mes === i+1 && fp.itemTxtOn]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* Año */}
            <View style={fp.col}>
              <Text style={fp.colLabel}>Año</Text>
              <ScrollView style={fp.list} showsVerticalScrollIndicator={false}>
                {anios.map((a) => (
                  <TouchableOpacity key={a} style={[fp.item, anio === a && fp.itemOn]} onPress={() => setAnio(a)}>
                    <Text style={[fp.itemTxt, anio === a && fp.itemTxtOn]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={fp.btns}>
            <TouchableOpacity style={fp.btnCancel} onPress={onCancelar}>
              <Text style={fp.btnCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={fp.btnOk} onPress={confirmar}>
              <Text style={fp.btnOkTxt}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const fp = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  container:  { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  titulo:     { fontSize: 16, fontWeight: '700', color: '#2C2C2C', textAlign: 'center', marginBottom: 16 },
  row:        { flexDirection: 'row', gap: 8, height: 180 },
  col:        { flex: 1 },
  colLabel:   { fontSize: 12, fontWeight: '600', color: '#6B6B6B', textAlign: 'center', marginBottom: 6 },
  list:       { flex: 1, borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 10 },
  item:       { paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  itemOn:     { backgroundColor: '#F0FFF6' },
  itemTxt:    { fontSize: 14, color: '#2C2C2C' },
  itemTxtOn:  { color: '#2DBD72', fontWeight: '700' },
  btns:       { flexDirection: 'row', gap: 12, marginTop: 20 },
  btnCancel:  { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: '#F0F0F0', alignItems: 'center' },
  btnCancelTxt: { fontSize: 15, fontWeight: '700', color: '#6B6B6B' },
  btnOk:      { flex: 1, paddingVertical: 13, borderRadius: 30, backgroundColor: '#2DBD72', alignItems: 'center' },
  btnOkTxt:   { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

// ─── DATOS DEMO (sin backend conectado — mismos datos que Vacunas/Tratamientos) ──

const DEMO_MASCOTA = {
  id: 1, nombre: 'Titán', especie: 'perro',
  raza: 'Labrador Retriever', peso: 20.40,
  fecha_nacimiento: '2022-02-15', imagen_asset: 'perro_default',
};

// ─── COMPONENTES ─────────────────────────────────────────────────────────────

/** PetIllustration — Imagen de la mascota, sin sombra (evita el artefacto rectangular). */
function PetIllustration({ source, label }) {
  return (
    <Image
      source={source}
      style={s.heroImg}
      resizeMode="contain"
      accessibilityLabel={label}
    />
  );
}

function FilaDato({ icono, label, valor, onEditar, editando, children }) {
  return (
    <View style={s.dataCard}>
      <View style={s.dataRow}>
        <View style={s.dataLeft}>
          <Ionicons name={icono} size={18} color="#2DBD72" />
          <Text style={s.dataLabel}>{label}</Text>
        </View>
        <View style={s.dataRight}>
          {editando ? children : (
            <>
              <Text style={s.dataValor}>{valor}</Text>
              {onEditar && (
                <TouchableOpacity onPress={onEditar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="create-outline" size={16} color="#6B6B6B" />
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

// ─── SCREEN ───────────────────────────────────────────────────────────────────

export default function FichaMedicaScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const petId      = route.params?.petId ?? route.params?.mascotaId;

  const [mascota,        setMascota]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [editandoPeso,   setEditandoPeso]   = useState(false);
  const [pesoBorrador,   setPesoBorrador]   = useState('');
  const [guardandoPeso,  setGuardandoPeso]  = useState(false);
  const [editandoFecha,  setEditandoFecha]  = useState(false);
  const [fechaBorrador,  setFechaBorrador]  = useState(new Date());
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [generandoPdf,   setGenerandoPdf]   = useState(false);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const { usuario, mascotaActiva: mascotaActivaDemo } = useUsuarioActivo();

  const pesoInputRef = useRef(null);

  // ── Carga ─────────────────────────────────────────────────────────────────
  // Timeout de 3 segundos: si el backend no responde, mostrar la vista demo
  // en vez de dejar al usuario esperando (mismo patrón que HomeScreen).
  const cargarMascota = useCallback(async () => {
    if (!petId) { setLoading(false); return; }
    setLoading(true);
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

  // ── Peso ──────────────────────────────────────────────────────────────────
  const abrirEditPeso = () => {
    setPesoBorrador(mascota.peso != null ? String(mascota.peso).replace('.', ',') : '');
    setEditandoPeso(true);
    setTimeout(() => pesoInputRef.current?.focus(), 100);
  };

  const confirmarPeso = async () => {
    const n = parseFloat(pesoBorrador.replace(',', '.'));
    if (isNaN(n) || n <= 0 || n >= 500) { Alert.alert('Valor inválido', 'Ingresá un peso entre 0 y 500 kg.'); return; }
    setGuardandoPeso(true);
    try {
      const actualizada = await actualizarPeso(petId, n);
      setMascota((p) => ({ ...p, peso: actualizada.peso }));
      setEditandoPeso(false);
    } catch { Alert.alert('Error', 'No se pudo actualizar el peso.'); }
    finally { setGuardandoPeso(false); }
  };

  // ── Fecha ─────────────────────────────────────────────────────────────────
  const abrirEditFecha = () => {
    setFechaBorrador(mascota.fecha_nacimiento ? new Date(mascota.fecha_nacimiento) : new Date());
    setEditandoFecha(true);
  };

  const confirmarFecha = async (fecha) => {
    setEditandoFecha(false);
    setGuardandoFecha(true);
    const iso = fecha.toISOString().split('T')[0];
    try {
      const actualizada = await actualizarFechaNacimiento(petId, iso);
      setMascota((p) => ({ ...p, fecha_nacimiento: actualizada.fecha_nacimiento }));
    } catch { Alert.alert('Error', 'No se pudo actualizar la fecha de nacimiento.'); }
    finally { setGuardandoFecha(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatPeso = (p) => {
    if (p == null) return 'Sin registrar';
    return parseFloat(p).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
  };

  const capitalizar = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

  const formatFechaLarga = (iso) => {
    if (!iso) return null;
    const [y, mo, d] = iso.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  // Se genera localmente (expo-print) con los datos ya cargados en pantalla,
  // sin depender de un endpoint de backend que hoy no existe.
  const construirHtmlFicha = () => {
    const fechaGeneracion = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    const propietario = `${usuario?.nombre ?? ''} ${usuario?.apellido ?? ''}`.trim() || '—';
    const fechaNac = formatFechaLarga(m.fecha_nacimiento) ?? '—';

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            body { font-family: Helvetica, Arial, sans-serif; margin: 0; color: #2C2C2C; }
            .header { background-color: #2DBD72; padding: 32px 40px; color: #FFFFFF; }
            .header h1 { margin: 0; font-size: 26px; letter-spacing: 0.4px; }
            .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.92; }
            .container { padding: 32px 40px; }
            .section-title {
              font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
              color: #6B6B6B; border-bottom: 2px solid #EFEFEF; padding-bottom: 6px; margin: 28px 0 12px;
            }
            .section-title:first-of-type { margin-top: 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 10px 0; font-size: 14px; border-bottom: 1px solid #F0F0F0; }
            td.label { color: #6B6B6B; width: 45%; }
            td.value { font-weight: 700; text-align: right; color: #2C2C2C; }
            .footer {
              margin-top: 48px; padding-top: 16px; border-top: 1px solid #EFEFEF;
              font-size: 11px; color: #AAAAAA; text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Ficha Médica Digital</h1>
            <p>${m.nombre}${m.especie ? ` · ${capitalizar(m.especie)}` : ''}</p>
          </div>
          <div class="container">
            <div class="section-title">Datos de la mascota</div>
            <table>
              <tr><td class="label">Nombre</td><td class="value">${m.nombre}</td></tr>
              <tr><td class="label">Especie</td><td class="value">${capitalizar(m.especie) || '—'}</td></tr>
              <tr><td class="label">Raza</td><td class="value">${m.raza || 'Sin especificar'}</td></tr>
              <tr><td class="label">Peso</td><td class="value">${formatPeso(m.peso)}</td></tr>
              <tr><td class="label">Fecha de nacimiento</td><td class="value">${fechaNac}</td></tr>
              <tr><td class="label">Edad</td><td class="value">${edad}</td></tr>
            </table>

            <div class="section-title">Propietario</div>
            <table>
              <tr><td class="label">Nombre</td><td class="value">${propietario}</td></tr>
            </table>

            <div class="footer">
              Documento generado el ${fechaGeneracion} · Zooni — Cuidado inteligente para tu mascota
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const generarPDF = async () => {
    setGenerandoPdf(true);
    try {
      const html = construirHtmlFicha();
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
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
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF.');
    } finally {
      setGenerandoPdf(false);
    }
  };

  // Sin petId o error sin mascota (una vez terminada la carga): pantalla demo visual
  const demoMascota = !loading && (!petId || !mascota);
  const interactuable = !loading && !demoMascota;
  const m = mascota ?? DEMO_MASCOTA;
  const edad = calcularEdad(m.fecha_nacimiento);
  const petImg = resolvePetImage(m.imagen_asset ?? m.imagenAsset);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={s.screenBackground}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={s.headerBtn} accessibilityLabel="Abrir menú"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu" size={30} color="#0A0A0A" />
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Hero */}
          <View style={s.heroSection}>
            {loading ? (
              <SkeletonLoader width={140} height={30} borderRadius={8} style={{ marginBottom: 12 }} />
            ) : (
              <Text style={s.heroNombre}>{m.nombre}</Text>
            )}
            {loading ? (
              <SkeletonLoader width={110} height={110} borderRadius={20} />
            ) : (
              <PetIllustration source={petImg} label={`Ilustración de ${m.nombre}`} />
            )}
          </View>

        {/* Card blanco */}
        <View style={s.whiteCard}>

          {demoMascota && (
            <View style={s.demoBanner}>
              <Ionicons name="alert-circle-outline" size={14} color="#F5A623" />
              <Text style={s.demoBannerTxt}>Vista previa — conectá el backend para ver datos reales</Text>
            </View>
          )}

          <Text style={s.secTitulo}>Datos</Text>

          <FilaDato icono="paw-outline"     label="Especie:" valor={capitalizar(m.especie)} />
          <FilaDato icono="pricetag-outline" label="Raza:"    valor={m.raza || 'Sin especificar'} />

          <FilaDato icono="barbell-outline" label="Peso:" valor={formatPeso(m.peso)}
            onEditar={interactuable ? abrirEditPeso : undefined} editando={editandoPeso}>
            <View style={s.editRow}>
              <TextInput ref={pesoInputRef} style={s.editInput} value={pesoBorrador}
                onChangeText={setPesoBorrador} keyboardType="decimal-pad"
                placeholder="Ej: 20,5" placeholderTextColor="#AAAAAA" />
              <Text style={s.editUnidad}>kg</Text>
              {guardandoPeso
                ? <ActivityIndicator size="small" color="#2DBD72" style={{ marginLeft: 6 }} />
                : <>
                    <TouchableOpacity onPress={confirmarPeso} style={s.btnOk}>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditandoPeso(false)} style={s.btnCancel}>
                      <Ionicons name="close" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </>
              }
            </View>
          </FilaDato>

          <FilaDato icono="gift-outline" label="Edad:"
            valor={guardandoFecha ? 'Actualizando...' : edad}
            onEditar={interactuable ? abrirEditFecha : undefined}
            editando={false} />

          <FechaPicker visible={editandoFecha} valor={fechaBorrador}
            onConfirmar={confirmarFecha} onCancelar={() => setEditandoFecha(false)} />

          <Text style={[s.secTitulo, { marginTop: 24 }]}>Secciones</Text>

          <BotonNav icono="hardware-chip-outline" iconoColor="#2DBD72" texto="Virtual Vet"
            onPress={() => navigation.navigate('VirtualVet')} />
          <BotonNav icono="medical-outline"       iconoColor="#2DBD72" texto="Vacunas"
            onPress={() => navigation.navigate('Vacunas', { petId: petId ?? 0 })} />
          <BotonNav icono="medkit-outline"        iconoColor="#E63946" texto="Tratamientos"
            onPress={() => navigation.navigate('Tratamientos', { petId: petId ?? 0 })} />
          <BotonNav icono="bulb-outline"          iconoColor="#F5C842" texto="Consejos y curiosidades"
            onPress={() => navigation.navigate('Consejos', { petId: petId ?? 0 })} />

          <TouchableOpacity style={s.pdfBtn} onPress={generarPDF} disabled={generandoPdf || loading}
            accessibilityLabel="Descargar ficha médica en PDF">
            {generandoPdf
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Ionicons name="document-text-outline" size={18} color="#FFF" />
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

// ─── ESTILOS ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: '#C8F0D8' },
  screenBackground: { flex: 1, width: '100%', backgroundColor: '#C8F0D8' },
  scroll:      { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1 },

  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: 'transparent' },
  headerBtn:   { width: 36, alignItems: 'center', justifyContent: 'center' },

  heroSection:  { alignItems: 'center', paddingTop: 12, paddingBottom: 0, backgroundColor: 'transparent' },
  heroNombre:   { fontSize: 24, fontWeight: '800', color: '#2C2C2C', marginBottom: 12, zIndex: 2 },
  bubble:       { backgroundColor: '#2DBD72' },
  heroPetShadow: {
    shadowColor: '#1a7a45',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 2,
  },
  heroImg:      { width: 110, height: 110 },

  whiteCard: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, marginTop: 16 },

  demoBanner:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 16 },
  demoBannerTxt: { fontSize: 12, color: '#F5A623', textAlign: 'center' },

  secTitulo: { fontSize: 13, fontWeight: '700', color: '#6B6B6B', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },

  dataCard:  { backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  dataRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dataLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dataRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dataIcon:  { fontSize: 18 },
  dataLabel: { fontSize: 14, color: '#6B6B6B' },
  dataValor: { fontSize: 15, fontWeight: '600', color: '#2C2C2C', textAlign: 'right', flexShrink: 1 },
  editIcon:  { fontSize: 16 },

  editRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editInput:   { borderWidth: 1.5, borderColor: '#2DBD72', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, fontSize: 14, color: '#2C2C2C', minWidth: 60, textAlign: 'center' },
  editUnidad:  { fontSize: 13, color: '#6B6B6B' },
  btnOk:       { backgroundColor: '#2DBD72', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  btnCancel:   { backgroundColor: '#AAAAAA', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },

  navCard:   { backgroundColor: '#FFF', borderRadius: 16, height: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  navTexto:  { flex: 1, fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
  navFlecha: { fontSize: 22, color: '#AAAAAA', lineHeight: 26 },

  pdfBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2DBD72', borderRadius: 30, height: 48, width: '65%', alignSelf: 'center', marginTop: 28, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  pdfBtnTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
