import React, { useState } from 'react';

import {
  SettingsGroup, SettingsScreen, SettingsSelect, SettingsToggle, SettingsVistaPrevia,
} from '../../components/settings/SettingsKit';
import { getSettings, patchSettings } from '../../services/settingsStore';

export default function MediosCalidadScreen() {
  const [device, setDevice] = useState({ ...getSettings().device });
  const set = (patch) => {
    patchSettings('device', patch);
    setDevice({ ...getSettings().device });
  };

  return (
    <SettingsScreen title="Medios y Calidad">

      <SettingsGroup label="Fotos que subís">
        <SettingsSelect label="Calidad de subida de fotos"
          apoyo="Se aplica a las fotos de perfil, mascotas, carteles y consultas."
          options={[
            { value: 'high',   label: 'Alta',  apoyo: 'Más nítida, tarda más en subir' },
            { value: 'medium', label: 'Media', apoyo: 'El equilibrio recomendado' },
            { value: 'low',    label: 'Baja (ahorra datos)', apoyo: 'Más liviana, menos detalle' },
          ]}
          value={device.upload_quality}
          onChange={(v) => set({ upload_quality: v })} />
      </SettingsGroup>

      <SettingsVistaPrevia texto="Las opciones de abajo se guardan en este dispositivo, pero todavía no cambian cómo Zooni descarga o reproduce fotos y videos." />

      <SettingsGroup label="Descarga y reproducción">
        <SettingsSelect label="Calidad de descarga"
          options={[
            { value: 'auto', label: 'Automática' },
            { value: 'high', label: 'Alta' },
            { value: 'low',  label: 'Ahorro de datos' },
          ]}
          value={device.download_quality}
          onChange={(v) => set({ download_quality: v })} />
        <SettingsSelect label="Reproducir videos automáticamente"
          options={[
            { value: 'always', label: 'Siempre' },
            { value: 'wifi',   label: 'Solo con Wi-Fi' },
            { value: 'never',  label: 'Nunca' },
          ]}
          value={device.autoplay}
          onChange={(v) => set({ autoplay: v })} />
        <SettingsToggle label="Silenciar videos al abrirlos"
          value={device.mute_videos}
          onChange={(v) => set({ mute_videos: v })} />
      </SettingsGroup>

      <SettingsGroup label="Datos">
        <SettingsToggle label="Descargar contenido solo con Wi-Fi"
          value={device.wifi_only_downloads}
          onChange={(v) => set({ wifi_only_downloads: v })} />
        <SettingsToggle label="Precargar imágenes del feed"
          apoyo="Carga más rápido pero consume más datos."
          value={device.preload_feed}
          onChange={(v) => set({ preload_feed: v })} />
        <SettingsToggle label="Guardar las fotos que saco en Zooni"
          value={device.save_photos}
          onChange={(v) => set({ save_photos: v })} />
      </SettingsGroup>

    </SettingsScreen>
  );
}
