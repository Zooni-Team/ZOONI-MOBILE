/**
 * NotificacionesScreen.jsx — Configuración › Notificaciones y alertas (§3.5.8)
 *
 * El toggle maestro colapsa todos los grupos siguientes.
 * Excepción no configurable: las notificaciones críticas de seguridad de la
 * cuenta se listan como "Siempre activas".
 */

import React, { useState } from 'react';

import {
  SettingsGroup, SettingsInfo, SettingsScreen, SettingsSelect, SettingsToggle,
} from '../../components/settings/SettingsKit';
import { getSettings, patchSettings } from '../../services/settingsStore';

export default function NotificacionesScreen() {
  const [n, setN] = useState({ ...getSettings().notifications });
  const set = (patch) => {
    patchSettings('notifications', patch);
    setN({ ...getSettings().notifications });
  };

  return (
    <SettingsScreen title="Notificaciones y alertas">

      <SettingsGroup>
        <SettingsToggle label="Notificaciones push"
          apoyo={n.push_enabled ? null : 'Con el maestro apagado no te llega ninguna notificación push.'}
          value={n.push_enabled}
          onChange={(v) => set({ push_enabled: v })} />
      </SettingsGroup>

      {n.push_enabled && (
        <>
          <SettingsGroup label="Actividad">
            <SettingsToggle label="Mensajes nuevos" value={n.messages} onChange={(v) => set({ messages: v })} />
            <SettingsToggle label="Solicitudes de amistad" value={n.friend_requests} onChange={(v) => set({ friend_requests: v })} />
            <SettingsToggle label="Match nuevo" value={n.new_match} onChange={(v) => set({ new_match: v })} />
            <SettingsToggle label="Me gusta y comentarios" value={n.likes_comments} onChange={(v) => set({ likes_comments: v })} />
            <SettingsToggle label="Alguien empezó a seguirte" value={n.new_follower} onChange={(v) => set({ new_follower: v })} />
          </SettingsGroup>

          <SettingsGroup label="Mascotas y servicios">
            <SettingsToggle label="Paseo en vivo"
              apoyo="Avisos de inicio, fin y desvíos de ruta."
              value={n.live_walk} onChange={(v) => set({ live_walk: v })} />
            <SettingsToggle label="Recordatorios de vacunas y desparasitación"
              value={n.vaccine_reminders} onChange={(v) => set({ vaccine_reminders: v })} />
            <SettingsToggle label="Turnos de veterinaria"
              value={n.vet_appointments} onChange={(v) => set({ vet_appointments: v })} />
            <SettingsToggle label="Novedades de veterinarias y pet shops que sigo"
              value={n.followed_places} onChange={(v) => set({ followed_places: v })} />
          </SettingsGroup>

          <SettingsGroup label="Comunidad">
            <SettingsToggle label="Alertas de mascotas perdidas cerca tuyo"
              apoyo="Te avisamos si alguien publica una mascota perdida en un radio de 3 km."
              value={n.lost_pets_nearby} onChange={(v) => set({ lost_pets_nearby: v })} />
            <SettingsToggle label="Carteles nuevos en el mapa"
              value={n.map_posters} onChange={(v) => set({ map_posters: v })} />
          </SettingsGroup>

          <SettingsGroup label="Zooni">
            <SettingsToggle label="Novedades y consejos"
              value={n.news_tips} onChange={(v) => set({ news_tips: v })} />
            <SettingsToggle label="Promociones y descuentos"
              value={n.promotions} onChange={(v) => set({ promotions: v })} />
          </SettingsGroup>

          <SettingsGroup label="Cómo te avisamos">
            <SettingsToggle label="Sonido" value={n.sound} onChange={(v) => set({ sound: v })} />
            <SettingsToggle label="Vibración" value={n.vibration} onChange={(v) => set({ vibration: v })} />
            <SettingsSelect label="Mostrar la vista previa en la pantalla bloqueada"
              options={[
                { value: 'always',   label: 'Siempre' },
                { value: 'unlocked', label: 'Solo cuando está desbloqueado' },
                { value: 'never',    label: 'Nunca' },
              ]}
              value={n.lockscreen_preview}
              onChange={(v) => set({ lockscreen_preview: v })} />
            <SettingsToggle label="Correo electrónico"
              apoyo="Resumen de actividad por mail."
              value={n.email_digest} onChange={(v) => set({ email_digest: v })} />
            <SettingsToggle label="No molestar"
              apoyo={n.dnd_enabled
                ? `Desde ${n.dnd_from} hasta ${n.dnd_to}. Las alertas de mascota perdida siguen llegando.`
                : 'Las alertas de mascota perdida siguen llegando.'}
              value={n.dnd_enabled}
              onChange={(v) => set({ dnd_enabled: v })} />
          </SettingsGroup>
        </>
      )}

      <SettingsGroup label="Seguridad de la cuenta">
        <SettingsInfo label="Inicio de sesión en un dispositivo nuevo" value="Siempre activas"
          apoyo="Por tu seguridad, estas no se pueden desactivar." />
        <SettingsInfo label="Cambio de contraseña" value="Siempre activas" />
      </SettingsGroup>

    </SettingsScreen>
  );
}
