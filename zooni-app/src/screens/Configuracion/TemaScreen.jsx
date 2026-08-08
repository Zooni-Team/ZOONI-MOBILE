/**
 * TemaScreen.jsx — Configuración › Tema de la aplicación (§3.5.2)
 *
 * El tema es preferencia de DISPOSITIVO: no sincroniza entre dispositivos.
 * Modo oscuro todavía no implementado → la opción se muestra deshabilitada
 * con "Próximamente", no se oculta (§3.5.2 ⚠️).
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SettingsGroup, SettingsScreen, SettingsSelect, SettingsSlider, SettingsToggle, T,
} from '../../components/settings/SettingsKit';
import { getSettings, patchSettings } from '../../services/settingsStore';

const TAMANOS = [
  { value: 'small',  label: 'Chico',      px: 13 },
  { value: 'normal', label: 'Normal',     px: 15 },
  { value: 'large',  label: 'Grande',     px: 17 },
  { value: 'xlarge', label: 'Muy grande', px: 19 },
  { value: 'max',    label: 'Máximo',     px: 22 },
];

export default function TemaScreen() {
  const [device, setDevice] = useState({ ...getSettings().device });
  const set = (patch) => {
    patchSettings('device', patch);
    setDevice({ ...getSettings().device });
  };

  const tamano = TAMANOS.find((t) => t.value === device.text_size) ?? TAMANOS[1];

  return (
    <SettingsScreen title="Tema de la aplicación">

      {/* Vista previa en vivo (§3.5.2) */}
      <View style={s.preview}>
        <View style={s.previewHeader} />
        <View style={s.previewCard}>
          <View style={s.previewAvatar} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[s.previewLine, { width: '60%' }]} />
            <View style={[s.previewLine, { width: '40%' }]} />
          </View>
        </View>
        <Text style={s.previewTag}>Así se ve Zooni con el tema claro</Text>
      </View>

      <SettingsGroup>
        <SettingsSelect
          label="Apariencia"
          options={[
            { value: 'light', label: 'Claro' },
            { value: 'dark',  label: 'Oscuro', apoyo: 'Próximamente' },
            { value: 'auto',  label: 'Automático', apoyo: 'Según el sistema' },
          ]}
          value={device.theme}
          onChange={(v) => { if (v !== 'dark') set({ theme: v }); }}
        />
        <SettingsSlider
          label="Tamaño del texto"
          steps={TAMANOS}
          value={device.text_size}
          onChange={(v) => set({ text_size: v })}
        />
        {/* Línea de ejemplo que cambia en tiempo real */}
        <View style={s.ejemploWrap}>
          <Text style={[s.ejemplo, { fontSize: tamano.px }]}>
            Titán tiene turno con la veterinaria el jueves.
          </Text>
        </View>
      </SettingsGroup>

      <SettingsGroup label="Accesibilidad">
        <SettingsToggle
          label="Reducir movimiento"
          apoyo="Desactiva las animaciones de transición."
          value={device.reduce_motion}
          onChange={(v) => set({ reduce_motion: v })}
        />
        <SettingsToggle
          label="Alto contraste"
          apoyo="Aumenta el contraste de textos y bordes."
          value={device.high_contrast}
          onChange={(v) => set({ high_contrast: v })}
        />
      </SettingsGroup>

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  preview: {
    height: 140, backgroundColor: T.surface, borderRadius: 18, marginTop: 16,
    padding: 14, gap: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  previewHeader: { height: 14, borderRadius: 7, backgroundColor: T.bgMain, width: '45%' },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.bgMainSoft, borderRadius: 12, padding: 10,
  },
  previewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.brand },
  previewLine:   { height: 8, borderRadius: 4, backgroundColor: '#B8E0C8' },
  previewTag:    { fontSize: 12, color: T.textSoft, textAlign: 'center' },

  ejemploWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  ejemplo:     { color: T.textSoft, lineHeight: 26 },
});
