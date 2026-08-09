/**
 * PetMatchProfileModal.jsx — Crear el perfil de Match de UNA mascota
 *
 * Aparece cuando el usuario tiene una mascota activa sin perfil de Match
 * (ej: agregó un gato y solo su perro tenía perfil). Pide una descripción
 * corta y si aparece en el pool de Match, y marca PerfilMatchCreado.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { resolveMascotaVisual } from '../../constants/petImages';
import { crearPerfilMatchMascota } from '../../services/matchApi';
import { alerta } from '../../utils/dialogo';

export default function PetMatchProfileModal({ visible, mascota, onClose, onCreado }) {
  const [descripcion, setDescripcion] = useState('');
  const [visibleEnMatch, setVisibleEnMatch] = useState(true);
  const [guardando, setGuardando] = useState(false);

  if (!mascota) return null;

  const guardar = async () => {
    setGuardando(true);
    try {
      await crearPerfilMatchMascota(mascota.id, {
        descripcion: descripcion.trim() || undefined,
        visibleEnMatch,
      });
      setGuardando(false);
      setDescripcion('');
      onCreado(mascota.id);
    } catch {
      setGuardando(false);
      alerta('No pudimos crear el perfil', 'Revisá tu conexión y probá de nuevo.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />

          <Image source={resolveMascotaVisual(mascota)} style={s.avatar} resizeMode="cover" />
          <Text style={s.titulo}>Perfil de Match de {mascota.nombre}</Text>
          <Text style={s.subtitulo}>
            {mascota.especie}{mascota.raza ? ` · ${mascota.raza}` : ''}
          </Text>
          <Text style={s.cuerpo}>
            Contá cómo es para que otras personas la conozcan.
          </Text>

          <TextInput
            style={s.input}
            placeholder={`Contá algo de ${mascota.nombre}: qué le gusta, cómo es con otros animales…`}
            placeholderTextColor="#9B9B9B"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            maxLength={150}
          />
          <Text style={s.contador}>{descripcion.length}/150</Text>

          <TouchableOpacity style={s.toggleFila} onPress={() => setVisibleEnMatch((v) => !v)}
            accessibilityRole="switch" accessibilityState={{ checked: visibleEnMatch }}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>¿Aparece en Match?</Text>
              <Text style={s.toggleApoyo}>
                Otras personas van a poder ver su perfil y proponer un encuentro.
              </Text>
            </View>
            <Ionicons name={visibleEnMatch ? 'checkbox' : 'square-outline'} size={26}
              color={visibleEnMatch ? '#177046' : '#9B9B9B'} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.btnCrear, guardando && { opacity: 0.6 }]}
            onPress={guardar} disabled={guardando}
            accessibilityRole="button" accessibilityLabel={`Crear perfil de ${mascota.nombre}`}>
            {guardando
              ? <ActivityIndicator size="small" color="#2C2C2C" />
              : <Text style={s.btnCrearTxt}>Crear perfil de {mascota.nombre}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.btnCancelar} onPress={onClose}
            accessibilityRole="button" accessibilityLabel="Ahora no">
            <Text style={s.btnCancelarTxt}>Ahora no</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 28, alignItems: 'center',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E8EFE9', marginBottom: 12 },

  avatar: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#2DBD72',
    backgroundColor: '#E4F9EA',
  },
  titulo:    { fontSize: 19, fontWeight: '800', color: '#2C2C2C', marginTop: 10, textAlign: 'center' },
  subtitulo: { fontSize: 14, color: '#6B6B6B', marginTop: 2 },
  cuerpo:    { fontSize: 14, color: '#6B6B6B', textAlign: 'center', lineHeight: 20, marginTop: 8 },

  input: {
    alignSelf: 'stretch', minHeight: 80, borderWidth: 1, borderColor: '#E8EFE9',
    borderRadius: 14, padding: 12, fontSize: 15, color: '#2C2C2C', marginTop: 14,
    textAlignVertical: 'top',
  },
  contador: { alignSelf: 'flex-end', fontSize: 12, color: '#5A6B60', marginTop: 4 },

  toggleFila: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, minHeight: 44,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: '#2C2C2C' },
  toggleApoyo: { fontSize: 13, color: '#6B6B6B', marginTop: 2, lineHeight: 18 },

  btnCrear: {
    alignSelf: 'stretch', height: 52, borderRadius: 26, backgroundColor: '#F5C842',
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  btnCrearTxt: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
  btnCancelar: { paddingVertical: 14 },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: '#6B6B6B' },
});
