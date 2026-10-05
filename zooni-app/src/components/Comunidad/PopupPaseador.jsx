/**
 * PopupPaseador.jsx — Ficha de un paseador de Zooni en Comunidad
 *
 * Aparece al tocar su círculo en el mapa o su fila en Servicios. A diferencia
 * de PopupServicio (comercios sin cuenta), un paseador de Zooni es un usuario
 * real: se lo puede contratar y la solicitud le llega a su app.
 *
 * Tocar su foto/nombre o "Opiniones" abre todas sus reseñas
 * (ResenasPaseadorModal): estrellas, preguntas, fotos y videos de los dueños.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { formatoDuracion, formatoPlata, serviciosDe } from '../../services/paseadorApi';
import ResenasPaseadorModal from '../resenas/ResenasPaseadorModal';

const TAMANO = { chico: 'chicos', mediano: 'medianos', grande: 'grandes' };

export default function PopupPaseador({ paseador, onClose }) {
  const navigation = useNavigation();
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [verResenas, setVerResenas] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line

  const contratar = () => {
    onClose();
    navigation.navigate('SolicitarPaseo', { paseadorId: paseador.id });
  };

  const tamanos = (paseador.tamanos ?? []).map((t) => TAMANO[t] ?? t);

  return (
    <Animated.View style={[st.popup, { opacity, transform: [{ translateY }] }]}>
      <View style={st.header}>
        <TouchableOpacity style={st.perfilTap} onPress={() => setVerResenas(true)} activeOpacity={0.8}
          accessibilityRole="button" accessibilityLabel={`Ver opiniones de ${paseador.nombreCompleto}`}>
          {paseador.foto
            ? <Image source={{ uri: paseador.foto }} style={st.avatar} />
            : <View style={[st.avatar, st.avatarIni]}><Ionicons name="walk" size={22} color="#2DBD72" /></View>}
          <View style={{ flex: 1 }}>
            <View style={st.nombreFila}>
              <Text style={st.nombre} numberOfLines={1}>{paseador.nombreCompleto}</Text>
              <View style={st.zooni}><Text style={st.zooniTxt}>Zooni</Text></View>
            </View>
            <View style={st.infoRow}>
              {paseador.rating != null ? (
                <>
                  <Ionicons name="star" size={13} color="#F5A623" />
                  <Text style={st.info}>{paseador.rating.toFixed(1).replace('.', ',')} ({paseador.votos})</Text>
                </>
              ) : <Text style={st.info}>Nuevo en Zooni</Text>}
              <Text style={st.info}>· {paseador.paseos} {paseador.paseos === 1 ? 'paseo' : 'paseos'}</Text>
              {paseador.votos > 0 && <Text style={st.verOpiniones}>· Ver opiniones ›</Text>}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar" hitSlop={8}>
          <Ionicons name="close" size={20} color="#6B6B6B" />
        </TouchableOpacity>
      </View>

      <View style={st.infoRow}>
        <Ionicons name="location-outline" size={14} color="#6B6B6B" />
        <Text style={st.info}>{paseador.zona} · atiende a {paseador.radioKm} km a la redonda</Text>
      </View>
      {tamanos.length > 0 && (
        <View style={st.infoRow}>
          <Ionicons name="paw-outline" size={14} color="#6B6B6B" />
          <Text style={st.info}>Perros {tamanos.join(', ')} · hasta {paseador.maxPerros} por paseo</Text>
        </View>
      )}
      {paseador.bio ? <Text style={st.bio} numberOfLines={2}>{paseador.bio}</Text> : null}

      <View style={st.precios}>
        {serviciosDe(paseador).map((x) => (
          <View key={x.minutos} style={st.precio}>
            <Text style={st.precioDur}>{formatoDuracion(x.minutos)}</Text>
            <Text style={st.precioValor}>{formatoPlata(x.precio)}</Text>
          </View>
        ))}
      </View>

      <View style={st.botones}>
        <TouchableOpacity style={st.btnSec} onPress={() => setVerResenas(true)} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="star-outline" size={17} color="#2DBD72" />
          <Text style={st.btnSecTxt}>Opiniones</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.btn} onPress={contratar} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="walk" size={18} color="#2C2C2C" />
          <Text style={st.btnTxt}>Contratar paseo</Text>
        </TouchableOpacity>
      </View>

      <ResenasPaseadorModal
        visible={verResenas}
        idPaseador={paseador.id}
        nombre={paseador.nombreCompleto}
        onCerrar={() => setVerResenas(false)}
      />
    </Animated.View>
  );
}

const st = StyleSheet.create({
  popup: {
    position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#FFF', borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 10,
    zIndex: 200,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#2DBD72' },
  avatarIni: { backgroundColor: '#C8F0D8', alignItems: 'center', justifyContent: 'center' },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombre: { fontSize: 17, fontWeight: '800', color: '#2C2C2C', flexShrink: 1 },
  zooni: { backgroundColor: '#C8F0D8', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  zooniTxt: { fontSize: 10, fontWeight: '800', color: '#2DBD72' },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 3 },
  info: { fontSize: 13, color: '#6B6B6B', flexShrink: 1 },
  bio: { fontSize: 13, color: '#2C2C2C', marginTop: 8, lineHeight: 18 },
  precios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  precio: { flexGrow: 1, flexBasis: '40%', backgroundColor: '#F9FFF9', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#E6EFE9' },
  precioDur: { fontSize: 12, fontWeight: '700', color: '#2DBD72' },
  precioValor: { fontSize: 20, fontWeight: '900', color: '#2C2C2C' },
  perfilTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  verOpiniones: { fontSize: 13, color: '#2DBD72', fontWeight: '800' },
  botones: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btnSec: {
    flexDirection: 'row', gap: 6, height: 50, borderRadius: 30, paddingHorizontal: 16,
    borderWidth: 2, borderColor: '#2DBD72', alignItems: 'center', justifyContent: 'center',
  },
  btnSecTxt: { fontSize: 15, fontWeight: '800', color: '#2DBD72' },
  btn: {
    flex: 1, flexDirection: 'row', gap: 8, height: 50, borderRadius: 30, backgroundColor: '#F5C842',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  btnTxt: { fontSize: 16, fontWeight: '800', color: '#2C2C2C' },
});
