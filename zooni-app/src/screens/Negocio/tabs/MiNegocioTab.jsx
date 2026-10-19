/**
 * MiNegocioTab.jsx — "Mi negocio": todo lo que el cliente ve en la ficha
 *
 *   · Cabecera: logo (tocar para cambiarlo), nombre, tipo y cómo se ve la
 *     ficha ("Ver como cliente").
 *   · Qué tan completa está la ficha, con lo que falta.
 *   · Datos del local: nombre, descripción, teléfono, dirección y el punto en
 *     el mapa (se copian al pin de Comunidad).
 *   · Horarios de atención: con ellos se arman los turnos libres y el
 *     "Abierto ahora".
 *   · Lo propio del tipo (DatosTipoNegocio): matrícula y urgencias en
 *     veterinarias, tamaños y busca y lleva en peluquerías, envíos y medios
 *     de pago en pet shops.
 *
 * Un solo "Guardar cambios" abajo, que aparece cuando hay algo para guardar.
 */

import { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { C, Card, PillButton, Seccion, sombra } from '../../../components/paseador/PaseadorUI';
import ZonaMapaPicker from '../../../components/paseador/ZonaMapaPicker';
import HorariosEditor, { validarHorarios } from '../../../components/negocio/HorariosEditor';
import {
  Campo, DatosTipoNegocio, InputTexto, datosInicialesNegocio, datosNegocioParaGuardar, useDatosNegocio,
  validarDatosNegocio,
} from '../../../components/negocio/CamposNegocio';
import {
  actualizarNegocio, resumenHorarios, subirLogoNegocio,
} from '../../../services/negocioApi';
import { sanitizarDigitos } from '../../../utils/sanitizar';
import { alerta } from '../../../utils/dialogo';

function localDe(n) {
  return {
    nombre: n.nombre ?? '',
    descripcion: n.descripcion ?? '',
    telefono: n.telefono ?? '',
    direccion: n.direccion ?? '',
    barrio: n.barrio ?? '',
    lat: n.lat,
    lng: n.lng,
    horarios: n.horarios,
  };
}

export default function MiNegocioTab({ negocio, setNegocio, tipo, cfg, avisar, navigation }) {
  const [local, setLocal] = useState(() => localDe(negocio));
  const tipoForm = useDatosNegocio(tipo, negocio.datos);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  const setL = (k, v) => {
    setLocal((p) => ({ ...p, [k]: v }));
    setErrores((e) => ({ ...e, [k]: null }));
  };

  // ¿Hay algo distinto a lo guardado? Se compara contra una "foto" del formulario
  const fotoDe = (n) => JSON.stringify([localDe(n), datosInicialesNegocio(tipo, n.datos)]);
  const [base, setBase] = useState(() => fotoDe(negocio));
  const hayCambios = JSON.stringify([local, tipoForm.datos]) !== base;

  // Qué le falta a la ficha para estar completa
  const pendientes = [
    !negocio.logo && 'Subí tu logo o una foto del local',
    (local.descripcion ?? '').trim().length <= 10 && 'Contá qué hacen en la descripción',
    !local.telefono && 'Agregá un teléfono de contacto',
    tipo === 'peluqueria' && !(negocio.datos?.galeria?.length) && 'Subí fotos de tus trabajos',
  ].filter(Boolean);
  const total = tipo === 'peluqueria' ? 4 : 3;

  const cambiarLogo = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      alerta('Sin permiso', 'Habilitá el acceso a la galería desde la configuración del dispositivo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setSubiendoLogo(true);
    try {
      setNegocio(await subirLogoNegocio(negocio, res.assets[0].uri));
      avisar('Logo actualizado');
    } catch {
      avisar('No se pudo subir el logo. Probá de nuevo.', 'alert-circle');
    } finally {
      setSubiendoLogo(false);
    }
  };

  const guardar = async () => {
    const e = {};
    if (local.nombre.trim().length < 2) e.nombre = `Es necesario el nombre de tu ${cfg.label.toLowerCase()}`;
    if (local.direccion.trim().length < 5) e.direccion = 'Es necesaria la dirección (calle y número)';
    if (local.lat == null) e.ubicacion = 'Es necesario marcar tu local en el mapa';
    const errHorarios = validarHorarios(local.horarios);
    if (errHorarios) e.horarios = errHorarios;
    const eTipo = validarDatosNegocio(tipo, tipoForm.datos);
    setErrores(e);
    tipoForm.setErrores(eTipo);
    if (Object.keys(e).length || Object.keys(eTipo).length) {
      avisar('Revisá los campos marcados en rojo', 'alert-circle');
      return;
    }

    setGuardando(true);
    try {
      const nuevo = await actualizarNegocio(negocio, {
        nombre: local.nombre.trim(),
        descripcion: local.descripcion.trim(),
        telefono: local.telefono,
        direccion: local.direccion.trim(),
        barrio: local.barrio,
        lat: local.lat,
        lng: local.lng,
        horarios: local.horarios,
        // Se mezcla con lo guardado: la galería y lo que no está en el formulario no se pisa
        datos: { ...(negocio.datos ?? {}), ...datosNegocioParaGuardar(tipo, tipoForm.datos) },
      });
      setNegocio(nuevo);
      // Lo guardado (ya recortado) pasa a ser la nueva referencia de "sin cambios"
      const guardado = localDe(nuevo);
      setLocal(guardado);
      setBase(JSON.stringify([guardado, tipoForm.datos]));
      avisar('Cambios guardados');
    } catch {
      avisar('No se pudieron guardar los cambios. Probá de nuevo.', 'alert-circle');
    } finally {
      setGuardando(false);
    }
  };

  const descartar = () => {
    setLocal(localDe(negocio));
    tipoForm.reiniciar(negocio.datos);
    setErrores({});
    setBase(fotoDe(negocio));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Cabecera */}
        <Card style={s.cabecera}>
          <TouchableOpacity style={s.logo} onPress={cambiarLogo} disabled={subiendoLogo}
            accessibilityRole="button" accessibilityLabel="Cambiar logo">
            {subiendoLogo ? <ActivityIndicator color={C.teal} />
              : negocio.logo ? <Image source={{ uri: negocio.logo }} style={s.logoImg} />
                : <Ionicons name={cfg.icono} size={34} color={cfg.color} />}
            <View style={s.logoEditar}><Ionicons name="camera" size={14} color="#FFF" /></View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.nombre} numberOfLines={2}>{negocio.nombre}</Text>
            <View style={[s.tipoChip, { backgroundColor: cfg.fondoIcono }]}>
              <Ionicons name={cfg.icono} size={12} color={cfg.color} />
              <Text style={[s.tipoChipTxt, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={s.horarios} numberOfLines={2}>{resumenHorarios(negocio.horarios)}</Text>
          </View>
        </Card>
        <PillButton titulo="Ver mi ficha como cliente" icono="eye-outline" variante="secundario" chico
          style={{ marginTop: 12 }}
          onPress={() => navigation.navigate('NegocioPublico', { idNegocio: negocio.id, vistaPrevia: true })} />

        {pendientes.length > 0 && (
          <Card style={s.completa}>
            <Text style={s.completaTitulo}>Tu ficha está al {Math.round(((total - pendientes.length) / total) * 100)}%</Text>
            <View style={s.barra}><View style={[s.barraFill, { width: `${((total - pendientes.length) / total) * 100}%` }]} /></View>
            {pendientes.map((p) => (
              <View key={p} style={s.pendiente}>
                <Ionicons name="ellipse-outline" size={14} color={C.ambar} />
                <Text style={s.pendienteTxt}>{p}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Datos del local */}
        <Seccion titulo="Datos del local" />
        <Card>
          <Campo label={`Nombre de tu ${cfg.label.toLowerCase()}`} error={errores.nombre}>
            <InputTexto value={local.nombre} error={errores.nombre} placeholder={cfg.placeholderNombre}
              onChangeText={(v) => setL('nombre', v.slice(0, 150))} />
          </Campo>
          <Campo label="Descripción" ayuda="Lo primero que leen tus clientes en tu ficha.">
            <InputTexto value={local.descripcion} multiline maxLength={600} style={s.textarea}
              placeholder={cfg.placeholderDescripcion} onChangeText={(v) => setL('descripcion', v)} />
          </Campo>
          <Campo label="Teléfono del local">
            <InputTexto value={local.telefono} keyboardType="phone-pad" placeholder="11 2345 6789"
              onChangeText={(v) => setL('telefono', sanitizarDigitos(v, 15))} />
          </Campo>
          <Campo label="Dirección" error={errores.direccion}>
            <InputTexto value={local.direccion} error={errores.direccion} placeholder="Ej: Av. Díaz Vélez 3820"
              onChangeText={(v) => setL('direccion', v.slice(0, 300))} />
          </Campo>
          <ZonaMapaPicker
            conRadio={false}
            valor={{ lat: local.lat, lng: local.lng, radioKm: null, zona: local.barrio }}
            onCambio={(z) => {
              setLocal((p) => ({ ...p, lat: z.lat, lng: z.lng, barrio: z.zona ?? p.barrio }));
              setErrores((e) => ({ ...e, ubicacion: null }));
            }}
          />
          {errores.ubicacion ? <Text style={s.error}>{errores.ubicacion}</Text> : null}
        </Card>

        {/* Horarios */}
        <Seccion titulo="Horarios de atención" />
        <Card>
          <Text style={s.ayuda}>
            {cfg.usaTurnos
              ? 'Con estos horarios armamos los turnos libres que ven tus clientes.'
              : 'Tus clientes ven si estás abierto ahora y hasta qué hora tomás pedidos.'}
          </Text>
          <View style={{ height: 8 }} />
          <HorariosEditor valor={local.horarios} error={errores.horarios}
            onCambio={(h) => setL('horarios', h)} />
        </Card>

        {/* Lo propio del tipo */}
        <Seccion titulo={tipo === 'veterinaria' ? 'Tu práctica' : tipo === 'peluqueria' ? 'A quiénes atendés' : 'Ventas y envíos'} />
        <DatosTipoNegocio tipo={tipo} datos={tipoForm.datos} onCambio={tipoForm.cambiar} errores={tipoForm.errores} />

        <View style={{ height: hayCambios ? 110 : 30 }} />
      </ScrollView>

      {hayCambios && (
        <View style={s.barraGuardar}>
          <PillButton titulo="Descartar" variante="secundario" chico onPress={descartar} disabled={guardando} style={{ flex: 1 }} />
          <PillButton titulo="Guardar cambios" icono="checkmark" chico cargando={guardando} onPress={guardar} style={{ flex: 1.6 }} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 20 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logo: {
    width: 84, height: 84, borderRadius: 22, borderWidth: 2, borderColor: C.teal,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.fondo,
  },
  logoImg: { width: '100%', height: '100%', borderRadius: 20 },
  logoEditar: {
    position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF',
  },
  nombre: { fontSize: 20, fontWeight: '900', color: C.texto },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, marginTop: 4,
  },
  tipoChipTxt: { fontSize: 12, fontWeight: '800' },
  horarios: { fontSize: 12, color: C.texto2, marginTop: 6, lineHeight: 16 },

  completa: { marginTop: 14, backgroundColor: '#FFFBF0', borderWidth: 1.5, borderColor: '#FCE7B2' },
  completaTitulo: { fontSize: 15, fontWeight: '900', color: C.texto },
  barra: { height: 8, borderRadius: 4, backgroundColor: '#F4E7C5', marginTop: 8, marginBottom: 6, overflow: 'hidden' },
  barraFill: { height: 8, borderRadius: 4, backgroundColor: C.ambar },
  pendiente: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  pendienteTxt: { flex: 1, fontSize: 13, color: C.texto },

  textarea: { minHeight: 90, textAlignVertical: 'top' },
  ayuda: { fontSize: 12, color: C.texto2 },
  error: { fontSize: 12, color: C.rojo, marginTop: 6 },

  barraGuardar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10,
    padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: C.borde, ...sombra,
  },
});
