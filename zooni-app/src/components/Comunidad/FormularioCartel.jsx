import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { crearCartel } from '../../api/comunidad';

const TIPOS = [
  { v: 'perdida',       l: '🔴 Mascota Perdida'    },
  { v: 'encontrada',    l: '🟢 Mascota Encontrada' },
  { v: 'adopcion',      l: '💛 En Adopción'        },
  { v: 'aviso_general', l: '📌 Aviso General'      },
];

export default function FormularioCartel({ coordenadas, onExito, onCancelar }) {
  const [tipo,    setTipo]    = useState('perdida');
  const [desc,    setDesc]    = useState('');
  const [tel,     setTel]     = useState('');
  const [errTel,  setErrTel]  = useState('');
  const [loading, setLoading] = useState(false);

  const validar = (v) => {
    const ok = /^[+]?[\d\s\-()\\.]{7,20}$/.test(v.trim());
    setErrTel(ok ? '' : 'Formato inválido. Ej: +54 11 1234-5678');
    return ok;
  };

  const submit = async () => {
    if (!tel.trim()) { setErrTel('El teléfono de contacto es requerido'); return; }
    if (!validar(tel)) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('tipo', tipo);
      fd.append('descripcion', desc);
      fd.append('telefono_contacto', tel.trim());
      fd.append('lat', String(coordenadas.latitude));
      fd.append('lng', String(coordenadas.longitude));
      const data = await crearCartel(fd);
      onExito(data.cartel);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo crear el cartel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.titulo}>🚨 Crear Cartel de Mascota</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.lbl}>Tipo</Text>
            <View style={styles.tiposRow}>
              {TIPOS.map(t => (
                <TouchableOpacity key={t.v}
                  style={[styles.tipoBtn, tipo === t.v && styles.tipoBtnOn]}
                  onPress={() => setTipo(t.v)}>
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

            <View style={styles.btnsRow}>
              <TouchableOpacity style={styles.btnCancel} onPress={onCancelar} disabled={loading}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnCrear, loading && { opacity: 0.6 }]}
                onPress={submit} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
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
  sheet:   { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  titulo:  { fontSize: 18, fontWeight: '700', color: '#2C2C2C', marginBottom: 16 },
  lbl:     { fontSize: 14, fontWeight: '600', color: '#2C2C2C', marginTop: 12, marginBottom: 6 },
  input:   { borderWidth: 1.5, borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#2C2C2C' },
  inputErr:{ borderColor: '#E63946' },
  textarea:{ height: 90, textAlignVertical: 'top' },
  errText: { color: '#E63946', fontSize: 12, marginTop: 4 },
  tiposRow:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tipoBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#DDD' },
  tipoBtnOn:    { borderColor: '#2DBD72', backgroundColor: '#E8FFF2' },
  tipoBtnText:  { fontSize: 12, color: '#6B6B6B' },
  tipoBtnTextOn:{ color: '#2DBD72', fontWeight: '600' },
  btnsRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8 },
  btnCancel:    { flex: 1, backgroundColor: '#4A4A4A', borderRadius: 25, paddingVertical: 13, alignItems: 'center' },
  btnCancelText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  btnCrear:     { flex: 1, backgroundColor: '#2DBD72', borderRadius: 25, paddingVertical: 13, alignItems: 'center' },
  btnCrearText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
