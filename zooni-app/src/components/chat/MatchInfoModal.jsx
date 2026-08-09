/**
 * MatchInfoModal.jsx — Ficha de perfil de un match (tipo Instagram/WhatsApp)
 *
 * Se abre al tocar la foto o el nombre en el chat o en la lista de mensajes.
 * Muestra: foto grande (tocable → visor a pantalla completa), datos de la
 * persona, su mascota (la del match), intereses y desde cuándo son match.
 *
 * Props:
 *   visible, matchId, onClose
 *   onAbrirChat (opcional) → botón "Abrir chat" (para la lista de mensajes)
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { fetchDetalleMatch } from '../../services/matchApi';
import { resolveMascotaVisual } from '../../constants/petImages';
import { MOTIVOS_REPORTE, bloquearUsuario, reportarUsuario } from '../../services/moderacionApi';
import { alerta, confirmar } from '../../utils/dialogo';

const C = {
  bg: '#F4FBF6', surface: '#FFFFFF', text: '#2C2C2C', textSoft: '#6B6B6B',
  brand: '#2DBD72', brandText: '#177046', cta: '#F5C842', divider: '#E8EFE9',
  chipBg: '#E8F7EE',
};

function formatFecha(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function MatchInfoModal({ visible, matchId, onClose, onAbrirChat, onBloqueado }) {
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fotoFull, setFotoFull] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporteAbierto, setReporteAbierto] = useState(false);

  useEffect(() => {
    if (!visible || !matchId) return;
    let cancelado = false;
    setCargando(true);
    setDetalle(null);
    fetchDetalleMatch(matchId)
      .then((d) => { if (!cancelado) setDetalle(d); })
      .catch(() => { if (!cancelado) setDetalle(null); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [visible, matchId]);

  const persona = detalle?.persona;
  const mascota = detalle?.mascota;
  const tieneFoto = !!persona?.fotoPerfil;

  const bloquear = async () => {
    setMenu(false);
    const ok = await confirmar(`¿Bloquear a ${persona.nombre}?`,
      'No va a poder verte en Match ni escribirte, y no vas a volver a verlo.',
      { textoOk: 'Bloquear', textoCancelar: 'Cancelar', destructivo: true });
    if (!ok) return;
    try {
      await bloquearUsuario(persona.id);
      onClose();
      onBloqueado?.(persona.id);
    } catch { alerta('No pudimos bloquear', 'Probá de nuevo.'); }
  };

  const enviarReporte = async (motivo) => {
    setReporteAbierto(false);
    try {
      await reportarUsuario(persona.id, motivo);
      alerta('Gracias por avisar', 'Nuestro equipo va a revisar el reporte.');
    } catch { alerta('No pudimos enviar el reporte', 'Probá de nuevo.'); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        {/* Header con cerrar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={onClose} style={s.topBtn} accessibilityLabel="Cerrar">
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </TouchableOpacity>
          <Text style={s.topTitle}>Información</Text>
          <TouchableOpacity style={s.topBtn} onPress={() => setMenu(true)} disabled={!persona}
            accessibilityLabel="Más opciones">
            <Ionicons name="ellipsis-vertical" size={22} color={persona ? C.text : 'transparent'} />
          </TouchableOpacity>
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color={C.brand} style={{ marginTop: 60 }} />
        ) : !detalle ? (
          <View style={s.errorWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color={C.textSoft} />
            <Text style={s.errorTxt}>No pudimos cargar el perfil.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {/* Foto grande (tocable → pantalla completa) */}
            <TouchableOpacity activeOpacity={0.9} disabled={!tieneFoto}
              onPress={() => setFotoFull(true)} style={s.fotoWrap}
              accessibilityRole="imagebutton" accessibilityLabel={`Foto de ${persona.nombre}`}>
              {tieneFoto ? (
                <Image source={{ uri: persona.fotoPerfil }} style={s.foto} />
              ) : (
                <View style={[s.foto, s.fotoFallback]}>
                  <Text style={s.fotoInicial}>{persona.nombre?.[0] ?? '?'}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Nombre + edad + @usuario */}
            <Text style={s.nombre}>
              {persona.nombre}{persona.edad != null ? `, ${persona.edad}` : ''}
            </Text>
            {persona.nombreUsuario ? <Text style={s.usuario}>@{persona.nombreUsuario}</Text> : null}

            {/* Ubicación / distancia */}
            {(persona.ubicacion || persona.distanciaKm != null) && (
              <View style={s.ubicRow}>
                <Ionicons name="location-outline" size={15} color={C.textSoft} />
                <Text style={s.ubicTxt}>
                  {persona.ubicacion ?? 'Sin ubicación'}
                  {persona.distanciaKm != null ? `  ·  a ${persona.distanciaKm} km` : ''}
                </Text>
              </View>
            )}

            {/* Match desde */}
            {detalle.fechaMatch && (
              <View style={s.matchBadge}>
                <Ionicons name="heart" size={13} color={C.brandText} />
                <Text style={s.matchBadgeTxt}>Hicieron match el {formatFecha(detalle.fechaMatch)}</Text>
              </View>
            )}

            {/* Su mascota */}
            {mascota && (
              <View style={s.card}>
                <Text style={s.cardTitulo}>Su mascota</Text>
                <View style={s.petRow}>
                  <Image source={resolveMascotaVisual(mascota)} style={s.petAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.petNombre}>{mascota.nombre}</Text>
                    <Text style={s.petDatos}>
                      {[mascota.especie, mascota.raza,
                        mascota.edad != null ? `${mascota.edad} ${mascota.edad === 1 ? 'año' : 'años'}` : null,
                        mascota.sexo].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
                {mascota.descripcion ? (
                  <Text style={s.petDesc}>{mascota.descripcion}</Text>
                ) : null}
              </View>
            )}

            {/* Intereses */}
            {persona.intereses?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitulo}>Intereses en común y gustos</Text>
                <View style={s.chips}>
                  {persona.intereses.map((i) => (
                    <View key={i} style={s.chip}>
                      <Text style={s.chipTxt}>{i}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {onAbrirChat && (
              <TouchableOpacity style={s.btnChat} onPress={() => { onClose(); onAbrirChat(); }}
                accessibilityRole="button" accessibilityLabel={`Abrir chat con ${persona.nombre}`}>
                <Ionicons name="chatbubble-ellipses" size={18} color={C.text} />
                <Text style={s.btnChatTxt}>Abrir chat</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* Menú: bloquear / reportar */}
        <Modal visible={menu} transparent animationType="slide" onRequestClose={() => setMenu(false)}>
          <Pressable style={s.sheetScrim} onPress={() => setMenu(false)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <View style={s.sheetHandle} />
              <TouchableOpacity style={s.sheetFila} onPress={() => { setMenu(false); setReporteAbierto(true); }}>
                <Ionicons name="flag-outline" size={20} color={C.text} />
                <Text style={s.sheetFilaTxt}>Reportar</Text>
              </TouchableOpacity>
              <View style={s.sheetDiv} />
              <TouchableOpacity style={s.sheetFila} onPress={bloquear}>
                <Ionicons name="ban-outline" size={20} color="#B3121D" />
                <Text style={[s.sheetFilaTxt, { color: '#B3121D' }]}>Bloquear</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Sheet de motivos de reporte */}
        <Modal visible={reporteAbierto} transparent animationType="slide" onRequestClose={() => setReporteAbierto(false)}>
          <Pressable style={s.sheetScrim} onPress={() => setReporteAbierto(false)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitulo}>¿Por qué querés reportar?</Text>
              {MOTIVOS_REPORTE.map((m) => (
                <TouchableOpacity key={m.value} style={s.sheetFila} onPress={() => enviarReporte(m.value)}>
                  <Text style={s.sheetFilaTxt}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Visor de foto a pantalla completa */}
        <Modal visible={fotoFull} transparent animationType="fade" onRequestClose={() => setFotoFull(false)}>
          <Pressable style={s.fullScrim} onPress={() => setFotoFull(false)}>
            <TouchableOpacity style={s.fullClose} onPress={() => setFotoFull(false)} accessibilityLabel="Cerrar foto">
              <Ionicons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
            {tieneFoto && (
              <Image source={{ uri: persona.fotoPerfil }} style={s.fullFoto} resizeMode="contain" />
            )}
          </Pressable>
        </Modal>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  topBar: {
    height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  topBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '800', color: C.text },

  errorWrap: { alignItems: 'center', gap: 12, marginTop: 60 },
  errorTxt: { fontSize: 14, color: C.textSoft },

  scroll: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  fotoWrap: { marginBottom: 14 },
  foto: { width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: C.brand },
  fotoFallback: { backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center' },
  fotoInicial: { fontSize: 52, fontWeight: '800', color: C.brandText },

  nombre: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center' },
  usuario: { fontSize: 15, color: C.textSoft, marginTop: 2 },

  ubicRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ubicTxt: { fontSize: 14, color: C.textSoft },

  matchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    backgroundColor: C.chipBg, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
  },
  matchBadgeTxt: { fontSize: 13, fontWeight: '700', color: C.brandText },

  card: {
    alignSelf: 'stretch', backgroundColor: C.surface, borderRadius: 18,
    padding: 16, marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardTitulo: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 },

  petRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  petAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: C.brand, backgroundColor: C.bg },
  petNombre: { fontSize: 16, fontWeight: '700', color: C.text },
  petDatos: { fontSize: 13, color: C.textSoft, marginTop: 2 },
  petDesc: { fontSize: 13, color: C.textSoft, lineHeight: 19, marginTop: 12 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: C.chipBg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.brandText },

  btnChat: {
    alignSelf: 'stretch', height: 50, borderRadius: 25, backgroundColor: C.cta,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22,
  },
  btnChatTxt: { fontSize: 16, fontWeight: '700', color: C.text },

  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 28, paddingHorizontal: 8 },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.divider, marginBottom: 8 },
  sheetTitulo: { fontSize: 15, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 8 },
  sheetFila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  sheetFilaTxt: { fontSize: 16, fontWeight: '600', color: C.text },
  sheetDiv: { height: 1, backgroundColor: C.divider, marginVertical: 4 },

  fullScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fullClose: { position: 'absolute', top: 40, right: 20, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  fullFoto: { width: '92%', height: '80%' },
});
