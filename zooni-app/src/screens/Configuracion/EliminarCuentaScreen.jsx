/**
 * EliminarCuentaScreen.jsx — Confirmación de eliminación de cuenta (§3.5.11)
 *
 * Pantalla dedicada, nunca un diálogo simple. Exige checkbox + contraseña.
 * Período de gracia de 30 días: la cuenta se marca pending_deletion y se
 * restaura sola si el usuario vuelve a iniciar sesión antes del vencimiento.
 */

import React, { useState } from 'react';
import {
  Alert, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { SettingsScreen, SettingsSelect, SettingsGroup, T } from '../../components/settings/SettingsKit';

const SE_PIERDE = [
  'Tu perfil',
  'Tus mascotas y sus fichas médicas',
  'Tus publicaciones',
  'Tus amigos y matches',
  'Tu historial de paseos',
  'Tu suscripción activa',
];

export default function EliminarCuentaScreen() {
  const navigation = useNavigation();
  const [motivo, setMotivo] = useState(null);
  const [motivoTexto, setMotivoTexto] = useState('');
  const [password, setPassword] = useState('');
  const [entiendo, setEntiendo] = useState(false);

  const puedeEliminar = entiendo && password.length >= 8;

  const fechaLimite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

  const confirmar = () => {
    Alert.alert(
      'Cuenta programada para eliminarse',
      `Tenés 30 días para arrepentirte: si volvés a entrar antes del ${fechaLimite}, recuperás todo.`,
      [{ text: 'Entendido', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) }]
    );
  };

  return (
    <SettingsScreen title="Eliminar mi cuenta">

      {/* Qué se pierde */}
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
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder="Tu contraseña"
            placeholderTextColor={T.textSoft}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>
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

      <TouchableOpacity
        style={[s.btnEliminar, !puedeEliminar && { opacity: 0.45 }]}
        disabled={!puedeEliminar}
        onPress={confirmar}
        accessibilityRole="button"
        accessibilityLabel="Eliminar mi cuenta"
        accessibilityState={{ disabled: !puedeEliminar }}
      >
        <Text style={s.btnEliminarTxt}>Eliminar mi cuenta</Text>
      </TouchableOpacity>

      <Text style={s.gracia}>
        Tenés 30 días para arrepentirte: si volvés a entrar antes del {fechaLimite}, recuperás todo.
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

  gracia: { fontSize: 13, color: T.textSoftMint, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
