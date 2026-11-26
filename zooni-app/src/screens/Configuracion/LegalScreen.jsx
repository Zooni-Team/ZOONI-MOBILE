import React from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  SettingsAction, SettingsGroup, SettingsInfo, SettingsRow, SettingsScreen,
} from '../../components/settings/SettingsKit';
import { alerta } from '../../utils/dialogo';
import appJson from '../../../app.json';

const DOCS = [
  { label: 'Términos y condiciones',  url: 'https://zooni.app/legal/terminos' },
  { label: 'Política de privacidad',  url: 'https://zooni.app/legal/privacidad' },
  { label: 'Política de cookies',     url: 'https://zooni.app/legal/cookies' },
  { label: 'Normas de la comunidad',  url: 'https://zooni.app/legal/comunidad' },
];

export default function LegalScreen() {
  const navigation = useNavigation();

  return (
    <SettingsScreen title="Legal y Términos">

      <SettingsGroup>
        {DOCS.map((d) => (
          <SettingsRow key={d.label} label={d.label}
            onPress={() => Linking.openURL(d.url).catch(() => alerta('No pudimos abrir el documento'))} />
        ))}
        <SettingsRow label="Licencias de código abierto"
          onPress={() => alerta('Licencias', 'Zooni usa React Native, Expo, Supabase y otras librerías de código abierto.')} />
      </SettingsGroup>

      <SettingsGroup label="Tus datos">
        <SettingsAction
          label="Descargar mis datos"
          apoyo="Próximamente: vas a poder pedir un archivo con toda tu información."
          disabled
        />
        <SettingsAction label="Eliminar mi cuenta" destructive
          onPress={() => navigation.navigate('ConfigEliminarCuenta')} />
      </SettingsGroup>

      <SettingsGroup label="Sobre la app">
        <SettingsInfo label="Versión" value={appJson.expo.version} />
      </SettingsGroup>

    </SettingsScreen>
  );
}
