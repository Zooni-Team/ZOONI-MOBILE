/**
 * AyudaSoporteScreen.jsx — Configuración › Ayuda y Soporte (§3.5.11)
 */

import React from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import {
  SettingsAction, SettingsGroup, SettingsRow, SettingsScreen, T,
} from '../../components/settings/SettingsKit';

const proximamente = () => Alert.alert('Próximamente', 'Esta opción va a estar disponible en una próxima versión.');

export default function AyudaSoporteScreen() {
  return (
    <SettingsScreen title="Ayuda y Soporte">

      <SettingsGroup>
        <SettingsRow label="Centro de ayuda" onPress={proximamente} />
        <SettingsRow label="Contactar a soporte"
          onPress={() => Alert.alert(
            'Contactar a soporte',
            'Adjuntamos datos de tu dispositivo para poder ayudarte más rápido.'
          )} />
        <SettingsRow label="Reportar un problema" onPress={proximamente} />
        <SettingsRow label="Reportar un usuario o contenido" onPress={proximamente} />
        <SettingsRow label="Sugerir una mejora" onPress={proximamente} />
      </SettingsGroup>

      <SettingsGroup label="Estado">
        {/* Estado del servicio con punto de color (§3.5.11) */}
        <View style={s.estadoRow}>
          <View style={[s.estadoPunto, { backgroundColor: T.brandText }]} />
          <Text style={s.estadoTxt}>Todo funcionando</Text>
        </View>
      </SettingsGroup>

      <SettingsGroup label="Zooni">
        <SettingsAction label="Calificar Zooni" onPress={proximamente} />
        <SettingsRow label="Instagram"
          onPress={() => Linking.openURL('https://instagram.com/zooni.app').catch(() => {})} />
        <SettingsRow label="TikTok"
          onPress={() => Linking.openURL('https://tiktok.com/@zooni.app').catch(() => {})} />
        <SettingsRow label="Sitio web"
          onPress={() => Linking.openURL('https://zooni.app').catch(() => {})} />
      </SettingsGroup>

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  estadoRow: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 10,
  },
  estadoPunto: { width: 10, height: 10, borderRadius: 5 },
  estadoTxt:   { fontSize: 16, fontWeight: '600', color: T.text },
});
