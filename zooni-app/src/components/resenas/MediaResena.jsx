/**
 * MediaResena.jsx — Fotos y videos de las reseñas
 *
 *   · <MiniaturaMedia>  cuadradito para listas (los videos llevan ▶)
 *   · <VisorMedia>      pantalla completa para ver una foto o reproducir un
 *                       video, deslizando entre todos los de la lista
 *
 * No hay reproductor nativo instalado (expo-av): en web el video se ve con el
 * <video> del navegador; en el celular se abre con el reproductor del sistema.
 */

import { createElement, useEffect, useState } from 'react';
import {
  Image, Linking, Modal, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const esWeb = Platform.OS === 'web';

export function MiniaturaMedia({ item, size = 76, onPress, extra }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[s.mini, { width: size, height: size }]}
      accessibilityLabel={item.tipo === 'video' ? 'Ver video' : 'Ver foto'}>
      {item.tipo === 'video' ? (
        esWeb
          ? createElement('video', {
            src: item.url ?? item.uri, muted: true, preload: 'metadata', playsInline: true,
            style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
          })
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#2C2C2C' }]} />
      ) : (
        <Image source={{ uri: item.url ?? item.uri }} style={StyleSheet.absoluteFill} />
      )}
      {item.tipo === 'video' && (
        <View style={s.play} pointerEvents="none">
          <Ionicons name="play" size={size > 60 ? 22 : 16} color="#FFFFFF" />
        </View>
      )}
      {extra ? <View style={s.extra} pointerEvents="none"><Text style={s.extraTxt}>{extra}</Text></View> : null}
    </TouchableOpacity>
  );
}

export function VisorMedia({ items, indice, onCerrar }) {
  const [i, setI] = useState(indice ?? 0);
  useEffect(() => { setI(indice ?? 0); }, [indice]);
  const visible = indice != null && items?.length > 0;
  const item = visible ? items[Math.min(i, items.length - 1)] : null;
  const url = item?.url ?? item?.uri;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onCerrar} transparent={false}>
      <SafeAreaView style={s.visor}>
        <View style={s.visorTop}>
          <TouchableOpacity onPress={onCerrar} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {items?.length > 1 && <Text style={s.visorCont}>{i + 1} / {items.length}</Text>}
          <View style={{ width: 28 }} />
        </View>

        <View style={s.visorCuerpo}>
          {item?.tipo === 'video' ? (
            esWeb ? createElement('video', {
              key: url, src: url, controls: true, autoPlay: true, playsInline: true,
              style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000' },
            }) : (
              <TouchableOpacity style={s.videoNativo} onPress={() => Linking.openURL(url)}>
                <Ionicons name="play-circle" size={72} color="#FFFFFF" />
                <Text style={s.videoNativoTxt}>Reproducir video</Text>
              </TouchableOpacity>
            )
          ) : item ? (
            <Image source={{ uri: url }} style={s.foto} resizeMode="contain" />
          ) : null}
        </View>

        {items?.length > 1 && (
          <View style={s.flechas}>
            <TouchableOpacity style={s.flecha} disabled={i === 0} onPress={() => setI((x) => x - 1)}
              accessibilityLabel="Anterior">
              <Ionicons name="chevron-back" size={26} color={i === 0 ? '#666' : '#FFF'} />
            </TouchableOpacity>
            <TouchableOpacity style={s.flecha} disabled={i === items.length - 1} onPress={() => setI((x) => x + 1)}
              accessibilityLabel="Siguiente">
              <Ionicons name="chevron-forward" size={26} color={i === items.length - 1 ? '#666' : '#FFF'} />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  mini: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#EEE' },
  play: {
    position: 'absolute', top: '50%', left: '50%', width: 34, height: 34, marginLeft: -17, marginTop: -17,
    borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  extra: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  extraTxt: { color: '#FFF', fontSize: 18, fontWeight: '900' },

  visor: { flex: 1, backgroundColor: '#000' },
  visorTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  visorCont: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  visorCuerpo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  foto: { width: '100%', height: '100%' },
  videoNativo: { alignItems: 'center', gap: 8 },
  videoNativoTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  flechas: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 20 },
  flecha: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
});
