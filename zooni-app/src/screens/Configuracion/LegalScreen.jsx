/**
 * LegalScreen.jsx — Configuración › Legal y Términos (§3.5.10)
 *
 * Los documentos abren en el navegador (react-native-webview no está en las
 * dependencias; cuando se agregue, cambiar Linking.openURL por el WebView
 * interno con header propio y botón de compartir).
 */

import React, { useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  SettingsAction, SettingsGroup, SettingsInfo, SettingsRow, SettingsScreen,
} from '../../components/settings/SettingsKit';

const DOCS = [
  { label: 'Términos y condiciones',  url: 'https://zooni.app/legal/terminos' },
  { label: 'Política de privacidad',  url: 'https://zooni.app/legal/privacidad' },
  { label: 'Política de cookies',     url: 'https://zooni.app/legal/cookies' },
  { label: 'Normas de la comunidad',  url: 'https://zooni.app/legal/comunidad' },
];

export default function LegalScreen() {
  const navigation = useNavigation();
  const [exportPedido, setExportPedido] = useState(null);

  const pedirExport = () => {
    if (exportPedido) return;
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    setExportPedido(hoy);
    Alert.alert(
      'Solicitud enviada',
      'Te enviamos un archivo con toda tu información a tu email. Puede tardar hasta 48 horas.'
    );
  };

  return (
    <SettingsScreen title="Legal y Términos">

      <SettingsGroup>
        {DOCS.map((d) => (
          <SettingsRow key={d.label} label={d.label}
            onPress={() => Linking.openURL(d.url).catch(() => Alert.alert('No pudimos abrir el documento'))} />
        ))}
        <SettingsRow label="Licencias de código abierto"
          onPress={() => Alert.alert('Licencias', 'Zooni usa React Native, Expo, Supabase y otras librerías de código abierto.')} />
      </SettingsGroup>

      <SettingsGroup label="Tus datos">
        <SettingsAction
          label="Descargar mis datos"
          apoyo={exportPedido
            ? `Solicitado el ${exportPedido}. Podés volver a pedirlos en 48 horas.`
            : 'Te enviamos un archivo con toda tu información a tu email. Puede tardar hasta 48 horas.'}
          onPress={pedirExport}
          disabled={!!exportPedido}
        />
        <SettingsAction label="Eliminar mi cuenta" destructive
          onPress={() => navigation.navigate('ConfigEliminarCuenta')} />
      </SettingsGroup>

      <SettingsGroup label="Sobre la app">
        <SettingsInfo label="Versión" value="1.4.2 (218)" />
        <SettingsRow label="Novedades de esta versión"
          onPress={() => Alert.alert('Novedades', '· Pantalla S.O.S Veterinario\n· Configuración completa\n· Mejoras de rendimiento')} />
      </SettingsGroup>

    </SettingsScreen>
  );
}
