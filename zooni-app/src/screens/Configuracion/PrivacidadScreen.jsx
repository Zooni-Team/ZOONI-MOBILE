/**
 * PrivacidadScreen.jsx — Configuración › Privacidad y visibilidad (§3.5.6)
 *
 * Preferencias de CUENTA: sincronizan entre dispositivos.
 * Los textos de apoyo explican la consecuencia, no la mecánica.
 */

import React, { useState } from 'react';
import { Alert } from 'react-native';

import {
  SettingsGroup, SettingsRow, SettingsScreen, SettingsSelect, SettingsToggle,
} from '../../components/settings/SettingsKit';
import { getSettings, patchSettings } from '../../services/settingsStore';

const APOYO_UBICACION = {
  everyone: 'Cualquier persona de Zooni puede ver tu ubicación aproximada en el mapa.',
  friends:  'Solo tus amigos pueden ver tu ubicación aproximada en el mapa.',
  nobody:   'Nadie va a poder ver tu ubicación en el mapa.',
};

export default function PrivacidadScreen() {
  const [privacy, setPrivacy] = useState({ ...getSettings().privacy });
  const set = (patch) => {
    patchSettings('privacy', patch);
    setPrivacy({ ...getSettings().privacy });
  };

  return (
    <SettingsScreen title="Privacidad y visibilidad">

      <SettingsGroup label="Tu perfil">
        <SettingsToggle label="Perfil privado"
          apoyo="Solo tus amigos pueden ver tus publicaciones y tus mascotas."
          value={privacy.private_profile}
          onChange={(v) => set({ private_profile: v })} />
        <SettingsToggle label="Mostrar mi edad"
          value={privacy.show_age}
          onChange={(v) => set({ show_age: v })} />
        <SettingsSelect label="Mostrar mi zona"
          apoyo="Nunca mostramos tu dirección exacta."
          options={[
            { value: 'neighborhood', label: 'Barrio' },
            { value: 'city',         label: 'Ciudad' },
            { value: 'hidden',       label: 'No mostrar' },
          ]}
          value={privacy.show_zone}
          onChange={(v) => set({ show_zone: v })} />
      </SettingsGroup>

      <SettingsGroup label="Ubicación">
        <SettingsSelect label="Compartir mi ubicación en el mapa"
          apoyo={APOYO_UBICACION[privacy.location_sharing]}
          options={[
            { value: 'everyone', label: 'Todos' },
            { value: 'friends',  label: 'Solo mis amigos' },
            { value: 'nobody',   label: 'Nadie' },
          ]}
          value={privacy.location_sharing}
          onChange={(v) => set({ location_sharing: v })} />
        <SettingsSelect label="Precisión de mi ubicación"
          options={[
            { value: 'exact',       label: 'Exacta' },
            { value: 'approximate', label: 'Aproximada (radio de 500 m)' },
          ]}
          value={privacy.location_precision}
          onChange={(v) => set({ location_precision: v })} />
        <SettingsToggle label="Ubicación en vivo durante los paseos"
          apoyo="Mientras dure el paseo, las personas que elijas pueden seguirte en tiempo real."
          value={privacy.live_walk_location}
          onChange={(v) => set({ live_walk_location: v })} />
      </SettingsGroup>

      <SettingsGroup label="Quién puede…">
        <SettingsSelect label="Enviarme solicitudes de amistad"
          options={[
            { value: 'everyone', label: 'Todos' },
            { value: 'fof',      label: 'Amigos de amigos' },
            { value: 'nobody',   label: 'Nadie' },
          ]}
          value={privacy.friend_requests_from}
          onChange={(v) => set({ friend_requests_from: v })} />
        <SettingsSelect label="Escribirme por chat"
          options={[
            { value: 'everyone', label: 'Todos' },
            { value: 'friends',  label: 'Solo mis amigos' },
            { value: 'matches',  label: 'Solo con los que hice match' },
          ]}
          value={privacy.messages_from}
          onChange={(v) => set({ messages_from: v })} />
        <SettingsToggle label="Ver mis mascotas en Match"
          apoyo="Si lo desactivás, tus mascotas dejan de aparecerle a otras personas."
          value={privacy.visible_in_match}
          onChange={(v) => set({ visible_in_match: v })} />
      </SettingsGroup>

      <SettingsGroup label="Bloqueos y actividad">
        <SettingsRow label="Usuarios bloqueados" value="0"
          onPress={() => Alert.alert('Usuarios bloqueados', 'No tenés usuarios bloqueados.')} />
        <SettingsRow label="Cuentas silenciadas" value="0"
          onPress={() => Alert.alert('Cuentas silenciadas', 'No tenés cuentas silenciadas.')} />
        <SettingsToggle label="Mostrar cuándo estoy en línea"
          apoyo="Si lo desactivás, tampoco vas a ver cuándo están en línea los demás."
          value={privacy.show_online_status}
          onChange={(v) => set({ show_online_status: v })} />
        <SettingsToggle label="Confirmaciones de lectura"
          apoyo="Si las desactivás, tampoco vas a ver las de los demás."
          value={privacy.read_receipts}
          onChange={(v) => set({ read_receipts: v })} />
      </SettingsGroup>

    </SettingsScreen>
  );
}
