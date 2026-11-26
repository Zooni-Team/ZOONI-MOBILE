import React, { useCallback, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { resolveMascotaVisual } from '../../constants/petImages';

import { LIMITE_ACTIVAS, MOTIVOS_ARCHIVO, archivarMascota, fetchMisMascotas, marcarPrincipal, recuperarMascota } from '../../services/petsApi';
import { alerta } from '../../utils/dialogo';
import { colores } from '../../theme';
import Toast from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';

import { P, CardActiva, CardArchivada, CardMemoria, TituloSeccion, SkeletonCard } from '../../components/mascotas/TarjetasMascota';

export default function MisMascotasScreen() {
  const navigation = useNavigation();

  const [estadoCarga, setEstadoCarga] = useState('cargando');
  const [activas, setActivas] = useState([]);
  const [archivadas, setArchivadas] = useState([]);
  const [enMemoria, setEnMemoria] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  const { toast, mostrarToast: mostrarAviso, ocultarToast } = useToast(6000);
  const undoRef = useRef(null);

  const [sheetArchivar, setSheetArchivar] = useState(null);
  const [motivoSel, setMotivoSel] = useState(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [sheetMenu, setSheetMenu] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const data = await fetchMisMascotas();
      setActivas(data.activas);
      setArchivadas(data.archivadas);
      setEnMemoria(data.enMemoria);
      setEstadoCarga('ok');
    } catch {
      setEstadoCarga('offline');
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const mostrarToast = (texto, undo = null, error = false) => {
    undoRef.current = undo;
    mostrarAviso(texto, {
      color: error ? colores.rojo : colores.verde,
      icono: error ? 'alert-circle' : 'checkmark-circle',
      accion: undo ? { texto: 'Deshacer', onPress: deshacerToast } : null,
    });
  };

  async function deshacerToast() {
    const fn = undoRef.current;
    ocultarToast();
    if (fn) {
      try { await fn(); await cargar(); } catch { mostrarToast('No pudimos deshacer el cambio', null, true); }
    }
  }

  const confirmarArchivo = async () => {
    const m = sheetArchivar;
    const motivo = motivoSel;
    const texto = motivoSel === 'other' ? motivoTexto.trim() || null : null;
    setSheetArchivar(null);
    setMotivoSel(null);
    setMotivoTexto('');

    setActivas((prev) => prev.filter((x) => x.id !== m.id));
    try {
      const { promovida } = await archivarMascota(m.id, motivo, texto);
      await cargar();
      if (motivo === 'deceased') {
        mostrarToast(`Guardamos las fotos y los recuerdos de ${m.nombre}`);
      } else if (promovida) {
        mostrarToast(`Ahora ${promovida.nombre} es tu mascota principal`,
          () => recuperarMascota(m.id));
      } else {
        mostrarToast('Mascota archivada correctamente', () => recuperarMascota(m.id));
      }
    } catch {
      await cargar();
      mostrarToast(`No pudimos archivar a ${m.nombre}`, null, true);
    }
  };

  const recuperar = async (m) => {
    setArchivadas((prev) => prev.filter((x) => x.id !== m.id));
    setEnMemoria((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await recuperarMascota(m.id);
      await cargar();
      mostrarToast(`${m.nombre} volvió a tus mascotas activas`,
        () => archivarMascota(m.id, m.motivoArchivo, m.motivoArchivoTexto));
    } catch (e) {
      await cargar();
      if (e?.code === 'LIMITE_ACTIVAS') {
        alerta(
          `Llegaste al máximo de ${LIMITE_ACTIVAS} mascotas activas`,
          `Archivá otra para recuperar a ${m.nombre}.`
        );
      } else {
        mostrarToast(`No pudimos recuperar a ${m.nombre}`, null, true);
      }
    }
  };

  const abrirMenu = (m) => setSheetMenu(m);

  const accionMenu = async (accion) => {
    const m = sheetMenu;
    setSheetMenu(null);
    if (!m) return;
    if (accion === 'ficha') {
      navigation.navigate('FichaMedica', { mascotaId: m.id });
    } else if (accion === 'principal') {
      try {
        await marcarPrincipal(m.id);
        await cargar();
        mostrarToast(`Ahora ${m.nombre} es tu mascota principal`);
      } catch {
        mostrarToast('No pudimos guardar el cambio', null, true);
      }
    } else if (accion === 'recuperar') {
      recuperar(m);
    } else if (accion === 'eliminar') {
      navigation.navigate('EliminarMascota', { mascota: m });
    }
  };

  const limiteAlcanzado = activas.length >= LIMITE_ACTIVAS;
  const offline = estadoCarga === 'offline';
  const cargando = estadoCarga === 'cargando';
  const vacioTotal = !cargando && !offline &&
    activas.length === 0 && archivadas.length === 0 && enMemoria.length === 0;

  const archivadasFiltradas = busqueda.trim()
    ? archivadas.filter((m) =>
        `${m.nombre} ${m.raza ?? ''}`.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : archivadas;

  const accionOffline = () => mostrarToast('Necesitás conexión para hacer este cambio', null, true);

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}
          accessibilityRole="button" accessibilityLabel="Volver"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={P.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={s.tituloFila}>
          <Ionicons name="paw" size={20} color={P.brandText} />
          <Text style={s.titulo}>Configuración de Mascotas</Text>
        </View>

        {offline && (
          <View style={s.bannerOffline}>
            <Ionicons name="cloud-offline-outline" size={16} color={P.amberText} />
            <Text style={s.bannerOfflineTxt}>
              Sin conexión con la base. Configurá el .env de Supabase y recargá.
            </Text>
          </View>
        )}

        {!vacioTotal && (
          <>
            <TouchableOpacity
              style={[s.cta, (limiteAlcanzado || offline) && s.btnDisabled]}
              disabled={limiteAlcanzado || offline}
              onPress={() => navigation.navigate('AltaMascota')}
              accessibilityRole="button" accessibilityLabel="Agregar nueva mascota">
              <Ionicons name="add" size={18} color={P.text} />
              <Text style={s.ctaTxt}>Agregar nueva mascota</Text>
            </TouchableOpacity>
            {limiteAlcanzado && (
              <Text style={s.limiteTxt}>
                Llegaste al máximo de {LIMITE_ACTIVAS} mascotas activas. Archivá alguna para agregar otra.
              </Text>
            )}
          </>
        )}

        {vacioTotal && (
          <View style={s.vacioTotal}>
            <Ionicons name="paw-outline" size={80} color={P.brand} />
            <Text style={s.vacioTitulo}>Todavía no cargaste ninguna mascota</Text>
            <Text style={s.vacioApoyo}>
              Agregá a tu compañero para usar la ficha médica, los paseos y el match.
            </Text>
            <TouchableOpacity style={s.cta} onPress={() => navigation.navigate('AltaMascota')}
              accessibilityRole="button" accessibilityLabel="Agregar nueva mascota">
              <Ionicons name="add" size={18} color={P.text} />
              <Text style={s.ctaTxt}>Agregar nueva mascota</Text>
            </TouchableOpacity>
          </View>
        )}

        {!vacioTotal && (
          <>
            <TituloSeccion titulo="Activas" contador={activas.length} />
            {cargando && <SkeletonCard />}
            {!cargando && activas.length === 0 && (
              <View style={s.vacioSeccion}>
                <Text style={s.vacioSeccionTxt}>No tenés mascotas activas actualmente.</Text>
                {archivadas.length > 0 && (
                  <Text style={s.vacioSeccionSub}>
                    Recuperá una mascota archivada o agregá una nueva.
                  </Text>
                )}
              </View>
            )}
            {activas.map((m) => (
              <CardActiva key={m.id} m={m} disabled={offline}
                onPress={() => navigation.navigate('FichaMedica', { mascotaId: m.id })}
                onEditar={() => (offline ? accionOffline() : navigation.navigate('EditarMascota', { mascota: m }))}
                onArchivar={() => (offline ? accionOffline() : setSheetArchivar(m))}
                onMenu={() => abrirMenu(m)}
              />
            ))}

            <TituloSeccion titulo="Archivadas" contador={archivadas.length} icono="archive-outline" />
            {archivadas.length > 8 && (
              <View style={s.buscador}>
                <Ionicons name="search" size={16} color={P.textSoft} />
                <TextInput style={s.buscadorInput} placeholder="Buscar mascota archivada"
                  placeholderTextColor={P.textSoft} value={busqueda} onChangeText={setBusqueda} />
              </View>
            )}
            {cargando && <SkeletonCard />}
            {!cargando && archivadas.length === 0 && (
              <View style={s.vacioSeccion}>
                <Text style={s.vacioSeccionTxt}>No hay mascotas archivadas.</Text>
              </View>
            )}
            {archivadasFiltradas.map((m) => (
              <CardArchivada key={m.id} m={m} disabled={offline}
                onPress={() => navigation.navigate('FichaMedica', { mascotaId: m.id })}
                onRecuperar={() => (offline ? accionOffline() : recuperar(m))}
                onMenu={() => abrirMenu(m)}
              />
            ))}

            {enMemoria.length > 0 && (
              <>
                <TituloSeccion titulo="En memoria" contador={enMemoria.length} icono="heart-outline" />
                {enMemoria.map((m) => (
                  <CardMemoria key={m.id} m={m}
                    onPress={() => navigation.navigate('FichaMedica', { mascotaId: m.id })}
                    onMenu={() => abrirMenu(m)} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Toast {...toast} onCerrar={ocultarToast} />

      <Modal visible={!!sheetMenu} transparent animationType="slide" onRequestClose={() => setSheetMenu(null)}>
        <Pressable style={s.scrim} onPress={() => setSheetMenu(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitulo}>{sheetMenu?.nombre}</Text>
            <TouchableOpacity style={s.sheetFila} onPress={() => accionMenu('ficha')}>
              <Ionicons name="medkit-outline" size={20} color={P.text} />
              <Text style={s.sheetFilaTxt}>Ver ficha médica</Text>
            </TouchableOpacity>
            {sheetMenu?.estado === 'active' && !sheetMenu?.esPrincipal && (
              <TouchableOpacity style={s.sheetFila} onPress={() => accionMenu('principal')}>
                <Ionicons name="star-outline" size={20} color={P.text} />
                <Text style={s.sheetFilaTxt}>Marcar como principal</Text>
              </TouchableOpacity>
            )}
            {(sheetMenu?.estado === 'archived' || sheetMenu?.estado === 'memorial') && (
              <TouchableOpacity style={s.sheetFila} onPress={() => accionMenu('recuperar')}>
                <Ionicons name="refresh-circle-outline" size={20} color={P.brandText} />
                <Text style={[s.sheetFilaTxt, { color: P.brandText }]}>
                  {sheetMenu?.estado === 'memorial' ? 'Recuperar (volver a activas)' : 'Recuperar'}
                </Text>
              </TouchableOpacity>
            )}
            <View style={s.sheetDivider} />
            <TouchableOpacity style={s.sheetFila} onPress={() => accionMenu('eliminar')}>
              <Ionicons name="trash-outline" size={20} color={P.sosRedText} />
              <Text style={[s.sheetFilaTxt, { color: P.sosRedText }]}>Eliminar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!sheetArchivar} transparent animationType="slide"
        onRequestClose={() => setSheetArchivar(null)}>
        <Pressable style={s.scrim} onPress={() => setSheetArchivar(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />
            {sheetArchivar && (
              <Image source={resolveMascotaVisual(sheetArchivar)}
                style={s.sheetAvatar} resizeMode="cover" />
            )}
            <Text style={s.sheetTituloGrande}>¿Archivar a {sheetArchivar?.nombre}?</Text>
            <Text style={s.sheetCuerpo}>
              Se guarda toda su información: ficha médica, vacunas, fotos e historial de paseos.
              Podés recuperarla cuando quieras.
            </Text>

            <View style={s.sheetInfoBox}>
              <Text style={s.sheetInfoTitulo}>Mientras esté archivada</Text>
              <View style={s.sheetInfoFila}>
                <Ionicons name="home-outline" size={14} color={P.textSoft} />
                <Text style={s.sheetInfoTxt}>No va a aparecer en tu inicio ni en Match.</Text>
              </View>
              <View style={s.sheetInfoFila}>
                <Ionicons name="notifications-off-outline" size={14} color={P.textSoft} />
                <Text style={s.sheetInfoTxt}>No vas a recibir recordatorios de sus vacunas.</Text>
              </View>
              <View style={s.sheetInfoFila}>
                <Ionicons name="walk-outline" size={14} color={P.textSoft} />
                <Text style={s.sheetInfoTxt}>No vas a poder registrar paseos con ella.</Text>
              </View>
            </View>

            <Text style={s.motivoLabel}>Motivo (opcional)</Text>
            <View style={s.motivosWrap}>
              {MOTIVOS_ARCHIVO.map((mo) => (
                <TouchableOpacity key={mo.value}
                  style={[s.motivoChip, motivoSel === mo.value && s.motivoChipActivo]}
                  onPress={() => setMotivoSel(motivoSel === mo.value ? null : mo.value)}
                  accessibilityRole="radio" accessibilityState={{ selected: motivoSel === mo.value }}>
                  <Text style={[s.motivoChipTxt, motivoSel === mo.value && s.motivoChipTxtActivo]}>
                    {mo.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {motivoSel === 'other' && (
              <TextInput style={s.motivoInput} placeholder="Contanos el motivo"
                placeholderTextColor={P.textSoft} maxLength={60}
                value={motivoTexto} onChangeText={setMotivoTexto} />
            )}
            {motivoSel === 'deceased' && (
              <Text style={s.memorialAviso}>
                Lamentamos tu pérdida. Guardamos las fotos y los recuerdos de {sheetArchivar?.nombre}.
                No vas a recibir más recordatorios sobre él.
              </Text>
            )}

            <TouchableOpacity style={s.sheetBtnArchivar} onPress={confirmarArchivo}
              accessibilityRole="button" accessibilityLabel={`Archivar a ${sheetArchivar?.nombre}`}>
              <Text style={s.sheetBtnArchivarTxt}>Archivar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetBtnCancelar} onPress={() => setSheetArchivar(null)}
              accessibilityRole="button" accessibilityLabel="Cancelar">
              <Text style={s.sheetBtnCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: P.bgTop },
  header: {
    height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    marginTop: Platform.OS === 'android' ? 24 : 0,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content:   { paddingHorizontal: 16, paddingBottom: 48 },

  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 20 },
  titulo:     { fontSize: 22, fontWeight: '800', color: P.text, flex: 1 },

  bannerOffline: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3E0', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  bannerOfflineTxt: { flex: 1, fontSize: 13, color: P.amberText, lineHeight: 18 },

  cta: {
    height: 52, borderRadius: 30, backgroundColor: P.cta,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  ctaTxt:    { fontSize: 16, fontWeight: '700', color: P.text },
  limiteTxt: { fontSize: 13, color: P.amberText, textAlign: 'center', marginTop: 8 },

  especieRaza:  { fontSize: 14, color: P.textSoft, marginTop: 4, textAlign: 'center' },

  btnDisabled:    { opacity: 0.45 },

  vacioSeccion: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, minHeight: 72,
    alignItems: 'center', justifyContent: 'center', padding: 16, gap: 4,
  },
  vacioSeccionTxt: { fontSize: 14, color: P.textSoft, textAlign: 'center' },
  vacioSeccionSub: { fontSize: 13, fontWeight: '600', color: P.brandText, textAlign: 'center' },

  vacioTotal:  { alignItems: 'center', marginTop: 40, gap: 12, paddingHorizontal: 12 },
  vacioTitulo: { fontSize: 18, fontWeight: '800', color: P.text, textAlign: 'center' },
  vacioApoyo:  { fontSize: 14, color: P.textSoft, textAlign: 'center', lineHeight: 20, marginBottom: 8 },

  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 44,
    backgroundColor: colores.blanco, borderRadius: 22, paddingHorizontal: 16, marginBottom: 12,
  },
  buscadorInput: { flex: 1, fontSize: 14, color: P.text },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colores.blanco, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 28,
  },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: P.divider, marginBottom: 12 },
  sheetTitulo: { fontSize: 16, fontWeight: '700', color: P.text, textAlign: 'center', marginBottom: 8 },
  sheetAvatar: { width: 56, height: 56, borderRadius: 28, alignSelf: 'center', marginBottom: 10, backgroundColor: P.bgTop },
  sheetTituloGrande: { fontSize: 19, fontWeight: '800', color: P.text, textAlign: 'center' },
  sheetCuerpo: { fontSize: 14, color: P.textSoft, textAlign: 'center', lineHeight: 20, marginTop: 8 },

  sheetInfoBox: { backgroundColor: P.surfaceArchived, borderRadius: 12, padding: 12, marginTop: 14, gap: 6 },
  sheetInfoTitulo: { fontSize: 13, fontWeight: '700', color: P.text, marginBottom: 2 },
  sheetInfoFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetInfoTxt:  { flex: 1, fontSize: 13, color: P.textSoft, lineHeight: 18 },

  motivoLabel: { fontSize: 13, fontWeight: '700', color: P.textSoftMint, marginTop: 14, marginBottom: 8 },
  motivosWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motivoChip: {
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: P.neutralBtn,
  },
  motivoChipActivo:    { backgroundColor: P.brandText },
  motivoChipTxt:       { fontSize: 13, color: P.brandText, fontWeight: '600' },
  motivoChipTxtActivo: { color: colores.blanco },
  motivoInput: {
    borderWidth: 1, borderColor: P.divider, borderRadius: 12, marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: P.text,
  },
  memorialAviso: { fontSize: 13, color: P.textSoftMint, marginTop: 10, lineHeight: 18, textAlign: 'center' },

  sheetBtnArchivar: {
    height: 52, borderRadius: 26, backgroundColor: P.brandText,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  sheetBtnArchivarTxt: { fontSize: 16, fontWeight: '700', color: colores.blanco },
  sheetBtnCancelar:    { alignItems: 'center', paddingVertical: 14 },
  sheetBtnCancelarTxt: { fontSize: 16, fontWeight: '700', color: P.textSoft },

  sheetFila:    { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 4 },
  sheetFilaTxt: { fontSize: 16, fontWeight: '600', color: P.text },
  sheetDivider: { height: 1, backgroundColor: P.divider, marginVertical: 4 },
});
