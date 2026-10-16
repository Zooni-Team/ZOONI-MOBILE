/**
 * InformeModal.jsx — Cerrar un turno atendido
 *
 *   · Veterinaria: la consulta → motivo, diagnóstico, tratamiento / indicaciones,
 *     peso, temperatura y próximo control. Queda en la historia clínica del
 *     paciente y el dueño la ve en "Turnos y pedidos".
 *   · Peluquería: notas del trabajo y fotos de cómo quedó (opcional: sumarlas
 *     a "Trabajos", la galería que ven los clientes).
 *
 * Props: visible · tipo · turno · editar (true = corregir un informe ya
 *        guardado) · onGuardar(informe, { aGaleria }) · onCerrar
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { Avatar, C, PillButton } from '../paseador/PaseadorUI';
import FechaPicker from '../FechaPicker';
import { cuandoTexto } from '../../services/negocioApi';
import { subirImagenPublica } from '../../utils/imagenStorage';
import { parseDecimal, sanitizarDecimal } from '../../utils/sanitizar';
import { alerta } from '../../utils/dialogo';

const FOTOS_MAX = 4;
const fechaLarga = (d) => new Date(d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

function Campo({ label, children }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

export default function InformeModal({ visible, tipo, turno, editar = false, onGuardar, onCerrar }) {
  const esVet = tipo === 'veterinaria';
  const [f, setF] = useState({});
  const [fotos, setFotos] = useState([]); // urls ya subidas
  const [subiendo, setSubiendo] = useState(false);
  const [aGaleria, setAGaleria] = useState(true);
  const [verFecha, setVerFecha] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    const i = turno?.informe ?? {};
    setF({
      motivo: i.motivo ?? turno?.notas ?? '',
      diagnostico: i.diagnostico ?? '',
      tratamiento: i.tratamiento ?? '',
      peso: i.peso != null ? String(i.peso).replace('.', ',') : (turno?.mascota?.peso ? String(turno.mascota.peso).replace('.', ',') : ''),
      temperatura: i.temperatura != null ? String(i.temperatura).replace('.', ',') : '',
      proximoControl: i.proximoControl ?? null,
      notas: i.notas ?? '',
    });
    setFotos(i.fotos ?? []);
    setError(null);
  }, [visible, turno]);

  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setError(null); };

  const agregarFoto = async (camara) => {
    const permiso = camara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      alerta('Sin permiso', `Habilitá el acceso a la ${camara ? 'cámara' : 'galería'} desde la configuración.`);
      return;
    }
    const opciones = { quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images };
    const res = camara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setSubiendo(true);
    try {
      const url = await subirImagenPublica(res.assets[0].uri, 'negocios');
      setFotos((x) => [...x, url].slice(0, FOTOS_MAX));
    } catch {
      setError('No se pudo subir la foto. Probá de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    const peso = f.peso ? parseDecimal(f.peso) : null;
    const temp = f.temperatura ? parseDecimal(f.temperatura) : null;
    if (esVet) {
      if (!f.diagnostico?.trim() && !f.tratamiento?.trim() && !f.notas?.trim()) {
        setError('Escribí al menos el diagnóstico o las indicaciones');
        return;
      }
      if (peso != null && !(peso > 0 && peso < 150)) { setError('Revisá el peso'); return; }
      if (temp != null && !(temp > 30 && temp < 45)) { setError('Revisá la temperatura (en °C)'); return; }
    }
    const informe = esVet
      ? {
        motivo: f.motivo?.trim() || null,
        diagnostico: f.diagnostico?.trim() || null,
        tratamiento: f.tratamiento?.trim() || null,
        peso, temperatura: temp,
        proximoControl: f.proximoControl ?? null,
        notas: f.notas?.trim() || null,
      }
      : { notas: f.notas?.trim() || null, fotos };
    setGuardando(true);
    try {
      await onGuardar(informe, { aGaleria: !esVet && aGaleria && fotos.length > 0 });
    } catch {
      setError('No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  if (!turno) return null;
  const tituloBoton = editar ? 'Guardar cambios' : esVet ? 'Guardar y marcar atendido' : 'Marcar como listo';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} style={s.cerrar} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={26} color={C.texto} />
          </TouchableOpacity>
          <Text style={s.titulo}>{esVet ? 'Informe de la consulta' : 'Trabajo terminado'}</Text>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.paciente}>
              <Avatar fuente={turno.mascota.visual} nombre={turno.mascota.nombre} size={52} borde />
              <View style={{ flex: 1 }}>
                <Text style={s.nombre}>{turno.mascota.nombre}</Text>
                <Text style={s.sub}>{turno.servicio} · {cuandoTexto(turno.fecha)}</Text>
                <Text style={s.sub}>{turno.dueno.nombre}</Text>
              </View>
            </View>

            {esVet ? (
              <>
                <Campo label="Motivo de la consulta">
                  <TextInput style={s.input} value={f.motivo} onChangeText={(v) => set('motivo', v)} maxLength={300}
                    placeholder="Ej: Vómitos desde ayer" placeholderTextColor={C.gris} />
                </Campo>
                <View style={s.fila}>
                  <View style={{ flex: 1 }}>
                    <Campo label="Peso (kg)">
                      <TextInput style={s.input} value={f.peso} keyboardType="decimal-pad" placeholder="Ej: 12,5"
                        placeholderTextColor={C.gris} onChangeText={(v) => set('peso', sanitizarDecimal(v))} />
                    </Campo>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Campo label="Temperatura (°C)">
                      <TextInput style={s.input} value={f.temperatura} keyboardType="decimal-pad" placeholder="Ej: 38,5"
                        placeholderTextColor={C.gris} onChangeText={(v) => set('temperatura', sanitizarDecimal(v))} />
                    </Campo>
                  </View>
                </View>
                <Campo label="Diagnóstico">
                  <TextInput style={[s.input, s.textarea]} value={f.diagnostico} multiline maxLength={1000}
                    onChangeText={(v) => set('diagnostico', v)} placeholderTextColor={C.gris}
                    placeholder="Ej: Gastroenteritis leve" />
                </Campo>
                <Campo label="Tratamiento e indicaciones">
                  <TextInput style={[s.input, s.textarea]} value={f.tratamiento} multiline maxLength={1000}
                    onChangeText={(v) => set('tratamiento', v)} placeholderTextColor={C.gris}
                    placeholder="Ej: Dieta blanda 3 días. Metoclopramida 1 comprimido cada 8 h." />
                </Campo>
                <Campo label="Próximo control">
                  <View style={s.fila}>
                    <TouchableOpacity style={[s.input, s.fechaBtn, { flex: 1 }]} onPress={() => setVerFecha(true)}>
                      <Ionicons name="calendar-outline" size={18} color={C.teal} />
                      <Text style={[s.fechaTxt, !f.proximoControl && { color: C.gris }]}>
                        {f.proximoControl ? fechaLarga(f.proximoControl) : 'Sin control programado'}
                      </Text>
                    </TouchableOpacity>
                    {f.proximoControl ? (
                      <TouchableOpacity style={s.quitar} onPress={() => set('proximoControl', null)} accessibilityLabel="Quitar control">
                        <Ionicons name="close-circle" size={22} color={C.gris} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </Campo>
                <Campo label="Notas internas (sólo las ves vos)">
                  <TextInput style={[s.input, s.textarea]} value={f.notas} multiline maxLength={1000}
                    onChangeText={(v) => set('notas', v)} placeholderTextColor={C.gris}
                    placeholder="Ej: Muy nervioso, manejar con bozal." />
                </Campo>
              </>
            ) : (
              <>
                <Campo label="Fotos de cómo quedó">
                  <View style={s.fotos}>
                    {fotos.map((u) => (
                      <View key={u} style={s.fotoWrap}>
                        <Image source={{ uri: u }} style={s.foto} />
                        <TouchableOpacity style={s.fotoQuitar} onPress={() => setFotos((x) => x.filter((y) => y !== u))}
                          accessibilityLabel="Quitar foto">
                          <Ionicons name="close" size={14} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {fotos.length < FOTOS_MAX && (
                      subiendo ? (
                        <View style={[s.foto, s.fotoAgregar]}><ActivityIndicator color={C.teal} /></View>
                      ) : (
                        <>
                          <TouchableOpacity style={[s.foto, s.fotoAgregar]} onPress={() => agregarFoto(true)} accessibilityLabel="Sacar foto">
                            <Ionicons name="camera" size={24} color={C.teal} />
                          </TouchableOpacity>
                          <TouchableOpacity style={[s.foto, s.fotoAgregar]} onPress={() => agregarFoto(false)} accessibilityLabel="Elegir foto">
                            <Ionicons name="images" size={24} color={C.teal} />
                          </TouchableOpacity>
                        </>
                      )
                    )}
                  </View>
                </Campo>
                {fotos.length > 0 && !editar && (
                  <TouchableOpacity style={s.toggle} onPress={() => setAGaleria((v) => !v)}
                    accessibilityRole="checkbox" accessibilityState={{ checked: aGaleria }}>
                    <Ionicons name={aGaleria ? 'checkbox' : 'square-outline'} size={20} color={aGaleria ? C.teal : C.gris} />
                    <Text style={s.toggleTxt}>Sumar a mis Trabajos (los ven los clientes)</Text>
                  </TouchableOpacity>
                )}
                <Campo label="Notas del trabajo">
                  <TextInput style={[s.input, s.textarea]} value={f.notas} multiline maxLength={1000}
                    onChangeText={(v) => set('notas', v)} placeholderTextColor={C.gris}
                    placeholder="Ej: Corte a tijera, largo 2 cm. Tenía nudos detrás de las orejas." />
                </Campo>
              </>
            )}

            {error ? <Text style={s.error}>{error}</Text> : null}
            <PillButton titulo={tituloBoton} onPress={guardar} cargando={guardando} disabled={subiendo} style={{ marginTop: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
        <FechaPicker
          visible={verFecha}
          titulo="Próximo control"
          valor={f.proximoControl ? new Date(f.proximoControl) : new Date(Date.now() + 14 * 86400000)}
          aniosAtras={0}
          aniosAdelante={2}
          onConfirmar={(d) => { set('proximoControl', d.toISOString()); setVerFecha(false); }}
          onCancelar={() => setVerFecha(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.fondo },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF',
    paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borde,
  },
  cerrar: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 19, fontWeight: '800', color: C.texto },
  scroll: { padding: 20, paddingBottom: 40 },
  paciente: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12 },
  nombre: { fontSize: 17, fontWeight: '900', color: C.texto },
  sub: { fontSize: 13, color: C.texto2, marginTop: 1 },
  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.texto, backgroundColor: '#FFFFFF',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  fila: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  fechaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fechaTxt: { fontSize: 15, color: C.texto, flex: 1 },
  quitar: { padding: 6 },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fotoWrap: { position: 'relative' },
  foto: { width: 78, height: 78, borderRadius: 12 },
  fotoAgregar: {
    borderWidth: 1.5, borderColor: C.teal, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  fotoQuitar: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, minHeight: 36 },
  toggleTxt: { flex: 1, fontSize: 14, fontWeight: '700', color: C.texto },
  error: { fontSize: 13, color: C.rojo, marginTop: 14, textAlign: 'center' },
});
