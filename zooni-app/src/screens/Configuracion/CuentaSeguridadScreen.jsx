/**
 * CuentaSeguridadScreen.jsx — Configuración › Cuenta y Seguridad (§3.5.1)
 *
 * Conectada a la tabla "User" real (perfilApi): carga y edita nombre, usuario,
 * bio, foto, email y teléfono del usuario logueado. La contraseña se cambia
 * en su propia pantalla (verifica la actual contra el servidor).
 *
 * Lo que NO existe como infraestructura hoy (2FA real, tracking de sesiones
 * por dispositivo, login con Google/Apple) NO se muestra con datos inventados:
 * se omite hasta que haya backend. Ver nota al pie del archivo.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import {
  SettingsAction, SettingsGroup, SettingsRow, SettingsScreen, T,
} from '../../components/settings/SettingsKit';
import AppDialog from '../../components/AppDialog';
import {
  actualizarBio, actualizarEmail, actualizarMiFotoPerfil, actualizarNombreApellido,
  actualizarNombreUsuario, actualizarTelefono, fechaProximoCambioUsuario, fetchMiCuenta,
} from '../../services/perfilApi';
import { clearToken } from '../../services/api';
import { clearCurrentUserId } from '../../config/session';
import { alerta } from '../../utils/dialogo';

// ─── MODAL DE EDICIÓN DE UN CAMPO (uno o dos inputs) ─────────────────────────

function EditModal({ visible, titulo, campos, onGuardar, onCerrar }) {
  const [valores, setValores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Reset al abrir con los valores iniciales de cada campo
  React.useEffect(() => {
    if (visible) {
      const init = {};
      campos.forEach((c) => { init[c.key] = c.valor ?? ''; });
      setValores(init);
      setError(null);
    }
  }, [visible, campos]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(valores);
      setGuardando(false);
      onCerrar();
    } catch (e) {
      setGuardando(false);
      setError(e?.mensaje ?? 'No pudimos guardar. Probá de nuevo.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable style={m.scrim} onPress={onCerrar}>
        <Pressable style={m.card} onPress={() => {}}>
          <Text style={m.titulo}>{titulo}</Text>
          {campos.map((c) => (
            <View key={c.key} style={{ marginBottom: 12 }}>
              {c.label ? <Text style={m.label}>{c.label}</Text> : null}
              <TextInput
                style={m.input}
                value={String(valores[c.key] ?? '')}
                onChangeText={(v) => setValores((prev) => ({ ...prev, [c.key]: v }))}
                placeholder={c.placeholder}
                placeholderTextColor={T.textSoft}
                keyboardType={c.keyboardType ?? 'default'}
                autoCapitalize={c.autoCapitalize ?? 'sentences'}
                maxLength={c.maxLength}
                multiline={c.multiline}
                autoFocus={campos.length === 1 || c.key === campos[0].key}
              />
            </View>
          ))}
          {error && <Text style={m.error}>{error}</Text>}
          <View style={m.acciones}>
            <TouchableOpacity onPress={onCerrar} style={m.btnCancelar}>
              <Text style={m.btnCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={guardar} style={m.btnGuardar} disabled={guardando}>
              {guardando
                ? <ActivityIndicator size="small" color={T.text} />
                : <Text style={m.btnGuardarTxt}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── PANTALLA ────────────────────────────────────────────────────────────────

export default function CuentaSeguridadScreen() {
  const navigation = useNavigation();
  const [cuenta, setCuenta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);   // editor de campo { titulo, campos, onGuardar }
  const [dialogo, setDialogo] = useState(null); // cartel Zooni { titulo, mensaje, botones }

  const cargar = useCallback(async () => {
    try {
      const data = await fetchMiCuenta();
      setCuenta(data);
    } catch {
      setCuenta(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const refrescar = () => cargar();

  // ── Foto de perfil: sube la imagen elegida (cámara o galería) ──
  const tomarFoto = async (desdeGaleria) => {
    try {
      const res = desdeGaleria
        ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 })
        : await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      await actualizarMiFotoPerfil(res.assets[0].uri);
      refrescar();
    } catch {
      alerta('No pudimos actualizar la foto', 'Revisá los permisos y tu conexión.');
    }
  };

  // Cartel Zooni con las opciones de origen de la foto
  const cambiarFoto = () => setDialogo({
    titulo: 'Foto de perfil',
    mensaje: '¿De dónde querés tomar la foto?',
    botones: [
      { texto: 'Sacar una foto', estilo: 'primary', onPress: () => tomarFoto(false) },
      { texto: 'Elegir de la galería', estilo: 'secondary', onPress: () => tomarFoto(true) },
      { texto: 'Cancelar', estilo: 'ghost' },
    ],
  });

  const iniciales = ((cuenta?.nombre?.[0] ?? '') + (cuenta?.apellido?.[0] ?? '')).toUpperCase() || '?';
  const nombreCompleto = [cuenta?.nombre, cuenta?.apellido].filter(Boolean).join(' ') || 'Sin nombre';
  const usuario = cuenta?.nombreUsuario ? `@${cuenta.nombreUsuario}` : 'Sin usuario';

  // Si cambió el @usuario hace menos de 30 días, hasta cuándo queda bloqueado
  const bloqueadoHasta = fechaProximoCambioUsuario(cuenta?.nombreUsuarioCambiadoEn);
  const fmtFecha = (d) => d?.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const telefonoTxt = cuenta?.telefono
    ? `${cuenta.codigoTelefono ? cuenta.codigoTelefono + ' ' : ''}${cuenta.telefono}`
    : 'Agregar';

  if (cargando) {
    return (
      <SettingsScreen title="Cuenta y Seguridad">
        <ActivityIndicator size="large" color={T.brand} style={{ marginTop: 40 }} />
      </SettingsScreen>
    );
  }

  if (!cuenta) {
    return (
      <SettingsScreen title="Cuenta y Seguridad">
        <View style={{ marginTop: 40, alignItems: 'center', gap: 12, paddingHorizontal: 24 }}>
          <Ionicons name="cloud-offline-outline" size={40} color={T.textSoft} />
          <Text style={{ color: T.textSoft, textAlign: 'center' }}>
            No pudimos cargar tu cuenta. Revisá tu conexión con Supabase y volvé a intentar.
          </Text>
          <TouchableOpacity onPress={cargar} style={s.reintentar}>
            <Text style={s.reintentarTxt}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen title="Cuenta y Seguridad">

      <SettingsGroup label="Tu perfil">
        {/* Cabecera: foto real + nombre + @usuario → editar en Perfil */}
        <TouchableOpacity style={s.perfilHeader} onPress={() => navigation.navigate('Perfil')}
          accessibilityRole="button" accessibilityLabel="Ver mi perfil, botón">
          {cuenta.fotoPerfil ? (
            <Image source={{ uri: cuenta.fotoPerfil }} style={s.avatarImg} />
          ) : (
            <View style={s.avatar}><Text style={s.avatarTxt}>{iniciales}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.perfilNombre} numberOfLines={1}>{nombreCompleto}</Text>
            <Text style={s.perfilUsuario} numberOfLines={1}>{usuario}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={T.chevron} />
        </TouchableOpacity>

        <SettingsRow label="Nombre y apellido" value={nombreCompleto}
          onPress={() => setModal({
            titulo: 'Nombre y apellido',
            campos: [
              { key: 'nombre', label: 'Nombre', valor: cuenta.nombre, maxLength: 100, autoCapitalize: 'words' },
              { key: 'apellido', label: 'Apellido', valor: cuenta.apellido, maxLength: 100, autoCapitalize: 'words' },
            ],
            onGuardar: async ({ nombre, apellido }) => {
              if (!nombre?.trim()) { const e = new Error(''); e.mensaje = 'El nombre no puede quedar vacío.'; throw e; }
              await actualizarNombreApellido(nombre, apellido);
              refrescar();
            },
          })} />

        <SettingsRow label="Nombre de usuario" value={usuario}
          onPress={() => {
            // Bloqueado por 30 días: no abre el editor, avisa hasta cuándo
            if (bloqueadoHasta) {
              setDialogo({
                titulo: 'No podés cambiar tu usuario todavía',
                mensaje: `Cambiaste tu nombre de usuario hace poco. Vas a poder cambiarlo de nuevo el ${fmtFecha(bloqueadoHasta)}.`,
                botones: [{ texto: 'Entendido', estilo: 'primary' }],
              });
              return;
            }
            setModal({
              titulo: 'Nombre de usuario',
              campos: [{ key: 'nombreUsuario',
                label: 'Letras, números, punto, guion y guion bajo. Una vez que lo cambies, no vas a poder volver a cambiarlo por 30 días.',
                valor: cuenta.nombreUsuario ?? '',
                maxLength: 30, autoCapitalize: 'none', placeholder: 'tu.usuario' }],
              onGuardar: async ({ nombreUsuario }) => {
                try {
                  await actualizarNombreUsuario(nombreUsuario);
                  refrescar();
                } catch (e) {
                  if (e.code === 'USERNAME_TAKEN') e.mensaje = 'Ese nombre de usuario ya está en uso.';
                  else if (e.code === 'USERNAME_CORTO') e.mensaje = 'El usuario tiene que tener entre 3 y 30 caracteres.';
                  else if (e.code === 'USERNAME_FORMATO') e.mensaje = 'Solo se permiten letras, números, punto, guion y guion bajo.';
                  else if (e.code === 'USERNAME_BLOQUEADO') e.mensaje = `Vas a poder cambiarlo de nuevo el ${fmtFecha(e.fecha)}.`;
                  throw e;
                }
              },
            });
          }} />

        <SettingsAction label="Cambiar foto de perfil" onPress={cambiarFoto} />

        <SettingsRow label="Biografía" value={cuenta.bio ? undefined : 'Agregar'}
          onPress={() => setModal({
            titulo: 'Biografía',
            campos: [{ key: 'bio', valor: cuenta.bio ?? '', maxLength: 150, multiline: true,
              placeholder: 'Contá algo sobre vos…' }],
            onGuardar: async ({ bio }) => { await actualizarBio(bio); refrescar(); },
          })} />
      </SettingsGroup>

      <SettingsGroup label="Datos de acceso">
        <SettingsRow label="Correo electrónico" value={cuenta.email ?? 'Agregar'}
          onPress={() => setModal({
            titulo: 'Correo electrónico',
            campos: [{ key: 'email', valor: cuenta.email ?? '', maxLength: 120,
              autoCapitalize: 'none', keyboardType: 'email-address', placeholder: 'nombre@mail.com' }],
            onGuardar: async ({ email }) => {
              try {
                await actualizarEmail(email);
                refrescar();
              } catch (e) {
                if (e.code === 'EMAIL_INVALIDO') e.mensaje = 'Ese correo no tiene un formato válido.';
                else if (e.code === 'EMAIL_EXISTENTE') e.mensaje = 'Ya hay una cuenta con ese correo.';
                throw e;
              }
            },
          })} />

        <SettingsRow label="Teléfono" value={telefonoTxt}
          onPress={() => setModal({
            titulo: 'Teléfono',
            campos: [
              { key: 'codigoTelefono', label: 'Código', valor: cuenta.codigoTelefono ?? '', maxLength: 10, placeholder: '+54' },
              { key: 'telefono', label: 'Número', valor: cuenta.telefono ?? '', maxLength: 20, keyboardType: 'phone-pad', placeholder: '1122334455' },
            ],
            onGuardar: async ({ codigoTelefono, telefono }) => {
              await actualizarTelefono(codigoTelefono, telefono);
              refrescar();
            },
          })} />

        <SettingsRow label="Cambiar contraseña"
          onPress={() => navigation.navigate('ConfigCambiarContrasena')} />
      </SettingsGroup>

      <SettingsGroup label="Sesión">
        <SettingsAction label="Cerrar sesión" destructive
          onPress={() => setDialogo({
            titulo: '¿Cerrar sesión?',
            mensaje: 'Vas a tener que volver a iniciar sesión para usar Zooni.',
            botones: [
              {
                texto: 'Cerrar sesión', estilo: 'destructive',
                onPress: async () => {
                  await clearToken();
                  await clearCurrentUserId();
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                },
              },
              { texto: 'Cancelar', estilo: 'ghost' },
            ],
          })} />
      </SettingsGroup>

      {modal && (
        <EditModal
          visible={!!modal}
          titulo={modal.titulo}
          campos={modal.campos}
          onGuardar={modal.onGuardar}
          onCerrar={() => setModal(null)}
        />
      )}

      <AppDialog
        visible={!!dialogo}
        titulo={dialogo?.titulo}
        mensaje={dialogo?.mensaje}
        botones={dialogo?.botones ?? []}
        onCerrar={() => setDialogo(null)}
      />

    </SettingsScreen>
  );
}

