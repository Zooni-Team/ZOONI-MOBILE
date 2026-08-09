/**
 * PersonaProfileModal.jsx — Ficha de perfil de cualquier usuario (Instagram-like)
 *
 * Genérico por usuarioId (a diferencia de MatchInfoModal, que es por match).
 * Se usa desde Comunidad (amigos, solicitudes, búsqueda). Muestra foto grande
 * tocable (visor a pantalla completa), @usuario, bio, mascota e intereses.
 *
 * Props: visible, usuarioId, onClose, onAbrirChat?(persona)
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { fetchPerfilPublico } from '../services/perfilApi';
import { resolveMascotaVisual } from '../constants/petImages';

const C = {
  bg: '#F4FBF6', surface: '#FFFFFF', text: '#2C2C2C', textSoft: '#6B6B6B',
  brand: '#2DBD72', brandText: '#177046', cta: '#F5C842', divider: '#E8EFE9', chipBg: '#E8F7EE',
};

export default function PersonaProfileModal({ visible, usuarioId, onClose, onAbrirChat }) {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fotoFull, setFotoFull] = useState(false);

  useEffect(() => {
    if (!visible || usuarioId == null) return;
    let cancelado = false;
    setCargando(true); setData(null);
    fetchPerfilPublico(usuarioId)
      .then((d) => { if (!cancelado) setData(d); })
      .catch(() => { if (!cancelado) setData(null); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [visible, usuarioId]);

  const persona = data?.persona;
  const mascota = data?.mascota;
  const tieneFoto = !!persona?.fotoPerfil;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={onClose} style={s.topBtn} accessibilityLabel="Cerrar">
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </TouchableOpacity>
          <Text style={s.topTitle}>Perfil</Text>
          <View style={s.topBtn} />
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color={C.brand} style={{ marginTop: 60 }} />
        ) : !data ? (
          <View style={s.errorWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color={C.textSoft} />
            <Text style={s.errorTxt}>No pudimos cargar el perfil.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
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

            <Text style={s.nombre}>
              {persona.nombre}{persona.edad != null ? `, ${persona.edad}` : ''}
            </Text>
            {persona.nombreUsuario ? <Text style={s.usuario}>@{persona.nombreUsuario}</Text> : null}

            {(persona.ubicacion || persona.distanciaKm != null) && (
              <View style={s.ubicRow}>
                <Ionicons name="location-outline" size={15} color={C.textSoft} />
                <Text style={s.ubicTxt}>
                  {persona.ubicacion ?? 'Sin ubicación'}
                  {persona.distanciaKm != null ? `  ·  a ${persona.distanciaKm} km` : ''}
                </Text>
              </View>
            )}

            {persona.bio ? <Text style={s.bio}>{persona.bio}</Text> : null}

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
                {mascota.descripcion ? <Text style={s.petDesc}>{mascota.descripcion}</Text> : null}
              </View>
            )}

            {persona.intereses?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitulo}>Intereses</Text>
                <View style={s.chips}>
                  {persona.intereses.map((i) => (
                    <View key={i} style={s.chip}><Text style={s.chipTxt}>{i}</Text></View>
                  ))}
                </View>
              </View>
            )}

            {onAbrirChat && (
              <TouchableOpacity style={s.btnChat} onPress={() => { onClose(); onAbrirChat(persona); }}
                accessibilityRole="button" accessibilityLabel={`Enviar mensaje a ${persona.nombre}`}>
                <Ionicons name="chatbubble-ellipses" size={18} color={C.text} />
                <Text style={s.btnChatTxt}>Enviar mensaje</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        <Modal visible={fotoFull} transparent animationType="fade" onRequestClose={() => setFotoFull(false)}>
          <Pressable style={s.fullScrim} onPress={() => setFotoFull(false)}>
            <TouchableOpacity style={s.fullClose} onPress={() => setFotoFull(false)} accessibilityLabel="Cerrar foto">
              <Ionicons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
            {tieneFoto && <Image source={{ uri: persona.fotoPerfil }} style={s.fullFoto} resizeMode="contain" />}
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
    paddingHorizontal: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.divider,
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

  ubicRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  ubicTxt: { fontSize: 14, color: C.textSoft },
  bio: { fontSize: 14, color: C.text, textAlign: 'center', marginTop: 12, lineHeight: 20, paddingHorizontal: 8 },

  card: {
    alignSelf: 'stretch', backgroundColor: C.surface, borderRadius: 18, padding: 16, marginTop: 16,
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

  fullScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fullClose: { position: 'absolute', top: 40, right: 20, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  fullFoto: { width: '92%', height: '80%' },
});
