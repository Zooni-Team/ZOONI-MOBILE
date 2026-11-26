import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import HamburgerDrawer from '../../components/HamburgerDrawer';
import { SettingsGroup, SettingsRow, T } from '../../components/settings/SettingsKit';
import { clearToken, fetchHome } from '../../services/api';
import { clearCurrentUserId } from '../../config/session';
import { getSettings, subscribeSettings } from '../../services/settingsStore';
import { fetchMisMascotas } from '../../services/petsApi';
import { formatoDuracion, segundosHoy } from '../../services/usoApp';
import { mailDeLaSesion } from '../../services/authApi';
import { colores } from '../../theme';
import { alerta } from '../../utils/dialogo';
import appJson from '../../../app.json';

const APP_VERSION = `Zooni ${appJson.expo.version}`;

const TEMA_LABEL = { light: 'Claro', dark: 'Oscuro', auto: 'Automático' };
const CALIDAD_LABEL = { high: 'Alta', medium: 'Media', low: 'Baja', auto: 'Automática' };

export default function ConfiguracionScreen() {
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settings, setSettings] = useState(getSettings());
  const [homeData, setHomeData] = useState(null);

  useFocusEffect(useCallback(() => {
    setSettings({ ...getSettings() });
    return subscribeSettings(() => setSettings({ ...getSettings() }));
  }, []));

  useFocusEffect(useCallback(() => {
    fetchHome().then(setHomeData).catch(() => {});
  }, []));

  const [mail, setMail] = useState(null);
  const [usoHoy, setUsoHoy] = useState(null);
  useFocusEffect(useCallback(() => {
    mailDeLaSesion().then(setMail);
    setUsoHoy(segundosHoy());
  }, []));

  const [mascotasCount, setMascotasCount] = useState(null);
  useFocusEffect(useCallback(() => {
    fetchMisMascotas()
      .then(({ activas }) => setMascotasCount(activas.length))
      .catch(() => setMascotasCount(null));
  }, []));

  const confirmarCerrarSesion = () => {
    const salir = async () => {
      await clearToken();
      await clearCurrentUserId();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Cerrar sesión? Vas a tener que volver a iniciar sesión para usar Zooni.')) salir();
      return;
    }
    Alert.alert('¿Cerrar sesión?', 'Vas a tener que volver a iniciar sesión para usar Zooni.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: salir },
    ]);
  };

  const copiarDiagnostico = () => {
    const info = `${APP_VERSION} · ${Platform.OS} ${Platform.Version ?? ''}`.trim();
    if (Platform.OS === 'web' && navigator?.clipboard) {
      navigator.clipboard.writeText(info).catch(() => {});
    }
    alerta('Datos de diagnóstico copiados', info);
  };

  const ir = (ruta) => () => navigation.navigate(ruta);

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} accessibilityRole="button"
            accessibilityLabel="Abrir menú" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu" size={28} color={T.text} />
          </TouchableOpacity>
        </View>

        <View style={s.titleRow}>
          <Text style={s.title}>Configuración</Text>
          <Ionicons name="settings-outline" size={24} color={T.textSoft} style={{ marginLeft: 10 }} />
        </View>

        <SettingsGroup label="Cuenta">
          <SettingsRow icon="person-outline" tint="cuenta" label="Cuenta y Seguridad"
            value={mail ?? undefined} onPress={ir('ConfigCuenta')} />
          <SettingsRow icon="color-palette-outline" tint="apariencia" label="Tema de la aplicación"
            value={TEMA_LABEL[settings.device.theme]} onPress={ir('ConfigTema')} />
          <SettingsRow icon="film-outline" tint="medios" label="Medios y Calidad"
            value={CALIDAD_LABEL[settings.device.upload_quality]} onPress={ir('ConfigMedios')} />
          <SettingsRow icon="time-outline" tint="tiempo" label="Tiempo en la app"
            value={usoHoy != null ? `${formatoDuracion(usoHoy)} hoy` : undefined} onPress={ir('ConfigTiempo')} />
        </SettingsGroup>

        <SettingsGroup label="Mascotas y privacidad">
          <SettingsRow icon="paw-outline" tint="mascotas" label="Mis Mascotas"
            value={mascotasCount != null
              ? `${mascotasCount} ${mascotasCount === 1 ? 'mascota' : 'mascotas'}`
              : null}
            onPress={ir('ConfigMascotas')} />
          <SettingsRow icon="lock-closed-outline" tint="privacidad" label="Privacidad y visibilidad"
            onPress={ir('ConfigPrivacidad')} />
          <SettingsRow icon="phone-portrait-outline" tint="permisos" label="Permisos de la app"
            onPress={ir('ConfigPermisos')} />
          <SettingsRow icon="notifications-outline" tint="notificaciones" label="Notificaciones y alertas"
            etiqueta="Vista previa" onPress={ir('ConfigNotificaciones')} />
        </SettingsGroup>

        <SettingsGroup label="App y soporte">
          <SettingsRow icon="card-outline" tint="pagos" label="Suscripciones y pagos"
            etiqueta="Vista previa" onPress={ir('ConfigSuscripciones')} />
          <SettingsRow icon="document-text-outline" tint="legal" label="Legal y Términos"
            onPress={ir('ConfigLegal')} />
          <SettingsRow icon="help-circle-outline" tint="ayuda" label="Ayuda y Soporte"
            etiqueta="Vista previa" onPress={ir('ConfigAyuda')} />
        </SettingsGroup>

        <TouchableOpacity style={s.logoutCard} onPress={confirmarCerrarSesion}
          accessibilityRole="button" accessibilityLabel="Cerrar sesión">
          <Text style={s.logoutTxt}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Pressable onLongPress={copiarDiagnostico} delayLongPress={600}>
          <Text style={s.version}>{APP_VERSION}</Text>
        </Pressable>
      </ScrollView>

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={homeData?.usuario ?? null}
        mascotaActiva={homeData?.mascotaActiva ?? null}
        activeRoute="Configuracion"
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.bgMain },
  content:  { paddingHorizontal: 16, paddingBottom: 32 },

  header: {
    height: 52, flexDirection: 'row', alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 24 : 0,
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 24, marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: T.text },

  logoutCard: {
    backgroundColor: T.surface, borderRadius: 18, height: 56,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  logoutTxt: { fontSize: 16, fontWeight: '700', color: T.sosRedText },

  version: { fontSize: 12, color: T.textSoftMint, textAlign: 'center', marginTop: 24 },
});
