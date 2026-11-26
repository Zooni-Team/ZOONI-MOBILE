/**
 * AyudaSoporteScreen.jsx — Configuración › Ayuda y Soporte (§3.5.11)
 *
 * Todavía no hay centro de ayuda ni canal de soporte: la pantalla va con el
 * aviso de vista previa. Reportar o bloquear a una persona sí funciona, desde
 * el chat con ella (MatchInfoModal → moderacionApi).
 */

import React from 'react';
import { Linking } from 'react-native';

import {
  SettingsAction, SettingsGroup, SettingsRow, SettingsScreen, SettingsVistaPrevia,
} from '../../components/settings/SettingsKit';
import { alerta } from '../../utils/dialogo';

const proximamente = () => alerta('Próximamente', 'Esta opción va a estar disponible en una próxima versión.');

export default function AyudaSoporteScreen() {
  return (
    <SettingsScreen title="Ayuda y Soporte">

      <SettingsVistaPrevia texto="El centro de ayuda y el contacto con soporte todavía no están disponibles. Para reportar o bloquear a alguien, abrí su chat de Match y tocá su nombre." />

      <SettingsGroup>
        <SettingsRow label="Centro de ayuda" onPress={proximamente} />
        <SettingsRow label="Contactar a soporte" onPress={proximamente} />
        <SettingsRow label="Reportar un problema" onPress={proximamente} />
        <SettingsRow label="Sugerir una mejora" onPress={proximamente} />
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
