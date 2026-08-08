/**
 * ConfiguracionScreen.jsx — Índice de Configuración (Instruction-Configuracion v1.0)
 *
 * Pantalla de NAVEGACIÓN pura: 11 destinos en 3 grupos (4+4+3), sin ningún
 * control suelto — switches, sliders y selects viven en las sub-pantallas.
 * Única excepción: el bloque destructivo del pie (Cerrar sesión / Eliminar
 * cuenta), separado de los grupos.
 *
 * Se abre desde el drawer (☰ → Configuración). El ☰ de este header vuelve a
 * abrir el drawer, no funciona como "atrás" (§2.3).
 */

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

const APP_VERSION = 'Zooni 1.4.2 (build 218)';

// Valores secundarios legibles (§3.4)
const TEMA_LABEL = { light: 'Claro', dark: 'Oscuro', auto: 'Automático' };
const CALIDAD_LABEL = { high: 'Alta', medium: 'Media', low: 'Baja', auto: 'Automática' };

export default function ConfiguracionScreen() {
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settings, setSettings] = useState(getSettings());
  const [homeData, setHomeData] = useState(null);

  // Refresca los valores secundarios al volver de una sub-pantalla
  useFocusEffect(useCallback(() => {
    setSettings({ ...getSettings() });
    return subscribeSettings(() => setSettings({ ...getSettings() }));
  }, []));

  // Usuario y mascota activa para el encabezado del drawer (igual que Home)
  useFocusEffect(useCallback(() => {
    fetchHome().then(setHomeData).catch(() => {});
  }, []));

  // Cantidad real de mascotas activas del usuario (valor secundario de la fila)
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

  // Toque largo sobre la versión: copia datos de diagnóstico (§3.3.F)
  const copiarDiagnostico = () => {
    const info = `${APP_VERSION} · ${Platform.OS} ${Platform.Version ?? ''}`.trim();
    if (Platform.OS === 'web' && navigator?.clipboard) {
      navigator.clipboard.writeText(info).catch(() => {});
    }
    Alert.alert('Datos de diagnóstico copiados', info);
  };

  const ir = (ruta) => () => navigation.navigate(ruta);

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>

        {/* Header: solo el ☰, sin campana (§3.3.A) */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} accessibilityRole="button"
            accessibilityLabel="Abrir menú" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="menu" size={28} color={T.text} />
          </TouchableOpacity>
        </View>

        {/* Título */}
        <View style={s.titleRow}>
          <Text style={s.title}>Configuración</Text>
          <Ionicons name="settings-outline" size={24} color={T.textSoft} style={{ marginLeft: 10 }} />
        </View>

        {/* Grupo 1 — Cuenta */}
        <SettingsGroup label="Cuenta">
          <SettingsRow icon="person-outline" tint="cuenta" label="Cuenta y Seguridad"
            value="nacho@zooni.app" onPress={ir('ConfigCuenta')} />
          <SettingsRow icon="color-palette-outline" tint="apariencia" label="Tema de la aplicación"
            value={TEMA_LABEL[settings.device.theme]} onPress={ir('ConfigTema')} />
          <SettingsRow icon="film-outline" tint="medios" label="Medios y Calidad"
            value={CALIDAD_LABEL[settings.device.upload_quality]} onPress={ir('ConfigMedios')} />
          <SettingsRow icon="time-outline" tint="tiempo" label="Tiempo en la app"
            value="1 h 12 min hoy" onPress={ir('ConfigTiempo')} />
        </SettingsGroup>

        {/* Grupo 2 — Mascotas y privacidad */}
        <SettingsGroup label="Mascotas y privacidad">
          <SettingsRow icon="paw-outline" tint="mascotas" label="Mis Mascotas"
            value={mascotasCount != null
              ? `${mascotasCount} ${mascotasCount === 1 ? 'mascota' : 'mascotas'}`
              : null}
            onPress={ir('ConfigMascotas')} />
          <SettingsRow icon="lock-closed-outline" tint="privacidad" label="Privacidad y visibilidad"
            value={settings.privacy.private_profile ? 'Perfil privado' : 'Perfil público'}
            onPress={ir('ConfigPrivacidad')} />
          <SettingsRow icon="phone-portrait-outline" tint="permisos" label="Permisos de la app"
            value="2 pendientes" badge onPress={ir('ConfigPermisos')} />
          <SettingsRow icon="notifications-outline" tint="notificaciones" label="Notificaciones y alertas"
            value={settings.notifications.push_enabled ? 'Activadas' : 'Silenciadas'}
            onPress={ir('ConfigNotificaciones')} />
        </SettingsGroup>

        {/* Grupo 3 — App y soporte */}
        <SettingsGroup label="App y soporte">
          <SettingsRow icon="card-outline" tint="pagos" label="Suscripciones y pagos"
            value="Plan Free" onPress={ir('ConfigSuscripciones')} />
          <SettingsRow icon="document-text-outline" tint="legal" label="Legal y Términos"
            onPress={ir('ConfigLegal')} />
          <SettingsRow icon="help-circle-outline" tint="ayuda" label="Ayuda y Soporte"
            onPress={ir('ConfigAyuda')} />
        </SettingsGroup>

        {/* Bloque destructivo (§3.3.E) */}
        <TouchableOpacity style={s.logoutCard} onPress={confirmarCerrarSesion}
          accessibilityRole="button" accessibilityLabel="Cerrar sesión">
          <Text style={s.logoutTxt}>Cerrar sesión</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.deleteLink} onPress={ir('ConfigEliminarCuenta')}
          accessibilityRole="button" accessibilityLabel="Eliminar mi cuenta">
          <Text style={s.deleteTxt}>Eliminar mi cuenta</Text>
        </TouchableOpacity>

        {/* Pie */}
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  logoutTxt: { fontSize: 16, fontWeight: '700', color: T.sosRedText },

  deleteLink: { alignItems: 'center', marginTop: 16, minHeight: 44, justifyContent: 'center' },
  deleteTxt:  { fontSize: 14, color: T.textSoftMint, textDecorationLine: 'underline' },

  version: { fontSize: 12, color: T.textSoftMint, textAlign: 'center', marginTop: 24 },
});
