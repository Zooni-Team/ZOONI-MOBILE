import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Keyboard, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import FechaPicker from '../FechaPicker';
import HoraPicker from '../HoraPicker';
import OpcionPicker from '../OpcionPicker';
import { colores, sombras } from '../../theme';
import { combinarFechaHora, fechaHoraTexto } from './formato';

const PANTALLA = Dimensions.get('window');

export const TIPOS_RECORDATORIO = [
  'Control', 'Desparasitación', 'Medicación', 'Paseo', 'Peluquería', 'Turno Veterinario', 'Vacuna', 'Otro',
];
const EMOJIS = ['🐾', '💉', '🚶', '🛁', '💊', '🩺', '✂️', '🎉', '📌', '❤️'];
const COLORES = [
  { valor: colores.verde, nombre: 'verde' }, { valor: colores.turquesa, nombre: 'turquesa' },
  { valor: colores.ambar, nombre: 'ámbar' }, { valor: colores.rojo, nombre: 'rojo' },
  { valor: colores.violeta, nombre: 'violeta' }, { valor: colores.azul, nombre: 'azul' },
];

const VACIO = { titulo: '', descripcion: '', fechaHora: null, tipo: 'Vacuna', emoji: null, color: null };

export default function FormularioRecordatorio({ visible, recordatorio, mascotas, idMascota, onGuardar, onCerrar }) {
  const [montado, setMontado] = useState(visible);
  const [form, setForm] = useState(VACIO);
  const [mascotaElegida, setMascotaElegida] = useState(idMascota ?? null);
  const [errores, setErrores] = useState({});
  const [errorGuardar, setErrorGuardar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [paso, setPaso] = useState(null);
  const [fechaElegida, setFechaElegida] = useState(null);
  const [eligiendoTipo, setEligiendoTipo] = useState(false);

  const escala = useRef(new Animated.Value(0.92)).current;
  const opacidad = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(escala, { toValue: 0.92, duration: 160, useNativeDriver: true }),
        Animated.timing(opacidad, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start(() => setMontado(false));
      return;
    }
    setForm(recordatorio ? {
      titulo: recordatorio.titulo ?? '',
      descripcion: recordatorio.descripcion ?? '',
      fechaHora: new Date(recordatorio.fecha_hora),
      tipo: recordatorio.tipo ?? 'Vacuna',
      emoji: recordatorio.emoji ?? null,
      color: recordatorio.color ?? null,
    } : VACIO);
    setMascotaElegida(recordatorio?.mascotaId ?? idMascota ?? null);
    setErrores({});
    setErrorGuardar(null);
    setMontado(true);
    Animated.parallel([
      Animated.timing(escala, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(opacidad, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, recordatorio, idMascota, escala, opacidad]);

  const cambiar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => (e[campo] ? { ...e, [campo]: null } : e));
  };
  const alternar = (campo, valor) => setForm((f) => ({ ...f, [campo]: f[campo] === valor ? null : valor }));

  async function guardar() {
    const faltan = {};
    if (!form.titulo.trim()) faltan.titulo = 'Escribí un título';
    if (!form.fechaHora) faltan.fechaHora = 'Elegí la fecha y la hora';
    if (Object.keys(faltan).length) { setErrores(faltan); return; }
    if (!mascotaElegida) { setErrorGuardar('Elegí para qué mascota es.'); return; }

    setGuardando(true);
    setErrorGuardar(null);
    try {
      await onGuardar({
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        fecha_hora: form.fechaHora.toISOString(),
        tipo: form.tipo,
        emoji: form.emoji,
        color: form.color,
      }, mascotaElegida);
    } catch {
      setErrorGuardar('No se pudo guardar. Revisá tu conexión y probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  const editando = !!recordatorio;

  return (
    <>
      <Modal visible={montado} transparent animationType="none" onRequestClose={onCerrar}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onCerrar} accessible={false}>
            <TouchableOpacity activeOpacity={1} accessible={false}>
              <Animated.View style={[s.modalCard, { transform: [{ scale: escala }], opacity: opacidad }]}>
                <ScrollView style={s.modalScroll} contentContainerStyle={s.modalScrollContent}
                  showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                  <Text style={s.modalTitulo} accessibilityRole="header">
                    {editando ? 'Editar recordatorio' : 'Nuevo recordatorio'}
                  </Text>

                  <TextInput
                    style={[s.input, errores.titulo && s.inputError]}
                    placeholder="Título (ej.: Turno con la veterinaria)"
                    placeholderTextColor={colores.textoSecundario}
                    accessibilityLabel="Título"
                    value={form.titulo}
                    onChangeText={(v) => cambiar('titulo', v)}
                    maxLength={120}
                    returnKeyType="next"
                  />
                  {errores.titulo ? <Text style={s.errorTxt}>{errores.titulo}</Text> : null}

                  <TextInput
                    style={[s.input, s.inputMulti]}
                    placeholder="Descripción (opcional)"
                    placeholderTextColor={colores.textoSecundario}
                    accessibilityLabel="Descripción"
                    value={form.descripcion}
                    onChangeText={(v) => cambiar('descripcion', v)}
                    maxLength={500}
                    multiline
                    textAlignVertical="top"
                  />

                  <TouchableOpacity style={[s.inputFecha, errores.fechaHora && s.inputError]}
                    onPress={() => setPaso('fecha')} accessibilityRole="button"
                    accessibilityLabel={`Fecha y hora: ${form.fechaHora ? fechaHoraTexto(form.fechaHora) : 'sin elegir'}`}>
                    <Text style={[s.inputFechaTxt, !form.fechaHora && s.sinValor]}>
                      {form.fechaHora ? fechaHoraTexto(form.fechaHora) : 'Fecha y hora'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={colores.textoSecundario} />
                  </TouchableOpacity>
                  {errores.fechaHora ? <Text style={s.errorTxt}>{errores.fechaHora}</Text> : null}

                  <TouchableOpacity style={s.inputFecha} onPress={() => setEligiendoTipo(true)}
                    accessibilityRole="button" accessibilityLabel={`Tipo: ${form.tipo}`}>
                    <Text style={s.inputFechaTxt}>{form.tipo}</Text>
                    <Ionicons name="chevron-down" size={16} color={colores.textoSecundario} />
                  </TouchableOpacity>

                  <Text style={s.pickerLabel}>Referencia (opcional)</Text>
                  <View style={s.emojiRow}>
                    {EMOJIS.map((e) => (
                      <TouchableOpacity key={e} style={[s.emojiChip, form.emoji === e && s.emojiChipOn]}
                        onPress={() => alternar('emoji', e)} hitSlop={4}
                        accessibilityRole="button" accessibilityState={{ selected: form.emoji === e }}
                        accessibilityLabel={`Emoji ${e}`}>
                        <Text style={s.emojiChipTxt}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={s.colorRow}>
                    {COLORES.map((c) => (
                      <TouchableOpacity key={c.valor} hitSlop={6}
                        style={[s.colorSwatch, { backgroundColor: c.valor }, form.color === c.valor && s.colorSwatchOn]}
                        onPress={() => alternar('color', c.valor)}
                        accessibilityRole="button" accessibilityState={{ selected: form.color === c.valor }}
                        accessibilityLabel={`Color ${c.nombre}`} />
                    ))}
                  </View>

                  {mascotas.length > 1 ? (
                    <>
                      <Text style={s.pickerLabel}>¿Para qué mascota?</Text>
                      <View style={s.petPickRow}>
                        {mascotas.map((m) => (
                          <TouchableOpacity key={m.id} style={[s.petPick, mascotaElegida === m.id && s.petPickOn]}
                            onPress={() => setMascotaElegida(m.id)}
                            accessibilityRole="button" accessibilityState={{ selected: mascotaElegida === m.id }}
                            accessibilityLabel={`Para ${m.nombre}`}>
                            <Text style={[s.petPickTxt, mascotaElegida === m.id && s.petPickTxtOn]} numberOfLines={1}>
                              {m.nombre}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  ) : null}

                  {errorGuardar ? <Text style={s.errorGeneral} accessibilityRole="alert">{errorGuardar}</Text> : null}
                </ScrollView>

                <View style={s.modalPie}>
                  <TouchableOpacity style={s.btnCancelar} onPress={onCerrar} disabled={guardando} accessibilityRole="button">
                    <Text style={s.btnCancelarTxt}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnGuardar} onPress={guardar} disabled={guardando} accessibilityRole="button">
                    {guardando
                      ? <ActivityIndicator size="small" color={colores.blanco} />
                      : <Text style={s.btnGuardarTxt}>{editando ? 'Guardar cambios' : 'Guardar'}</Text>}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <FechaPicker visible={paso === 'fecha'} titulo="Fecha" aniosAtras={1} aniosAdelante={6}
        valor={form.fechaHora ?? new Date()}
        onConfirmar={(d) => { setFechaElegida(d); setPaso('hora'); }}
        onCancelar={() => setPaso(null)} />

      <HoraPicker visible={paso === 'hora'} titulo="Hora" valor={form.fechaHora}
        onConfirmar={(hora) => { cambiar('fechaHora', combinarFechaHora(fechaElegida, hora)); setPaso(null); }}
        onCancelar={() => setPaso(null)} />

      <OpcionPicker visible={eligiendoTipo} titulo="Tipo" opciones={TIPOS_RECORDATORIO} valor={form.tipo}
        onSeleccionar={(t) => { cambiar('tipo', t); setEligiendoTipo(false); }}
        onCerrar={() => setEligiendoTipo(false)} />
    </>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.50)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    backgroundColor: colores.blanco, borderRadius: 20,
    width: Math.min(PANTALLA.width * 0.90, 380),
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    ...sombras.modal,
    maxHeight: PANTALLA.height * 0.92,
  },
  modalScroll: { flexGrow: 0, flexShrink: 1 },
  modalScrollContent: { flexGrow: 1 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: colores.verdeOscuro, textAlign: 'center', marginBottom: 14 },
  input: {
    borderWidth: 1.5, borderColor: colores.gris300, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: colores.texto, backgroundColor: colores.blanco,
    marginBottom: 11,
  },
  inputError: { borderColor: colores.rojo },
  inputMulti: { height: 66, textAlignVertical: 'top' },
  inputFecha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: colores.gris300, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 11, backgroundColor: colores.blanco,
  },
  inputFechaTxt: { flex: 1, fontSize: 14, color: colores.texto },
  sinValor: { color: colores.textoSecundario },
  errorGeneral: {
    fontSize: 13, color: colores.rojoOscuro, backgroundColor: colores.rojoFondo,
    borderRadius: 10, padding: 10, marginTop: 8, textAlign: 'center',
  },
  errorTxt: { fontSize: 11, color: colores.rojo, marginTop: -7, marginBottom: 7, marginLeft: 4 },
  pickerLabel: { fontSize: 12.5, color: colores.textoSecundario, marginBottom: 7 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: 11 },
  emojiChip: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: colores.gris300,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colores.blanco,
  },
  emojiChipOn: { borderColor: colores.verde, backgroundColor: colores.mentaFondo },
  emojiChipTxt: { fontSize: 14, lineHeight: 18 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 13 },
  colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchOn: { borderColor: colores.texto },
  modalPie: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    paddingTop: 12, marginTop: 2,
    borderTopWidth: 1, borderTopColor: colores.gris100,
  },
  btnGuardar: {
    flex: 1, height: 46, borderRadius: 30,
    backgroundColor: colores.verde, alignItems: 'center', justifyContent: 'center',
    ...sombras.suave,
  },
  btnGuardarTxt: { fontSize: 15, fontWeight: '700', color: colores.blanco },
  btnCancelar: {
    paddingHorizontal: 22, height: 46, borderRadius: 30, backgroundColor: colores.gris100,
    alignItems: 'center', justifyContent: 'center',
  },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: colores.textoSecundario },
  petPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  petPick: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: colores.gris50, borderWidth: 1.5, borderColor: 'transparent',
  },
  petPickOn: { backgroundColor: colores.mentaFondo, borderColor: colores.verde },
  petPickTxt: { fontSize: 13, color: colores.textoSecundario, fontWeight: '600', maxWidth: 130 },
  petPickTxtOn: { color: colores.verdeOscuro, fontWeight: '700' },
});
