/**
 * GaleriaTab.jsx — "Trabajos" de la peluquería
 *
 * Las fotos de cómo quedaron las mascotas: es lo que más convence a un dueño
 * de elegir una peluquería. Se ven en la ficha pública (NegocioPublico).
 *
 *   · Grilla de 3 columnas, la más nueva primero (hasta GALERIA_MAX).
 *   · "Subir foto": galería o cámara, con una nota opcional ("Corte de raza ·
 *     Caniche").
 *   · Tocar una la abre en grande, con su nota, fecha y "Borrar".
 *   · También se suman solas al terminar un turno si se marca "Sumar a
 *     Trabajos" en el informe (InformeModal).
 */

import { useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { C, Card, PillButton, Vacio } from '../../../components/paseador/PaseadorUI';
import { agregarFotoGaleria, borrarFotoGaleria, GALERIA_MAX } from '../../../services/negocioApi';
import { alerta, confirmar } from '../../../utils/dialogo';

const GAP = 8;
const PADDING = 20;
const LADO = Math.floor((Math.min(Dimensions.get('window').width, 520) - PADDING * 2 - GAP * 2) / 3);
const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

export default function GaleriaTab({ negocio, setNegocio, avisar }) {
  const fotos = negocio.datos?.galeria ?? [];
  const [nueva, setNueva] = useState(null); // uri elegida, antes de subirla
  const [nota, setNota] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [abierta, setAbierta] = useState(null); // foto
  const [borrando, setBorrando] = useState(false);

  const elegir = async (camara) => {
    if (fotos.length >= GALERIA_MAX) {
      alerta('Galería llena', `Podés tener hasta ${GALERIA_MAX} fotos. Borrá alguna vieja para sumar una nueva.`);
      return;
    }
    const permiso = camara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      alerta('Sin permiso', `Habilitá el acceso a la ${camara ? 'cámara' : 'galería'} desde la configuración del dispositivo.`);
      return;
    }
    const opciones = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] };
    const res = camara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setNota('');
    setNueva(res.assets[0].uri);
  };

  const subir = async () => {
    setSubiendo(true);
    try {
      setNegocio(await agregarFotoGaleria(negocio, nueva, nota));
      setNueva(null);
      avisar('Foto sumada a tus trabajos');
    } catch {
      avisar('No se pudo subir la foto. Probá de nuevo.', 'alert-circle');
    } finally {
      setSubiendo(false);
    }
  };

  const borrar = async () => {
    const ok = await confirmar('¿Borrar esta foto?', 'Deja de verse en tu ficha.', { textoOk: 'Borrar', destructivo: true });
    if (!ok) return;
    setBorrando(true);
    try {
      setNegocio(await borrarFotoGaleria(negocio, abierta.url));
      setAbierta(null);
      avisar('Foto borrada');
    } catch {
      avisar('No se pudo borrar. Probá de nuevo.', 'alert-circle');
    } finally {
      setBorrando(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={fotos}
        keyExtractor={(f) => f.url}
        numColumns={3}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={s.lista}
        ListHeaderComponent={(
          <>
            <Card style={s.intro}>
              <View style={s.introIcono}><Ionicons name="images" size={22} color="#9B59B6" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.introTitulo}>{fotos.length} de {GALERIA_MAX} fotos</Text>
                <Text style={s.introTxt}>Tus mejores trabajos se ven en tu ficha. Es lo que más ayuda a que te elijan.</Text>
              </View>
            </Card>
            <View style={s.botones}>
              <PillButton titulo="Subir foto" icono="image-outline" chico onPress={() => elegir(false)} style={{ flex: 1 }} />
              {Platform.OS !== 'web' ? (
                <PillButton titulo="Cámara" icono="camera-outline" variante="secundario" chico
                  onPress={() => elegir(true)} style={{ flex: 1 }} />
              ) : null}
            </View>
          </>
        )}
        ListEmptyComponent={(
          <Vacio icono="cut-outline" titulo="Todavía no subiste trabajos"
            texto="Subí fotos de cómo quedan las mascotas después del baño o el corte. También se suman solas al terminar un turno." />
        )}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setAbierta(item)} activeOpacity={0.85} style={{ marginBottom: GAP }}
            accessibilityRole="imagebutton" accessibilityLabel={item.nota || 'Foto de un trabajo'}>
            <Image source={{ uri: item.url }} style={s.miniatura} />
          </TouchableOpacity>
        )}
      />

      {/* Antes de subir: la foto y una nota */}
      <Modal visible={!!nueva} transparent animationType="fade" onRequestClose={() => !subiendo && setNueva(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={s.overlay} onPress={() => !subiendo && setNueva(null)}>
            <Pressable style={s.dialogo} onPress={() => {}}>
              <Text style={s.dialogoTitulo}>Nuevo trabajo</Text>
              {nueva ? <Image source={{ uri: nueva }} style={s.previa} /> : null}
              <TextInput style={s.input} value={nota} onChangeText={setNota} maxLength={80}
                placeholder="Nota (opcional): Corte de raza · Caniche" placeholderTextColor={C.gris} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <PillButton titulo="Cancelar" variante="secundario" chico disabled={subiendo}
                  onPress={() => setNueva(null)} style={{ flex: 1 }} />
                <PillButton titulo="Subir" icono="cloud-upload-outline" chico cargando={subiendo}
                  onPress={subir} style={{ flex: 1.3 }} />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Una foto en grande */}
      <Modal visible={!!abierta} transparent animationType="fade" onRequestClose={() => setAbierta(null)}>
        <View style={s.visor}>
          <TouchableOpacity style={s.visorCerrar} onPress={() => setAbierta(null)} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={30} color="#FFF" />
          </TouchableOpacity>
          {abierta ? <Image source={{ uri: abierta.url }} style={s.visorImg} resizeMode="contain" /> : null}
          <View style={s.visorPie}>
            <View style={{ flex: 1 }}>
              {abierta?.nota ? <Text style={s.visorNota}>{abierta.nota}</Text> : null}
              {abierta?.fecha ? <Text style={s.visorFecha}>{fechaCorta(abierta.fecha)}</Text> : null}
            </View>
            <TouchableOpacity style={s.visorBorrar} onPress={borrar} disabled={borrando} accessibilityLabel="Borrar foto">
              {borrando ? <ActivityIndicator color="#FFF" /> : <Ionicons name="trash-outline" size={20} color="#FFF" />}
              <Text style={s.visorBorrarTxt}>Borrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  lista: { padding: PADDING, paddingBottom: 40 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  introIcono: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F3E8F8', alignItems: 'center', justifyContent: 'center' },
  introTitulo: { fontSize: 16, fontWeight: '900', color: C.texto },
  introTxt: { fontSize: 13, color: C.texto2, marginTop: 2, lineHeight: 18 },
  botones: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 16 },
  miniatura: { width: LADO, height: LADO, borderRadius: 14, backgroundColor: C.menta },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  dialogo: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  dialogoTitulo: { fontSize: 18, fontWeight: '900', color: C.texto, marginBottom: 12 },
  previa: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: C.menta },
  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    marginTop: 12, fontSize: 15, color: C.texto,
  },

  visor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  visorCerrar: { position: 'absolute', top: 40, right: 20, zIndex: 2, padding: 6 },
  visorImg: { width: '100%', height: '70%' },
  visorPie: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20 },
  visorNota: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  visorFecha: { fontSize: 12, color: '#CCC', marginTop: 2 },
  visorBorrar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 20,
    backgroundColor: C.rojo,
  },
  visorBorrarTxt: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
