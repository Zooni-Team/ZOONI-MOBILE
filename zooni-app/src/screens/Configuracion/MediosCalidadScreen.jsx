/**
 * MediosCalidadScreen.jsx — Configuración › Medios y Calidad (§3.5.3)
 *
 * Todas preferencias de DISPOSITIVO (no sincronizan).
 */

import React, { useState } from 'react';
import { Alert } from 'react-native';

import {
  SettingsAction, SettingsGroup, SettingsInfo, SettingsScreen,
  SettingsSelect, SettingsToggle,
} from '../../components/settings/SettingsKit';
import { getSettings, patchSettings } from '../../services/settingsStore';

export default function MediosCalidadScreen() {
  const [device, setDevice] = useState({ ...getSettings().device });
  const [cacheMb, setCacheMb] = useState(248);
  const set = (patch) => {
    patchSettings('device', patch);
    setDevice({ ...getSettings().device });
  };

  const vaciarCache = () => {
    Alert.alert(
      '¿Vaciar la caché?',
      'Se van a borrar las imágenes guardadas temporalmente. No perdés nada de tu cuenta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar',
          onPress: () => {
            const liberado = cacheMb;
            setCacheMb(0);
            Alert.alert(`Liberamos ${liberado} MB`);
          },
        },
      ]
    );
  };

  return (
    <SettingsScreen title="Medios y Calidad">

      <SettingsGroup label="Calidad">
        <SettingsSelect label="Calidad de subida de fotos"
          options={[
            { value: 'high',   label: 'Alta',  apoyo: '~4 MB por foto' },
            { value: 'medium', label: 'Media', apoyo: '~1,5 MB por foto' },
            { value: 'low',    label: 'Baja (ahorra datos)', apoyo: '~500 KB por foto' },
          ]}
          value={device.upload_quality}
          onChange={(v) => set({ upload_quality: v })} />
        <SettingsSelect label="Calidad de descarga"
          options={[
            { value: 'auto', label: 'Automática' },
            { value: 'high', label: 'Alta' },
            { value: 'low',  label: 'Ahorro de datos' },
          ]}
          value={device.download_quality}
          onChange={(v) => set({ download_quality: v })} />
        <SettingsSelect label="Calidad del video en paseos en vivo"
          apoyo="La calidad baja usa menos batería y datos durante el seguimiento del paseo."
          options={[
            { value: 'auto', label: 'Automática' },
            { value: 'high', label: 'Alta (720p)' },
            { value: 'low',  label: 'Baja (480p)' },
          ]}
          value={device.live_walk_quality}
          onChange={(v) => set({ live_walk_quality: v })} />
      </SettingsGroup>

      <SettingsGroup label="Reproducción">
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

      <SettingsGroup label="Datos y almacenamiento">
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
        <SettingsInfo label="Espacio usado" value={`${cacheMb} MB`}
          apoyo={cacheMb > 0 ? 'Imágenes 180 MB · Videos 52 MB · Otros 16 MB' : 'Caché vacía'} />
        <SettingsAction label="Vaciar caché" onPress={vaciarCache} disabled={cacheMb === 0} />
      </SettingsGroup>

    </SettingsScreen>
  );
}
