/**
 * CuentaSeguridadScreen.jsx — Configuración › Cuenta y Seguridad (§3.5.1)
 */

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import {
  SettingsAction, SettingsGroup, SettingsRow,
  SettingsScreen, SettingsToggle, T,
} from '../../components/settings/SettingsKit';

const proximamente = () => Alert.alert('Próximamente', 'Esta opción va a estar disponible en una próxima versión.');

export default function CuentaSeguridadScreen() {
  const navigation = useNavigation();
  const [dosFactores, setDosFactores] = useState(false);

  return (
    <SettingsScreen title="Cuenta y Seguridad">

      <SettingsGroup label="Tu perfil">
        {/* Fila de cabecera especial de 88px con avatar (§3.5.1) */}
        <TouchableOpacity style={s.perfilHeader} onPress={() => navigation.navigate('Perfil')}
          accessibilityRole="button" accessibilityLabel="Editar perfil, botón">
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>N</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.perfilNombre}>Nacho Eskenazi</Text>
            <Text style={s.perfilUsuario}>@nacho</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={T.chevron} />
        </TouchableOpacity>
        <SettingsRow label="Nombre y apellido" value="Nacho Eskenazi" onPress={proximamente} />
        <SettingsRow label="Nombre de usuario" value="@nacho" onPress={proximamente} />
        <SettingsAction label="Foto de perfil" onPress={proximamente} />
        <SettingsRow label="Biografía" onPress={proximamente} />
      </SettingsGroup>

      <SettingsGroup label="Datos de acceso">
        <SettingsRow label="Correo electrónico" value="nacho@zooni.app" badge
          onPress={() => Alert.alert('Sin verificar', 'Tocá para reenviar el correo de verificación.')} />
        <SettingsRow label="Teléfono" value="+54 11 ····" onPress={proximamente} />
        <SettingsRow label="Cambiar contraseña" onPress={() => navigation.navigate('ConfigCambiarContrasena')} />
        <SettingsRow label="Cuentas vinculadas" value="Google" onPress={proximamente} />
      </SettingsGroup>

      <SettingsGroup label="Seguridad">
        <SettingsToggle
          label="Verificación en dos pasos"
          apoyo="Pedimos un código además de tu contraseña cuando inicies sesión en un dispositivo nuevo."
          value={dosFactores}
          onChange={setDosFactores}
        />
        <SettingsRow label="Sesiones activas" value="4 dispositivos"
          onPress={() => navigation.navigate('ConfigSesiones')} />
        <SettingsAction label="Cerrar sesión en todos los dispositivos" destructive
          onPress={() =>
            Alert.alert(
              '¿Cerrar sesión en todos los dispositivos?',
              'Vas a tener que volver a iniciar sesión en cada uno.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Cerrar sesiones', style: 'destructive' },
              ]
            )
          } />
      </SettingsGroup>

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  perfilHeader: {
    height: 88, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 12,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: T.brand,
    backgroundColor: T.bgMain, alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt:     { fontSize: 24, fontWeight: '800', color: T.brandText },
  perfilNombre:  { fontSize: 17, fontWeight: '700', color: T.text },
  perfilUsuario: { fontSize: 14, color: T.textSoft, marginTop: 2 },
});
