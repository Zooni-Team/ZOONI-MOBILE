import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { crearCartel } from '../../api/comunidad';
import { colores } from '../../theme';

const TIPOS = [
  { v: 'perdida',       l: 'Mascota Perdida',    icono: 'alert-circle-outline', color: colores.rojo },
  { v: 'encontrada',    l: 'Mascota Encontrada', icono: 'checkmark-circle-outline', color: colores.verde },
  { v: 'adopcion',      l: 'En Adopción',        icono: 'heart-outline', color: colores.amarillo },
  { v: 'aviso_general', l: 'Aviso General',      icono: 'megaphone-outline', color: colores.textoSecundario },
];

export default function FormularioCartel({ coordenadas, onExito, onCancelar }) {
  const [tipo,    setTipo]    = useState('perdida');
  const [desc,    setDesc]    = useState('');
  const [tel,     setTel]     = useState('');
  const [errTel,  setErrTel]  = useState('');
  const [fotoUri, setFotoUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const validar = (v) => {
    const ok = /^[+]?[\d\s\-()\\.]{7,20}$/.test(v.trim());
    setErrTel(ok ? '' : 'Formato inválido. Ej: +54 11 1234-5678');
    return ok;
  };

  const elegirDeGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Sin permiso', 'Habilitá el acceso a la galería desde la configuración del dispositivo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) setFotoUri(res.assets[0].uri);
  };

  const abrirCamara = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Sin permiso', 'Habilitá el acceso a la cámara desde la configuración del dispositivo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) setFotoUri(res.assets[0].uri);
  };

  const submit = async () => {
    if (!tel.trim()) { setErrTel('El teléfono de contacto es requerido'); return; }
    if (!validar(tel)) return;
    setLoading(true);
    try {
      const data = await crearCartel({
        tipo,
        descripcion: desc,
        telefono_contacto: tel.trim(),
        fotoUri,
        lat: coordenadas.latitude,
        lng: coordenadas.longitude,
      });
      onExito(data.cartel);
    } catch {
      Alert.alert('Error', 'No se pudo crear el cartel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.tituloRow}>
            <Ionicons name="warning-outline" size={18} color={colores.rojo} />
            <Text style={styles.titulo}>Crear Cartel de Mascota</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.lbl}>Tipo</Text>
            <View style={styles.tiposRow}>
              {TIPOS.map(t => (
                <TouchableOpacity key={t.v}
                  style={[styles.tipoBtn, tipo === t.v && styles.tipoBtnOn]}
                  onPress={() => setTipo(t.v)}>
                  <Ionicons name={t.icono} size={14} color={tipo === t.v ? colores.verde : t.color} />
                  <Text style={[styles.tipoBtnText, tipo === t.v && styles.tipoBtnTextOn]}>{t.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.lbl}>Descripción</Text>
            <TextInput style={[styles.input, styles.textarea]}
              placeholder="Características, última vez vista..."
              value={desc} onChangeText={setDesc}
              multiline maxLength={300} />

            <Text style={styles.lbl}>Teléfono de Contacto *</Text>
            <TextInput style={[styles.input, errTel ? styles.inputErr : null]}
              placeholder="Ej. +54 11 1234-5678"
              value={tel} keyboardType="phone-pad"
              onChangeText={v => { setTel(v); if (errTel) validar(v); }} />
            {errTel ? <Text style={styles.errText}>{errTel}</Text> : null}

            <Text style={styles.lbl}>Foto (opcional)</Text>
            {fotoUri && (
              <View style={styles.previewWrap}>
                <Image source={{ uri: fotoUri }} style={styles.preview} />
                <TouchableOpacity style={styles.previewQuitar} onPress={() => setFotoUri(null)}
                  accessibilityLabel="Quitar foto">
                  <Ionicons name="close" size={14} color={colores.blanco} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.fotoBtnsRow}>
              <TouchableOpacity style={styles.btnFoto} onPress={elegirDeGaleria} activeOpacity={0.85} disabled={loading}>
                <Text style={styles.btnFotoText}>Seleccionar archivo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnFoto} onPress={abrirCamara} activeOpacity={0.85} disabled={loading}>
                <Text style={styles.btnFotoText}>📷 Abrir cámara</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.btnsRow}>
              <TouchableOpacity style={styles.btnCancel} onPress={onCancelar} disabled={loading}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnCrear, loading && { opacity: 0.6 }]}
                onPress={submit} disabled={loading}>
                {loading
                  ? <ActivityIndicator color={colores.blanco} />
                  : <Text style={styles.btnCrearText}>Crear Cartel</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:   { backgroundColor: colores.blanco, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  titulo:  { fontSize: 18, fontWeight: '700', color: colores.texto },
  lbl:     { fontSize: 14, fontWeight: '600', color: colores.texto, marginTop: 12, marginBottom: 6 },
  input:   { borderWidth: 1.5, borderColor: colores.gris500, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colores.texto },
  inputErr:{ borderColor: colores.rojo },
  textarea:{ height: 90, textAlignVertical: 'top' },
  errText: { color: colores.rojo, fontSize: 12, marginTop: 4 },
  tiposRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tipoBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: colores.gris500 },
  tipoBtnOn:    { borderColor: colores.verde, backgroundColor: '#E8FFF2' },
  tipoBtnText:  { fontSize: 12, color: colores.textoSecundario },
  tipoBtnTextOn:{ color: colores.verde, fontWeight: '600' },
  previewWrap: { alignSelf: 'flex-start', marginBottom: 10 },
  preview: { width: 80, height: 80, borderRadius: 10 },
  previewQuitar: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11, backgroundColor: colores.rojo,
    alignItems: 'center', justifyContent: 'center',
  },
  fotoBtnsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  btnFoto: { flex: 1, backgroundColor: colores.amarillo, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  btnFotoText: { fontSize: 12, fontWeight: '700', color: colores.texto },
  btnsRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8 },
  btnCancel:    { flex: 1, backgroundColor: '#4A4A4A', borderRadius: 25, paddingVertical: 13, alignItems: 'center' },
  btnCancelText:{ color: colores.blanco, fontWeight: '700', fontSize: 14 },
  btnCrear:     { flex: 1, backgroundColor: colores.verde, borderRadius: 25, paddingVertical: 13, alignItems: 'center' },
  btnCrearText: { color: colores.blanco, fontWeight: '700', fontSize: 14 },
});
