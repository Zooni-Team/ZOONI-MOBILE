import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { crearCartel } from '../api/comunidad';

const TIPOS = [
  { value: 'perdida',     label: 'Mascota Perdida'    },
  { value: 'encontrada',  label: 'Mascota Encontrada' },
  { value: 'adopcion',    label: 'En Adopción'        },
  { value: 'aviso_general', label: 'Aviso General'   },
];

export default function FormularioCartel({ coordenadas, onExito, onCancelar }) {
  const [tipo, setTipo]         = useState('perdida');
  const [descripcion, setDesc]  = useState('');
  const [telefono, setTelefono] = useState('');
  const [foto, setFoto]         = useState(null);
  const [errTel, setErrTel]     = useState('');
  const [loading, setLoading]   = useState(false);

  const validarTelefono = (val) => {
    const ok = /^[+]?[\d\s\-()]{7,20}$/.test(val.trim());
    setErrTel(ok ? '' : 'Formato inválido. Ej: +54 11 1234-5678');
    return ok;
  };

  const elegirFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setFoto(result.assets[0]);
  };

  const handleSubmit = async () => {
    if (!telefono.trim()) { setErrTel('El teléfono de contacto es requerido'); return; }
    if (!validarTelefono(telefono)) return;

    setLoading(true);
    try {
      const form = new FormData();
      form.append('tipo', tipo);
      form.append('descripcion', descripcion);
      form.append('telefono_contacto', telefono.trim());
      form.append('lat', String(coordenadas.latitude));
      form.append('lng', String(coordenadas.longitude));

      if (foto) {
        const filename = foto.uri.split('/').pop();
        const ext = filename.split('.').pop().toLowerCase();
        form.append('foto', { uri: foto.uri, type: `image/${ext}`, name: filename });
      }

      const data = await crearCartel(form);
      onExito(data.cartel);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo crear el cartel. Revisá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>🚨 Crear Cartel de Mascota</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Tipo */}
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.tiposRow}>
          {TIPOS.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[styles.tipoBtnOption, tipo === t.value && styles.tipoActivo]}
              onPress={() => setTipo(t.value)}
            >
              <Text style={[styles.tipoBtnText, tipo === t.value && styles.tipoActivoText]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Descripción */}
        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Descripción de la mascota, características, última vez vista..."
          value={descripcion}
          onChangeText={setDesc}
          multiline
          maxLength={300}
        />

        {/* Teléfono */}
        <Text style={styles.label}>Teléfono de Contacto *</Text>
        <TextInput
          style={[styles.input, errTel ? styles.inputError : null]}
          placeholder="Ej. +54 11 1234-5678"
          value={telefono}
          onChangeText={(v) => { setTelefono(v); if (errTel) validarTelefono(v); }}
          keyboardType="phone-pad"
        />
        {errTel ? <Text style={styles.errorText}>{errTel}</Text> : null}

        {/* Foto */}
        <Text style={styles.label}>Foto (opcional)</Text>
        <TouchableOpacity style={styles.fotoPicker} onPress={elegirFoto}>
          <Text style={styles.fotoPickerText}>
            {foto ? `📷 ${foto.uri.split('/').pop()}` : 'Seleccionar foto'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Formatos: JPG, PNG, GIF · Máx 5MB</Text>

        {/* Botones */}
        <View style={styles.botonesRow}>
          <TouchableOpacity style={styles.btnCancelar} onPress={onCancelar} disabled={loading}>
            <Text style={styles.btnCancelarText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCrear} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnCrearText}>Crear Cartel</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  titulo: { fontSize: 18, fontWeight: 'bold', color: '#2C2C2C', marginBottom: 16 },
  label:  { fontSize: 14, fontWeight: '600', color: '#2C2C2C', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#2C2C2C',
  },
  inputError: { borderColor: '#E63946' },
  textarea: { height: 90, textAlignVertical: 'top' },
  errorText: { color: '#E63946', fontSize: 12, marginTop: 4 },
  tiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoBtnOption: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    marginBottom: 4,
  },
  tipoActivo: { borderColor: '#2DBD72', backgroundColor: '#E8FFF2' },
  tipoBtnText: { fontSize: 12, color: '#6B6B6B' },
  tipoActivoText: { color: '#2DBD72', fontWeight: '600' },
  fotoPicker: {
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  fotoPickerText: { color: '#6B6B6B', fontSize: 14 },
  hint: { fontSize: 11, color: '#AAAAAA', marginTop: 4 },
  botonesRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8 },
  btnCancelar: {
    flex: 1,
    backgroundColor: '#4A4A4A',
    borderRadius: 25,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnCancelarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  btnCrear: {
    flex: 1,
    backgroundColor: '#2DBD72',
    borderRadius: 25,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnCrearText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
