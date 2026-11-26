import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { SettingsScreen, SettingsSelect, SettingsGroup, T } from '../../components/settings/SettingsKit';
import { cuentaTieneContrasena, solicitarBajaDeCuenta } from '../../services/authApi';
import { clearToken } from '../../services/api';
import { clearCurrentUserId } from '../../config/session';
import { alerta } from '../../utils/dialogo';
import { formatearFecha } from '../../utils/fechaLocal';

const SE_PIERDE = [
  'Tu perfil',
  'Tus mascotas y sus fichas médicas',
  'Tus publicaciones',
  'Tus amigos y matches',
  'Tu historial de paseos',
  'Tu suscripción activa',
];

const MENSAJES_ERROR = {
  credenciales: 'La contraseña no es correcta.',
  sin_sesion: 'Tu sesión venció. Volvé a iniciar sesión e intentá de nuevo.',
  migracion_pendiente: 'A la base de datos le falta la migración 072 para poder dar de baja cuentas.',
};

export default function EliminarCuentaScreen() {
  const navigation = useNavigation();
  const [motivo, setMotivo] = useState(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [password, setPassword] = useState('');
  const [entiendo, setEntiendo] = useState(false);
  const [conContrasena, setConContrasena] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    cuentaTieneContrasena().then(setConContrasena).catch(() => setConContrasena(true));
  }, []);

  const pidePassword = conContrasena !== false;
  const puedeEliminar = entiendo && (!pidePassword || password.length > 0) && !enviando;

  const fechaLimite = formatearFecha(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  const confirmar = async () => {
    setError(null);
    setEnviando(true);
    try {
      const vence = await solicitarBajaDeCuenta({ password, motivo, motivoTexto: motivo === 'otro' ? motivoTexto : null });
      await clearToken();
      await clearCurrentUserId();
      alerta(
        'Cuenta programada para eliminarse',
        `Tenés hasta el ${formatearFecha(vence)} para arrepentirte: si volvés a iniciar sesión antes, recuperás todo.`,
      );
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      setError(MENSAJES_ERROR[e?.message] ?? 'No se pudo pedir la baja. Revisá tu internet e intentá de nuevo.');
      setEnviando(false);
    }
  };

  return (
    <SettingsScreen title="Eliminar mi cuenta">

      <View style={s.alertBox}>
        <Text style={s.alertTitulo}>Al eliminar tu cuenta perdés para siempre:</Text>
        {SE_PIERDE.map((item) => (
          <View key={item} style={s.alertItem}>
            <Ionicons name="close-circle" size={16} color={T.sosRedText} />
            <Text style={s.alertItemTxt}>{item}</Text>
          </View>
        ))}
        <Text style={s.alertSub}>
          Cancelá primero tu suscripción desde la tienda. Eliminar la cuenta no la cancela.
        </Text>
      </View>

      <SettingsGroup label="Contanos por qué (opcional)">
        <SettingsSelect
          label="Motivo"
          options={[
            { value: 'no_uso',      label: 'No la uso' },
            { value: 'otra_app',    label: 'Encontré otra app' },
            { value: 'privacidad',  label: 'Problemas de privacidad' },
            { value: 'otro',        label: 'Otro' },
          ]}
          value={motivo}
          onChange={setMotivo}
        />
        {motivo === 'otro' && (
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Contanos más…"
              placeholderTextColor={T.textSoft}
              value={motivoTexto}
              onChangeText={setMotivoTexto}
              multiline
            />
          </View>
        )}
      </SettingsGroup>

      <SettingsGroup label="Confirmación">
        {pidePassword && (
          <View style={s.inputWrap}>
            <TextInput
              style={s.input}
              placeholder="Tu contraseña"
              placeholderTextColor={T.textSoft}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
            />
          </View>
        )}
        <TouchableOpacity style={s.checkRow} onPress={() => setEntiendo((v) => !v)}
          accessibilityRole="checkbox" accessibilityState={{ checked: entiendo }}
          accessibilityLabel="Entiendo que esto no se puede deshacer">
          <Ionicons
            name={entiendo ? 'checkbox' : 'square-outline'}
            size={24}
            color={entiendo ? T.sosRedText : T.chevron}
          />
          <Text style={s.checkTxt}>Entiendo que esto no se puede deshacer.</Text>
        </TouchableOpacity>
      </SettingsGroup>

      {error && <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}

      <TouchableOpacity
        style={[s.btnEliminar, !puedeEliminar && { opacity: 0.45 }]}
        disabled={!puedeEliminar}
        onPress={confirmar}
        accessibilityRole="button"
        accessibilityLabel="Eliminar mi cuenta"
        accessibilityState={{ disabled: !puedeEliminar, busy: enviando }}
      >
        {enviando
          ? <ActivityIndicator color={T.sosRedText} />
          : <Text style={s.btnEliminarTxt}>Eliminar mi cuenta</Text>}
      </TouchableOpacity>

      <Text style={s.gracia}>
        Tenés 30 días para arrepentirte: si volvés a iniciar sesión antes del {fechaLimite}, recuperás todo.
        Mientras tanto, nadie ve tu perfil ni tus mascotas.
      </Text>

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  alertBox: {
    backgroundColor: T.sosRedTint, borderRadius: 18, padding: 16, marginTop: 16, gap: 8,
  },
  alertTitulo:  { fontSize: 15, fontWeight: '700', color: T.sosRedText },
  alertItem:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertItemTxt: { fontSize: 14, color: T.text, flex: 1 },
  alertSub:     { fontSize: 13, color: T.sosRedText, marginTop: 6, lineHeight: 18 },

  inputWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  input: {
    borderWidth: 1, borderColor: T.divider, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.text,
    minHeight: 46,
  },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14, minHeight: 48,
  },
  checkTxt: { fontSize: 14, color: T.text, flex: 1 },

  btnEliminar: {
    backgroundColor: T.surface, borderWidth: 2, borderColor: T.sosRedText,
    borderRadius: 30, height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 24,
  },
  btnEliminarTxt: { fontSize: 16, fontWeight: '700', color: T.sosRedText },

  error: { fontSize: 14, color: T.sosRedText, textAlign: 'center', marginTop: 16, lineHeight: 20 },

  gracia: { fontSize: 13, color: T.textSoftMint, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
