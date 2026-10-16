/**
 * ItemFormModal.jsx — Cargar o editar lo que ofrece un negocio
 *
 * El mismo formulario cambia según el tipo:
 *   · Veterinaria → servicio: nombre, categoría, precio, duración del turno
 *   · Peluquería  → servicio: nombre, categoría, precio por tamaño
 *                   (chico / mediano / grande) y duración
 *   · Pet shop    → producto: nombre, categoría, precio, stock y foto
 * Todos: descripción opcional y "Visible para los clientes".
 *
 * Props: visible · tipo · item (null = nuevo) · onGuardar(item) · onBorrar() · onCerrar
 */

import { useEffect, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { C, PillButton } from '../paseador/PaseadorUI';
import { TAMANOS, configNegocio } from '../../constants/negocios';
import { validarItem } from '../../services/negocioApi';
import { sanitizarDigitos } from '../../utils/sanitizar';
import { alerta, confirmar } from '../../utils/dialogo';

const DURACIONES = [15, 30, 45, 60, 90, 120];
const txt = (n) => (n == null || n === '' ? '' : String(Math.round(Number(n))));

export default function ItemFormModal({ visible, tipo, item, onGuardar, onBorrar, onCerrar }) {
  const cfg = configNegocio(tipo);
  const esProducto = cfg.clase === 'producto';
  const [f, setF] = useState({});
  const [conStock, setConStock] = useState(true);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setF({
      id: item?.id,
      nombre: item?.nombre ?? '',
      categoria: item?.categoria ?? cfg.categorias[0],
      precio: txt(item?.precio),
      precios: Object.fromEntries(TAMANOS.map((t) => [t.key, txt(item?.precios?.[t.key])])),
      duracionMin: txt(item?.duracionMin ?? (esProducto ? null : 30)),
      stock: txt(item?.stock),
      foto: item?.foto ?? null,
      descripcion: item?.descripcion ?? '',
      activo: item?.activo ?? true,
    });
    setConStock(item ? item.stock != null : true);
    setError(null);
  }, [visible, item]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setError(null); };

  const elegirFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      alerta('Sin permiso', 'Habilitá el acceso a la galería desde la configuración del dispositivo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1],
    });
    if (!res.canceled && res.assets?.[0]?.uri) set('foto', res.assets[0].uri);
  };

  const guardar = async () => {
    const datos = { ...f, stock: esProducto && conStock ? f.stock : null };
    if (esProducto && conStock && datos.stock === '') datos.stock = '0';
    const err = validarItem(datos, tipo);
    if (err) { setError(err); return; }
    setGuardando(true);
    try {
      await onGuardar(datos);
    } catch (e) {
      setError(e?.message === 'migracion_pendiente'
        ? 'Es necesario correr la migración 046 en Supabase.'
        : 'No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    const ok = await confirmar(`¿Borrar "${item.nombre}"?`,
      esProducto ? 'Deja de aparecer en tu catálogo.' : 'Los turnos ya pedidos no se pierden.',
      { textoOk: 'Borrar', destructivo: true });
    if (ok) onBorrar();
  };

  const titulo = item ? `Editar ${esProducto ? 'producto' : 'servicio'}` : `Nuevo ${esProducto ? 'producto' : 'servicio'}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCerrar} style={s.cerrar} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={26} color={C.texto} />
          </TouchableOpacity>
          <Text style={s.titulo}>{titulo}</Text>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {esProducto && (
              <TouchableOpacity style={s.foto} onPress={elegirFoto} accessibilityLabel="Elegir foto del producto">
                {f.foto
                  ? <Image source={{ uri: f.foto }} style={s.fotoImg} />
                  : (
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <Ionicons name="camera-outline" size={30} color={C.teal} />
                      <Text style={s.fotoTxt}>Foto (opcional)</Text>
                    </View>
                  )}
              </TouchableOpacity>
            )}

            <Text style={s.label}>Nombre</Text>
            <TextInput style={s.input} value={f.nombre} onChangeText={(v) => set('nombre', v.slice(0, 120))}
              placeholder={esProducto ? 'Ej: Alimento adulto 15 kg' : cfg.sugeridos[0]?.nombre ? `Ej: ${cfg.sugeridos[0].nombre}` : 'Nombre'}
              placeholderTextColor={C.gris} />

            <Text style={s.label}>Categoría</Text>
            <View style={s.chips}>
              {cfg.categorias.map((c) => {
                const on = f.categoria === c;
                return (
                  <TouchableOpacity key={c} style={[s.chip, on && s.chipOn]} onPress={() => set('categoria', c)}
                    accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <Text style={[s.chipTxt, on && { color: '#FFF' }]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {cfg.preciosPorTamano ? (
              <>
                <Text style={s.label}>Precio según el tamaño</Text>
                <View style={s.tamanos}>
                  {TAMANOS.map((t) => (
                    <View key={t.key} style={{ flex: 1 }}>
                      <Text style={s.tamano}>{t.label}</Text>
                      <Text style={s.tamanoDet}>{t.detalle}</Text>
                      <View style={s.montoBox}>
                        <Text style={s.signo}>$</Text>
                        <TextInput style={s.montoInput} value={f.precios?.[t.key] ?? ''} keyboardType="number-pad"
                          placeholder="—" placeholderTextColor={C.gris}
                          onChangeText={(v) => set('precios', { ...f.precios, [t.key]: sanitizarDigitos(v, 8) })} />
                      </View>
                    </View>
                  ))}
                </View>
                <Text style={s.ayuda}>Dejá vacío el tamaño que no atendés.</Text>
              </>
            ) : (
              <>
                <Text style={s.label}>Precio</Text>
                <View style={s.montoBox}>
                  <Text style={s.signo}>$</Text>
                  <TextInput style={s.montoInput} value={f.precio} keyboardType="number-pad" placeholder="0"
                    placeholderTextColor={C.gris} onChangeText={(v) => set('precio', sanitizarDigitos(v, 8))} />
                </View>
              </>
            )}

            {!esProducto && (
              <>
                <Text style={s.label}>Duración del turno</Text>
                <View style={s.chips}>
                  {DURACIONES.map((d) => {
                    const on = Number(f.duracionMin) === d;
                    return (
                      <TouchableOpacity key={d} style={[s.chip, on && s.chipOn]} onPress={() => set('duracionMin', String(d))}>
                        <Text style={[s.chipTxt, on && { color: '#FFF' }]}>{d} min</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={[s.montoBox, { marginTop: 8 }]}>
                  <TextInput style={s.montoInput} value={f.duracionMin} keyboardType="number-pad" placeholder="Otra"
                    placeholderTextColor={C.gris} onChangeText={(v) => set('duracionMin', sanitizarDigitos(v, 3))} />
                  <Text style={s.unidad}>minutos</Text>
                </View>
                <Text style={s.ayuda}>Con esto armamos los horarios libres que ven tus clientes.</Text>
              </>
            )}

            {esProducto && (
              <>
                <View style={s.stockFila}>
                  <Text style={[s.label, { marginTop: 0 }]}>Stock</Text>
                  <TouchableOpacity style={s.toggle} onPress={() => setConStock((v) => !v)}
                    accessibilityRole="switch" accessibilityState={{ checked: conStock }}>
                    <Ionicons name={conStock ? 'checkbox' : 'square-outline'} size={20} color={conStock ? C.teal : C.gris} />
                    <Text style={s.toggleTxt}>Llevar control de stock</Text>
                  </TouchableOpacity>
                </View>
                {conStock ? (
                  <View style={s.montoBox}>
                    <TextInput style={s.montoInput} value={f.stock} keyboardType="number-pad" placeholder="0"
                      placeholderTextColor={C.gris} onChangeText={(v) => set('stock', sanitizarDigitos(v, 5))} />
                    <Text style={s.unidad}>unidades</Text>
                  </View>
                ) : (
                  <Text style={s.ayuda}>Siempre figura disponible.</Text>
                )}
              </>
            )}

            <Text style={s.label}>Descripción (opcional)</Text>
            <TextInput style={[s.input, s.textarea]} value={f.descripcion} multiline maxLength={400}
              onChangeText={(v) => set('descripcion', v)} placeholderTextColor={C.gris}
              placeholder={esProducto ? 'Ej: Para perros adultos de razas medianas.' : 'Ej: Incluye revisión general y peso.'} />

            <TouchableOpacity style={[s.toggle, { marginTop: 16 }]} onPress={() => set('activo', !f.activo)}
              accessibilityRole="switch" accessibilityState={{ checked: f.activo }}>
              <Ionicons name={f.activo ? 'eye' : 'eye-off'} size={20} color={f.activo ? C.teal : C.gris} />
              <Text style={s.toggleTxt}>{f.activo ? 'Visible para los clientes' : 'Oculto (no se ofrece)'}</Text>
            </TouchableOpacity>

            {error ? <Text style={s.error}>{error}</Text> : null}
            <PillButton titulo="Guardar" onPress={guardar} cargando={guardando} style={{ marginTop: 20 }} />
            {item ? (
              <TouchableOpacity style={s.borrar} onPress={borrar}>
                <Ionicons name="trash-outline" size={16} color={C.rojo} />
                <Text style={s.borrarTxt}>Borrar</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
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

  foto: {
    alignSelf: 'center', width: 120, height: 120, borderRadius: 20, borderWidth: 2, borderColor: C.teal,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#FFFFFF',
  },
  fotoImg: { width: '100%', height: '100%' },
  fotoTxt: { fontSize: 12, fontWeight: '700', color: C.teal },

  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.texto, backgroundColor: '#FFFFFF',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 18, borderWidth: 1.5, borderColor: C.menta, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: C.teal, borderColor: C.teal },
  chipTxt: { fontSize: 13, fontWeight: '700', color: C.texto },

  tamanos: { flexDirection: 'row', gap: 8 },
  tamano: { fontSize: 13, fontWeight: '800', color: C.texto },
  tamanoDet: { fontSize: 11, color: C.texto2, marginBottom: 6 },
  montoBox: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12,
    paddingHorizontal: 12, backgroundColor: '#FFFFFF',
  },
  signo: { fontSize: 18, fontWeight: '900', color: C.texto, marginRight: 4 },
  montoInput: { flex: 1, fontSize: 18, fontWeight: '800', color: C.texto, paddingVertical: 10, minWidth: 0 },
  unidad: { fontSize: 13, color: C.texto2, fontWeight: '700' },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 6 },

  stockFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  toggleTxt: { fontSize: 14, fontWeight: '700', color: C.texto },
  error: { fontSize: 13, color: C.rojo, marginTop: 14, textAlign: 'center' },
  borrar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, minHeight: 40 },
  borrarTxt: { fontSize: 14, fontWeight: '800', color: C.rojo },
});
