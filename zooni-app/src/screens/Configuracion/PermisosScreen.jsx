/**
 * PermisosScreen.jsx — Configuración › Permisos de la app (§3.5.7)
 *
 * Esta pantalla NO cambia permisos: los otorga el SO. Cada fila muestra el
 * estado y el toque abre los ajustes del sistema (Linking.openSettings()).
 * Nunca se re-pide un permiso denegado desde el prompt nativo (en iOS el
 * segundo pedido no muestra nada y el usuario queda atascado).
 */

import React from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SettingsBanner, SettingsGroup, SettingsScreen, T } from '../../components/settings/SettingsKit';

// Estados demo hasta conectar la lectura real del SO (expo-permissions por módulo)
const PERMISOS = [
  { icono: 'location-outline',       nombre: 'Ubicación',        estado: 'denegado',   apoyo: 'Para mostrarte veterinarias cerca, el mapa de amigos y el seguimiento de paseos.' },
  { icono: 'camera-outline',         nombre: 'Cámara',           estado: 'permitido',  apoyo: 'Para sacarle fotos a tus mascotas y escanear códigos QR.' },
  { icono: 'images-outline',         nombre: 'Fotos y galería',  estado: 'permitido',  apoyo: 'Para elegir la foto de perfil y subir fotos de tus mascotas.' },
  { icono: 'mic-outline',            nombre: 'Micrófono',        estado: 'sin_definir', apoyo: 'Para mandar mensajes de voz en el chat.' },
  { icono: 'notifications-outline',  nombre: 'Notificaciones',   estado: 'permitido',  apoyo: 'Para avisarte de mensajes, solicitudes y recordatorios de vacunas.' },
  { icono: 'people-outline',         nombre: 'Contactos',        estado: 'denegado',   apoyo: 'Para ayudarte a encontrar amigos que ya usan Zooni.' },
  { icono: 'walk-outline',           nombre: 'Actividad física', estado: 'sin_definir', apoyo: 'Para contar los pasos y la distancia de los paseos.' },
  { icono: 'bluetooth-outline',      nombre: 'Bluetooth',        estado: 'sin_definir', apoyo: 'Para conectarte con collares con GPS.' },
];

const ESTADOS = {
  permitido:   { label: 'Permitido',   color: T.brandText },
  mientras:    { label: 'Solo mientras uso la app', color: T.brandText },
  denegado:    { label: 'Denegado',    color: T.sosRedText },
  sin_definir: { label: 'Sin definir', color: T.textSoft },
};

function abrirAjustes() {
  if (Platform.OS === 'web') {
    Alert.alert('Ajustes del sistema', 'En el teléfono, esta opción abre los ajustes de Zooni para cambiar el permiso.');
    return;
  }
  Linking.openSettings();
}

export default function PermisosScreen() {
  const hayDenegados = PERMISOS.some((p) => p.estado === 'denegado');

  return (
    <SettingsScreen title="Permisos de la app">

      {hayDenegados && (
        <SettingsBanner
          icon="alert-circle-outline"
          text="Sin ubicación no podemos mostrarte veterinarias cerca ni el mapa de amigos."
        />
      )}

      <SettingsGroup>
        {PERMISOS.map((p) => {
          const estado = ESTADOS[p.estado];
          return (
            <TouchableOpacity key={p.nombre} style={s.fila} onPress={abrirAjustes}
              accessibilityRole="button"
              accessibilityLabel={`${p.nombre}, ${estado.label}. Abre los ajustes del sistema`}>
              <Ionicons name={p.icono} size={20} color={T.text} style={{ width: 28 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.nombre}>{p.nombre}</Text>
                <Text style={s.apoyo}>{p.apoyo}</Text>
              </View>
              <Text style={[s.estado, { color: estado.color }]}>{estado.label}</Text>
            </TouchableOpacity>
          );
        })}
      </SettingsGroup>

      <Text style={s.nota}>
        Los permisos se cambian desde los ajustes de tu teléfono. Tocá cualquier fila para abrirlos.
      </Text>

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  fila: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
  },
  nombre: { fontSize: 16, fontWeight: '600', color: T.text },
  apoyo:  { fontSize: 13, color: T.textSoft, marginTop: 2, lineHeight: 18 },
  estado: { fontSize: 14, maxWidth: 110, textAlign: 'right' },
  nota:   { fontSize: 13, color: T.textSoftMint, textAlign: 'center', marginTop: 16, paddingHorizontal: 12 },
});
