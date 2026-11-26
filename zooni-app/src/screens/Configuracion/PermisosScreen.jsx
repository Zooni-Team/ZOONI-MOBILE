/**
 * PermisosScreen.jsx — Configuración › Permisos de la app (§3.5.7)
 *
 * Esta pantalla NO cambia permisos: los otorga el SO. Cada fila muestra el
 * estado real (utils/permisos) y el toque abre los ajustes del sistema
 * (Linking.openSettings()). Nunca se re-pide un permiso denegado desde el
 * prompt nativo (en iOS el segundo pedido no muestra nada y el usuario queda
 * atascado). Sólo se listan los permisos que Zooni usa de verdad.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { SettingsBanner, SettingsGroup, SettingsScreen, T } from '../../components/settings/SettingsKit';
import { estadoDePermisos } from '../../utils/permisos';
import { alerta } from '../../utils/dialogo';

const PERMISOS = [
  { clave: 'ubicacion', icono: 'location-outline', nombre: 'Ubicación',
    apoyo: 'Para el mapa de la comunidad, veterinarias cerca, Match por distancia y el seguimiento de paseos.' },
  { clave: 'camara', icono: 'camera-outline', nombre: 'Cámara',
    apoyo: 'Para sacarle fotos a tus mascotas y a tu perfil.' },
  { clave: 'fotos', icono: 'images-outline', nombre: 'Fotos y galería',
    apoyo: 'Para elegir fotos de perfil, de tus mascotas y de las reseñas.' },
];

const ESTADOS = {
  permitido:   { label: 'Permitido',              color: T.brandText },
  denegado:    { label: 'Denegado',               color: T.sosRedText },
  sin_pedir:   { label: 'Todavía no se pidió',    color: T.textSoft },
  no_aplica:   { label: 'No hace falta en la web', color: T.textSoft },
  desconocido: { label: 'Se pide al usarla',      color: T.textSoft },
};

function abrirAjustes() {
  if (Platform.OS === 'web') {
    alerta('Permisos del navegador',
      'En la web, los permisos se cambian desde el candado que está a la izquierda de la dirección del sitio.');
    return;
  }
  Linking.openSettings();
}

export default function PermisosScreen() {
  const [estados, setEstados] = useState(null);

  // Al volver de los ajustes del sistema, el estado puede haber cambiado.
  useFocusEffect(useCallback(() => {
    let vigente = true;
    estadoDePermisos().then((e) => { if (vigente) setEstados(e); });
    return () => { vigente = false; };
  }, []));

  const denegados = PERMISOS.filter((p) => estados?.[p.clave] === 'denegado');

  return (
    <SettingsScreen title="Permisos de la app">

      {denegados.length > 0 && (
        <SettingsBanner
          icon="alert-circle-outline"
          text={`Sin ${denegados.map((p) => p.nombre.toLowerCase()).join(' ni ')}, algunas partes de Zooni no van a funcionar.`}
        />
      )}

      <SettingsGroup>
        {PERMISOS.map((p) => {
          const estado = estados ? ESTADOS[estados[p.clave]] ?? ESTADOS.desconocido : null;
          return (
            <TouchableOpacity key={p.clave} style={s.fila} onPress={abrirAjustes}
              accessibilityRole="button"
              accessibilityLabel={`${p.nombre}, ${estado?.label ?? 'cargando'}. Abre los ajustes`}>
              <Ionicons name={p.icono} size={20} color={T.text} style={{ width: 28 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.nombre}>{p.nombre}</Text>
                <Text style={s.apoyo}>{p.apoyo}</Text>
              </View>
              {estado
                ? <Text style={[s.estado, { color: estado.color }]}>{estado.label}</Text>
                : <ActivityIndicator size="small" color={T.brand} />}
            </TouchableOpacity>
          );
        })}
      </SettingsGroup>

      <Text style={s.nota}>
        Zooni pide cada permiso recién cuando lo necesita. Para cambiarlo, tocá cualquier fila.
      </Text>

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14, minHeight: 64,
  },
  nombre: { fontSize: 16, fontWeight: '600', color: T.text },
  apoyo:  { fontSize: 13, color: T.textSoft, marginTop: 3, lineHeight: 18 },
  estado: { fontSize: 13, fontWeight: '700', maxWidth: 110, textAlign: 'right' },
  nota:   { fontSize: 13, color: T.textSoftMint, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
