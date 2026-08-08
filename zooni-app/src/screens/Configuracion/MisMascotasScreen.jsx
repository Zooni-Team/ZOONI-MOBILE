/**
 * MisMascotasScreen.jsx — "Configuración de Mascotas" (Instruction-MisMascotas v1.0)
 *
 * Índice del ciclo de vida: Activas / Archivadas / En memoria, contra la tabla
 * "Mascota" de Supabase filtrada por el usuario logueado (petsApi.js).
 *
 * Reglas duras del spec que esta pantalla cumple:
 *  - Archivar NO es eliminar: Archivar es neutro (#EDF3EF, reversible con
 *    Deshacer en el toast); Eliminar es rojo, vive en el menú ⋮ y abre una
 *    pantalla dedicada con confirmación escrita.
 *  - La card archivada usa fondo opaco #F1F7F3 + chip "Archivada", nunca
 *    opacidad reducida.
 *  - CTA amarillo (8.79:1), Recuperar #177046 (6.10:1), línea de sección
 *    #177046 — los colores del diseño de Figma no pasaban contraste.
 *  - Escritura optimista con rollback (V7) y toast con Deshacer de 6s.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  Alert, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView,
  StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { resolveMascotaVisual } from '../../constants/petImages';
import {
  LIMITE_ACTIVAS, MOTIVOS_ARCHIVO, archivarMascota, fetchMisMascotas,
  labelMotivo, marcarPrincipal, recuperarMascota,
} from '../../services/petsApi';
import { alerta } from '../../utils/dialogo';

// ─── TOKENS (§3.1) ───────────────────────────────────────────────────────────
const P = {
  bgTop: '#E4F9EA',
  surface: '#FFFFFF',
  surfaceArchived: '#F1F7F3',
  text: '#2C2C2C',
  textSoft: '#6B6B6B',
  textSoftMint: '#5A6B60',
  brand: '#2DBD72',
  brandText: '#177046',
  ringArchived: '#7E9089',
  chipArchivedBg: '#E2EAE5',
  chipArchivedText: '#4A5550',
  cta: '#F5C842',
  neutralBtn: '#EDF3EF',
  sosRedText: '#B3121D',
  toastBg: '#C9EBD4',
  divider: '#E8EFE9',
  amberText: '#A05F00',
  ringMemorial: '#E8D9A8',
};

function formatFecha(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── TOAST CON DESHACER (§3.4.C — 6 segundos) ───────────────────────────────

function Toast({ toast, onUndo, onDismiss }) {
  if (!toast) return null;
  return (
    <View style={s.toast} accessibilityLiveRegion="polite">
      <Ionicons name={toast.error ? 'alert-circle' : 'checkmark-circle'} size={18}
        color={toast.error ? P.sosRedText : P.brandText} />
      <Text style={s.toastTxt}>{toast.texto}</Text>
      {toast.undo && (
        <TouchableOpacity onPress={onUndo} accessibilityRole="button" accessibilityLabel="Deshacer"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.toastUndo}>Deshacer</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onDismiss} accessibilityLabel="Cerrar aviso"
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color={P.textSoftMint} />
      </TouchableOpacity>
    </View>
  );
}

// ─── CARD ACTIVA (§3.4.F) ────────────────────────────────────────────────────

function CardActiva({ m, onPress, onEditar, onArchivar, onMenu, disabled }) {
  const img = resolveMascotaVisual(m);
  const meta = [m.edadTexto, m.peso != null ? `${m.peso} kg` : null].filter(Boolean).join(' · ');
  return (
    <Pressable style={s.card} onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${m.nombre}, ver detalle`}>
      <TouchableOpacity style={s.cardMenu} onPress={onMenu} accessibilityRole="button"
        accessibilityLabel={`Más opciones de ${m.nombre}`}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={20} color={P.textSoft} />
      </TouchableOpacity>

      <View style={s.avatarWrap}>
        <Image source={img} style={s.avatarActiva} resizeMode="cover" />
        {m.esPrincipal && (
          <View style={s.chipPrincipal}>
            <Text style={s.chipPrincipalTxt}>Principal</Text>
          </View>
        )}
      </View>

      <Text style={s.nombreActiva} numberOfLines={1}>{m.nombre}</Text>
      <Text style={s.especieRaza}>
        {m.especie}{m.raza ? ` · ${m.raza}` : ''}
      </Text>
      {meta ? <Text style={s.metadatos}>{meta}</Text> : null}

      <View style={s.botonesFila}>
        <TouchableOpacity style={[s.btnEditar, disabled && s.btnDisabled]} onPress={onEditar}
          disabled={disabled} accessibilityRole="button" accessibilityLabel={`Editar a ${m.nombre}`}>
          <Ionicons name="pencil" size={15} color={P.text} />
          <Text style={s.btnEditarTxt}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btnArchivar, disabled && s.btnDisabled]} onPress={onArchivar}
          disabled={disabled} accessibilityRole="button" accessibilityLabel={`Archivar a ${m.nombre}`}>
          <Ionicons name="archive-outline" size={15} color={P.brandText} />
          <Text style={s.btnArchivarTxt}>Archivar</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

// ─── CARD ARCHIVADA (§3.4.G) ─────────────────────────────────────────────────

function CardArchivada({ m, onPress, onRecuperar, onMenu, disabled }) {
  const img = resolveMascotaVisual(m);
  const motivo = m.motivoArchivo === 'other' && m.motivoArchivoTexto
    ? m.motivoArchivoTexto
    : labelMotivo(m.motivoArchivo);
  return (
    <Pressable style={s.cardArchivada} onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`${m.nombre}, archivada, ver detalle`}>
      <View style={s.chipArchivada}>
        <Ionicons name="archive-outline" size={12} color={P.chipArchivedText} />
        <Text style={s.chipArchivadaTxt}>Archivada</Text>
      </View>
      <TouchableOpacity style={s.cardMenu} onPress={onMenu} accessibilityRole="button"
        accessibilityLabel={`Más opciones de ${m.nombre}`}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={20} color={P.textSoft} />
      </TouchableOpacity>

      <View style={{ alignItems: 'center' }}>
        <Image source={img} style={s.avatarArchivada} resizeMode="cover" />
      </View>
      <Text style={s.nombreArchivada} numberOfLines={1}>{m.nombre}</Text>
      <Text style={s.especieRaza}>{m.especie}{m.raza ? ` · ${m.raza}` : ''}</Text>
      {m.archivadaEn && (
        <Text style={s.fechaArchivo}>Archivada el {formatFecha(m.archivadaEn)}</Text>
      )}
      {motivo ? <Text style={s.motivoArchivo}>{motivo}</Text> : null}

      <TouchableOpacity style={[s.btnRecuperar, disabled && s.btnDisabled]} onPress={onRecuperar}
        disabled={disabled} accessibilityRole="button" accessibilityLabel={`Recuperar a ${m.nombre}`}>
        <Ionicons name="refresh-circle-outline" size={17} color="#FFF" />
        <Text style={s.btnRecuperarTxt}>Recuperar</Text>
      </TouchableOpacity>
    </Pressable>
  );
}

// ─── CARD EN MEMORIA (§4.5) ─────────────────────────────────────────────────

function CardMemoria({ m, onPress }) {
  const img = resolveMascotaVisual(m);
  const anioNac = m.fechaNacimiento ? new Date(m.fechaNacimiento).getFullYear() : null;
  const anioFin = m.fechaFallecimiento ? new Date(m.fechaFallecimiento).getFullYear() : null;
  return (
    <View style={s.cardArchivada}>
      <View style={{ alignItems: 'center' }}>
        <Image source={img} style={s.avatarMemoria} resizeMode="cover" />
      </View>
      <Text style={s.nombreArchivada} numberOfLines={1}>{m.nombre}</Text>
      {anioNac && anioFin && (
        <Text style={s.fechaArchivo}>{anioNac} – {anioFin}</Text>
      )}
      <TouchableOpacity style={s.btnRecuerdos} onPress={onPress}
        accessibilityRole="button" accessibilityLabel={`Ver recuerdos de ${m.nombre}`}>
        <Ionicons name="images-outline" size={16} color={P.brandText} />
        <Text style={s.btnRecuerdosTxt}>Ver recuerdos</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── TÍTULO DE SECCIÓN (§3.4.E) ─────────────────────────────────────────────

function TituloSeccion({ titulo, contador, icono }) {
  return (
    <View style={s.seccion}>
      <View style={s.seccionFila}>
        <Text style={s.seccionTitulo}>{titulo}</Text>
        {icono && <Ionicons name={icono} size={16} color={P.textSoftMint} style={{ marginLeft: 6 }} />}
        <View style={{ flex: 1 }} />
        <Text style={s.seccionContador}>({contador})</Text>
      </View>
      <View style={s.seccionLinea} />
    </View>
  );
}

// ─── SKELETON (V5) ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return <View style={s.skeleton} />;
}

// ─── PANTALLA ───────────────────────────────────────────────────────────────

export default function MisMascotasScreen() {
  const navigation = useNavigation();

  // 'cargando' | 'ok' | 'offline'
  const [estadoCarga, setEstadoCarga] = useState('cargando');
  const [activas, setActivas] = useState([]);
  const [archivadas, setArchivadas] = useState([]);
  const [enMemoria, setEnMemoria] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const undoRef = useRef(null);

  const [sheetArchivar, setSheetArchivar] = useState(null); // mascota a archivar
  const [motivoSel, setMotivoSel] = useState(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [sheetMenu, setSheetMenu] = useState(null);         // mascota del menú ⋮

  const cargar = useCallback(async () => {
    try {
      const data = await fetchMisMascotas();
      setActivas(data.activas);
      setArchivadas(data.archivadas);
      setEnMemoria(data.enMemoria);
      setEstadoCarga('ok');
    } catch {
      setEstadoCarga('offline'); // V6: sin conexión / Supabase sin configurar
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // ── Toast (6s, se reemplaza, no se apila) ──
  const mostrarToast = (texto, undo = null, error = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    undoRef.current = undo;
    setToast({ texto, undo: !!undo, error });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  const deshacerToast = async () => {
    const fn = undoRef.current;
    setToast(null);
    if (fn) {
      try { await fn(); await cargar(); } catch { mostrarToast('No pudimos deshacer el cambio', null, true); }
    }
  };

  // ── Archivar (optimista con rollback, §4.2) ──
  const confirmarArchivo = async () => {
    const m = sheetArchivar;
    const motivo = motivoSel;
    const texto = motivoSel === 'other' ? motivoTexto.trim() || null : null;
    setSheetArchivar(null);
    setMotivoSel(null);
    setMotivoTexto('');

    // Optimista: sale de Activas ya
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
      // V7: rollback
      await cargar();
      mostrarToast(`No pudimos archivar a ${m.nombre}`, null, true);
    }
  };

  // ── Recuperar (§4.3 — baja fricción, sin sheet) ──
  const recuperar = async (m) => {
    setArchivadas((prev) => prev.filter((x) => x.id !== m.id));
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

  // ── Menú ⋮ (§3.4.F — Eliminar vive acá, nunca en la cara de la card) ──
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

      {/* Header: flecha ←, es una sub-pantalla de segundo nivel (anexo) */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}
          accessibilityRole="button" accessibilityLabel="Volver"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={P.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Título con huella vectorial */}
        <View style={s.tituloFila}>
          <Ionicons name="paw" size={20} color={P.brandText} />
          <Text style={s.titulo}>Configuración de Mascotas</Text>
        </View>

        <Toast toast={toast} onUndo={deshacerToast} onDismiss={() => setToast(null)} />

        {offline && (
          <View style={s.bannerOffline}>
            <Ionicons name="cloud-offline-outline" size={16} color={P.amberText} />
            <Text style={s.bannerOfflineTxt}>
              Sin conexión con la base. Configurá el .env de Supabase y recargá.
            </Text>
          </View>
        )}

        {/* CTA principal — amarillo, siempre visible salvo límite (§3.4.D) */}
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

        {/* V4: vacío total — sin encabezados de sección */}
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
            {/* ── ACTIVAS ── */}
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

            {/* ── ARCHIVADAS ── */}
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

            {/* ── EN MEMORIA (solo si hay) ── */}
            {enMemoria.length > 0 && (
              <>
                <TituloSeccion titulo="En memoria" contador={enMemoria.length} icono="heart-outline" />
                {enMemoria.map((m) => (
                  <CardMemoria key={m.id} m={m}
                    onPress={() => navigation.navigate('FichaMedica', { mascotaId: m.id })} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── BOTTOM SHEET: menú ⋮ ── */}
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
            <View style={s.sheetDivider} />
            <TouchableOpacity style={s.sheetFila} onPress={() => accionMenu('eliminar')}>
              <Ionicons name="trash-outline" size={20} color={P.sosRedText} />
              <Text style={[s.sheetFilaTxt, { color: P.sosRedText }]}>Eliminar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── BOTTOM SHEET: archivar (§4.2) ── */}
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

            {/* Motivo (opcional, §4.2) */}
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

// ─── ESTILOS ────────────────────────────────────────────────────────────────

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

  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: P.toastBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    minHeight: 48, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 3,
  },
  toastTxt:  { flex: 1, fontSize: 14, fontWeight: '600', color: P.text },
  toastUndo: { fontSize: 14, fontWeight: '700', color: P.brandText },

  bannerOffline: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3E0', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  bannerOfflineTxt: { flex: 1, fontSize: 13, color: P.amberText, lineHeight: 18 },

  cta: {
    height: 52, borderRadius: 30, backgroundColor: P.cta,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  ctaTxt:    { fontSize: 16, fontWeight: '700', color: P.text },
  limiteTxt: { fontSize: 13, color: P.amberText, textAlign: 'center', marginTop: 8 },

  seccion:         { marginTop: 22, marginBottom: 12 },
  seccionFila:     { flexDirection: 'row', alignItems: 'center' },
  seccionTitulo:   { fontSize: 17, fontWeight: '700', color: P.text },
  seccionContador: { fontSize: 14, fontWeight: '600', color: P.textSoftMint },
  seccionLinea:    { height: 2, backgroundColor: P.brandText, marginTop: 6, borderRadius: 1 },

  card: {
    backgroundColor: P.surface, borderRadius: 20, padding: 16, paddingTop: 20,
    marginBottom: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  cardMenu: { position: 'absolute', top: 10, right: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },

  avatarWrap:   { alignItems: 'center' },
  avatarActiva: {
    width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: P.brand,
    backgroundColor: P.bgTop,
  },
  chipPrincipal: {
    position: 'absolute', bottom: -6, alignSelf: 'center',
    backgroundColor: P.brandText, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },
  chipPrincipalTxt: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  nombreActiva: { fontSize: 20, fontWeight: '800', color: P.text, marginTop: 12 },
  especieRaza:  { fontSize: 14, color: P.textSoft, marginTop: 4, textAlign: 'center' },
  metadatos:    { fontSize: 13, fontWeight: '600', color: P.textSoftMint, marginTop: 2 },

  botonesFila: { flexDirection: 'row', gap: 12, marginTop: 16, alignSelf: 'stretch' },
  btnEditar: {
    flex: 1, height: 40, borderRadius: 20, backgroundColor: P.cta,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnEditarTxt: { fontSize: 15, fontWeight: '700', color: P.text },
  btnArchivar: {
    flex: 1, height: 40, borderRadius: 20, backgroundColor: P.neutralBtn,
    borderWidth: 1.5, borderColor: P.brandText,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnArchivarTxt: { fontSize: 15, fontWeight: '700', color: P.brandText },
  btnDisabled:    { opacity: 0.45 },

  cardArchivada: {
    backgroundColor: P.surfaceArchived, borderRadius: 20, padding: 16, paddingTop: 40,
    marginBottom: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  chipArchivada: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: P.chipArchivedBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  chipArchivadaTxt: { fontSize: 11, fontWeight: '700', color: P.chipArchivedText },
  avatarArchivada: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: P.ringArchived,
    backgroundColor: P.bgTop, opacity: 0.9,
  },
  avatarMemoria: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: P.ringMemorial,
    backgroundColor: P.bgTop,
  },
  nombreArchivada: { fontSize: 18, fontWeight: '700', color: P.text, marginTop: 10 },
  fechaArchivo:    { fontSize: 12, color: P.textSoft, marginTop: 4 },
  motivoArchivo:   { fontSize: 12, fontWeight: '600', color: P.textSoftMint, marginTop: 2 },

  btnRecuperar: {
    alignSelf: 'stretch', height: 40, borderRadius: 20, backgroundColor: P.brandText,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14,
  },
  btnRecuperarTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  btnRecuerdos: {
    alignSelf: 'stretch', height: 40, borderRadius: 20, backgroundColor: '#FFF',
    borderWidth: 1.5, borderColor: P.ringMemorial,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14,
  },
  btnRecuerdosTxt: { fontSize: 15, fontWeight: '700', color: P.brandText },

  vacioSeccion: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, minHeight: 72,
    alignItems: 'center', justifyContent: 'center', padding: 16, gap: 4,
  },
  vacioSeccionTxt: { fontSize: 14, color: P.textSoft, textAlign: 'center' },
  vacioSeccionSub: { fontSize: 13, fontWeight: '600', color: P.brandText, textAlign: 'center' },

  vacioTotal:  { alignItems: 'center', marginTop: 40, gap: 12, paddingHorizontal: 12 },
  vacioTitulo: { fontSize: 18, fontWeight: '800', color: P.text, textAlign: 'center' },
  vacioApoyo:  { fontSize: 14, color: P.textSoft, textAlign: 'center', lineHeight: 20, marginBottom: 8 },

  skeleton: { height: 240, borderRadius: 20, backgroundColor: '#EDF3EF', marginBottom: 12 },

  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 44,
    backgroundColor: '#FFF', borderRadius: 22, paddingHorizontal: 16, marginBottom: 12,
  },
  buscadorInput: { flex: 1, fontSize: 14, color: P.text },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
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
  motivoChipTxtActivo: { color: '#FFF' },
  motivoInput: {
    borderWidth: 1, borderColor: P.divider, borderRadius: 12, marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: P.text,
  },
  memorialAviso: { fontSize: 13, color: P.textSoftMint, marginTop: 10, lineHeight: 18, textAlign: 'center' },

  sheetBtnArchivar: {
    height: 52, borderRadius: 26, backgroundColor: P.brandText,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  sheetBtnArchivarTxt: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  sheetBtnCancelar:    { alignItems: 'center', paddingVertical: 14 },
  sheetBtnCancelarTxt: { fontSize: 16, fontWeight: '700', color: P.textSoft },

  sheetFila:    { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 4 },
  sheetFilaTxt: { fontSize: 16, fontWeight: '600', color: P.text },
  sheetDivider: { height: 1, backgroundColor: P.divider, marginVertical: 4 },
});