// Nota: la verificación en dos pasos, el listado de sesiones activas por
// dispositivo y las cuentas vinculadas (Google/Apple) requieren Supabase Auth
// / OAuth, que todavía no están integrados. Se omiten a propósito en vez de
// mostrar datos inventados; se agregan cuando exista ese backend.

const s = StyleSheet.create({
  perfilHeader: {
    height: 88, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 12,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: T.brand,
    backgroundColor: T.bgMain, alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: T.brand },
  avatarTxt:     { fontSize: 24, fontWeight: '800', color: T.brandText },
  perfilNombre:  { fontSize: 17, fontWeight: '700', color: T.text },
  perfilUsuario: { fontSize: 14, color: T.textSoft, marginTop: 2 },

  reintentar: { backgroundColor: T.cta, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  reintentarTxt: { fontSize: 15, fontWeight: '700', color: T.text },
});

const m = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 20 },
  titulo: { fontSize: 17, fontWeight: '800', color: T.text, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: T.textSoft, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: T.divider, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.text, minHeight: 46,
  },
  error: { fontSize: 13, color: T.sosRedText, marginBottom: 8 },
  acciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  btnCancelar: { paddingHorizontal: 18, paddingVertical: 12 },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: T.textSoft },
  btnGuardar: {
    backgroundColor: T.cta, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12,
    minWidth: 96, alignItems: 'center',
  },
  btnGuardarTxt: { fontSize: 15, fontWeight: '700', color: T.text },
});
