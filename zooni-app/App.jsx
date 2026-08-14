/**
 * App.jsx — Punto de entrada de la aplicación Zooni
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, AppState, StyleSheet } from 'react-native';

import { loadStoredUserId } from './src/config/session';
import { ThemeProvider, useTheme } from './src/config/theme';
import { iniciarLatidoPresencia, marcarPresencia } from './src/services/presenciaApi';
import HomeScreen        from './src/screens/HomeScreen';
import LoginScreen       from './src/screens/LoginScreen';
import RegisterStep1Screen from './src/screens/RegisterStep1Screen';
import RegisterStep2Screen from './src/screens/RegisterStep2Screen';
import RegisterStep3Screen from './src/screens/RegisterStep3Screen';
import RegisterStep4Screen from './src/screens/RegisterStep4Screen';
import MatchScreen       from './src/screens/MatchScreen';
import MatchFiltersScreen from './src/screens/MatchFiltersScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';
import ComunidadScreen   from './src/screens/Comunidad/ComunidadScreen';
import ClosetScreen      from './src/screens/ClosetScreen';
import FichaMedicaScreen from './src/screens/FichaMedicaScreen';
import ConsejosScreen from './src/screens/ConsejosScreen';
import TratamientosScreen from './src/screens/TratamientosScreen';
import VacunasScreen from './src/screens/VacunasScreen';
import VirtualVetScreen from './src/screens/VirtualVetScreen';
import ConsultasScreen from './src/screens/ConsultasScreen';
import EventosScreen     from './src/screens/EventosScreen';
import CalendarioScreen  from './src/screens/CalendarioScreen';
import ChatScreen        from './src/screens/ChatScreen';
import MensajesScreen    from './src/screens/MensajesScreen';
import PerfilScreen      from './src/screens/PerfilScreen';
import SosScreen         from './src/screens/SosScreen';
import ConfiguracionScreen      from './src/screens/Configuracion/ConfiguracionScreen';
import CuentaSeguridadScreen    from './src/screens/Configuracion/CuentaSeguridadScreen';
import TemaScreen               from './src/screens/Configuracion/TemaScreen';
import MediosCalidadScreen      from './src/screens/Configuracion/MediosCalidadScreen';
import TiempoAppScreen          from './src/screens/Configuracion/TiempoAppScreen';
import MisMascotasScreen        from './src/screens/Configuracion/MisMascotasScreen';
import PrivacidadScreen         from './src/screens/Configuracion/PrivacidadScreen';
import PermisosScreen           from './src/screens/Configuracion/PermisosScreen';
import NotificacionesConfigScreen from './src/screens/Configuracion/NotificacionesScreen';
import SuscripcionesScreen      from './src/screens/Configuracion/SuscripcionesScreen';
import LegalScreen              from './src/screens/Configuracion/LegalScreen';
import AyudaSoporteScreen       from './src/screens/Configuracion/AyudaSoporteScreen';
import EliminarCuentaScreen     from './src/screens/Configuracion/EliminarCuentaScreen';
import CambiarContrasenaScreen  from './src/screens/Configuracion/CambiarContrasenaScreen';
import SesionesScreen           from './src/screens/Configuracion/SesionesScreen';
import AltaMascotaScreen        from './src/screens/Configuracion/AltaMascotaScreen';
import EditarMascotaScreen      from './src/screens/Configuracion/EditarMascotaScreen';
import EliminarMascotaScreen    from './src/screens/Configuracion/EliminarMascotaScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  // Si hay una sesión guardada (login previo), entrar directo a Home;
  // si no, mostrar el Login.
  useEffect(() => {
    (async () => {
      const userId = await loadStoredUserId();
      setInitialRoute(userId ? 'Home' : 'Login');
    })();
  }, []);

  // Latido de presencia: mantiene actualizado "última vez en línea" mientras la
  // app está abierta y lo refresca al volver del segundo plano (si se quedó
  // dormida, el último latido puede ser de hace rato).
  useEffect(() => {
    const frenar = iniciarLatidoPresencia();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') marcarPresencia(true);
    });
    return () => { frenar(); sub.remove(); };
  }, []);

  if (!initialRoute) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2DBD72" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <RootNavigator initialRoute={initialRoute} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Navegador raíz: dentro del ThemeProvider para leer "reducir movimiento" y
// desactivar las transiciones entre pantallas en toda la app cuando está activo.
function RootNavigator({ initialRoute }) {
  const { reduceMotion } = useTheme();
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'default' }}
      >
          <Stack.Screen name="Home"          component={HomeScreen} />
          <Stack.Screen name="Login"         component={LoginScreen} />
          <Stack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
          <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
          <Stack.Screen name="RegisterStep3" component={RegisterStep3Screen} />
          <Stack.Screen name="RegisterStep4" component={RegisterStep4Screen} />
          <Stack.Screen name="Comunidad"     component={ComunidadScreen} />
          <Stack.Screen name="FichaMedica" component={FichaMedicaScreen} />          
          <Stack.Screen name="MisMascotas"   component={MisMascotasScreen} />
          <Stack.Screen name="Match"         component={MatchScreen} />
          <Stack.Screen name="MatchFilters"  component={MatchFiltersScreen} />
          <Stack.Screen name="Planificador"  component={PlaceholderScreen} />
          <Stack.Screen name="Calendario"    component={CalendarioScreen} />
          <Stack.Screen name="Chat"          component={ChatScreen} />
          <Stack.Screen name="Mensajes"      component={MensajesScreen} />
          <Stack.Screen name="Eventos"       component={EventosScreen} />
          <Stack.Screen name="ChatBot"       component={VirtualVetScreen} />
          <Stack.Screen name="Closet"        component={ClosetScreen} />
          <Stack.Screen name="Perfil"        component={PerfilScreen} />
          <Stack.Screen name="Consejos" component={ConsejosScreen} />
          <Stack.Screen name="Tratamientos" component={TratamientosScreen} />
          <Stack.Screen name="Vacunas" component={VacunasScreen} />
          <Stack.Screen name="VirtualVet" component={VirtualVetScreen} />
          <Stack.Screen name="Consultas" component={ConsultasScreen} />
          <Stack.Screen name="SOS"           component={SosScreen} />
          <Stack.Screen name="VeterinariaDetalle" component={PlaceholderScreen} />
          <Stack.Screen name="Configuracion"        component={ConfiguracionScreen} />
          <Stack.Screen name="ConfigCuenta"         component={CuentaSeguridadScreen} />
          <Stack.Screen name="ConfigTema"           component={TemaScreen} />
          <Stack.Screen name="ConfigMedios"         component={MediosCalidadScreen} />
          <Stack.Screen name="ConfigTiempo"         component={TiempoAppScreen} />
          <Stack.Screen name="ConfigMascotas"       component={MisMascotasScreen} />
          <Stack.Screen name="ConfigPrivacidad"     component={PrivacidadScreen} />
          <Stack.Screen name="ConfigPermisos"       component={PermisosScreen} />
          <Stack.Screen name="ConfigNotificaciones" component={NotificacionesConfigScreen} />
          <Stack.Screen name="ConfigSuscripciones"  component={SuscripcionesScreen} />
          <Stack.Screen name="ConfigLegal"          component={LegalScreen} />
          <Stack.Screen name="ConfigAyuda"          component={AyudaSoporteScreen} />
          <Stack.Screen name="ConfigEliminarCuenta" component={EliminarCuentaScreen} />
          <Stack.Screen name="ConfigCambiarContrasena" component={CambiarContrasenaScreen} />
          <Stack.Screen name="ConfigSesiones"       component={SesionesScreen} />
          <Stack.Screen name="AltaMascota"          component={AltaMascotaScreen} />
          <Stack.Screen name="EditarMascota"        component={EditarMascotaScreen} />
          <Stack.Screen name="EliminarMascota"      component={EliminarMascotaScreen} />
          <Stack.Screen name="Notificaciones" component={PlaceholderScreen} />
        </Stack.Navigator>
      </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C8F0D8',
  },
});
