/**
 * App.jsx — Punto de entrada de la aplicación Zooni
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, AppState, StyleSheet } from 'react-native';

import { loadStoredUserId, loadStoredModo, esperarSesion, haySesion, MODO_PASEADOR } from './src/config/session';
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
import ProveedorTipoScreen      from './src/screens/Paseador/ProveedorTipoScreen';
import PaseadorLoginScreen      from './src/screens/Paseador/PaseadorLoginScreen';
import PaseadorRegistroScreen   from './src/screens/Paseador/PaseadorRegistroScreen';
import PaseadorAppScreen        from './src/screens/Paseador/PaseadorAppScreen';
import PaseadorChatScreen       from './src/screens/Paseador/PaseadorChatScreen';
import PaseadorDisponibilidadScreen from './src/screens/Paseador/PaseadorDisponibilidadScreen';
import ElegirModoScreen         from './src/screens/ElegirModoScreen';
import SolicitarPaseoScreen     from './src/screens/SolicitarPaseoScreen';
import MisPaseosScreen          from './src/screens/MisPaseosScreen';
import PaseadorChatsScreen      from './src/screens/Paseador/PaseadorChatsScreen';
import { fetchRolesCuenta }     from './src/services/paseadorApi';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [initialParams, setInitialParams] = useState(undefined);

  // Con sesión guardada:
  //   · cuenta dueño + paseador → pantalla "¿Cómo querés entrar hoy?"
  //   · sólo paseador           → Zooni Paseadores
  //   · sólo dueño              → Home
  // Si los roles no se pueden consultar (sin red, o tardan más de 4 s), se usa
  // el último modo guardado para no dejar a nadie trabado en el arranque.
  // Sin sesión → Login.
  useEffect(() => {
    (async () => {
      const [userId, modo] = await Promise.all([loadStoredUserId(), loadStoredModo()]);
      if (!userId) {
        setInitialRoute('Login');
        return;
      }
      const roles = await Promise.race([
        fetchRolesCuenta(userId).catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (roles?.esDueno && roles?.esPaseador) {
        setInitialParams({ tienePerfil: roles.tienePerfil });
        setInitialRoute('ElegirModo');
      } else if (roles?.esPaseador) {
        setInitialRoute(roles.tienePerfil ? 'PaseadorApp' : 'PaseadorRegistro');
        if (!roles.tienePerfil) setInitialParams({ completar: true });
      } else if (roles) {
        setInitialRoute('Home');
      } else {
        setInitialRoute(modo === MODO_PASEADOR ? 'PaseadorApp' : 'Home');
      }
    })();
  }, []);

  // Latido de presencia: mantiene actualizado "última vez en línea" mientras la
  // app está abierta y lo refresca al volver del segundo plano (si se quedó
  // dormida, el último latido puede ser de hace rato).
  //
  // Espera a que la sesión esté restaurada ANTES de latir: este efecto corría en
  // paralelo con loadStoredUserId(), así que el primer latido salía con el id
  // que hubiera en ese momento y le escribía UltimaConexion a la cuenta
  // equivocada. Si no hay nadie logueado no late (el Login no tiene presencia).
  useEffect(() => {
    let frenar = null;
    let cancelado = false;

    esperarSesion().then(() => {
      if (cancelado || !haySesion()) return;
      frenar = iniciarLatidoPresencia();
    });

    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && haySesion()) marcarPresencia(true);
    });
    return () => { cancelado = true; frenar?.(); sub.remove(); };
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
        <RootNavigator initialRoute={initialRoute} initialParams={initialParams} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Navegador raíz: dentro del ThemeProvider para leer "reducir movimiento" y
// desactivar las transiciones entre pantallas en toda la app cuando está activo.
function RootNavigator({ initialRoute, initialParams }) {
  // Los params iniciales sólo van a la pantalla con la que arranca la app
  const p = (name) => (name === initialRoute ? initialParams : undefined);
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
          <Stack.Screen name="ElegirModo"             component={ElegirModoScreen} initialParams={p('ElegirModo')} />
          {/* Zooni Paseadores (proveedores) */}
          <Stack.Screen name="ProveedorTipo"          component={ProveedorTipoScreen} />
          <Stack.Screen name="PaseadorLogin"          component={PaseadorLoginScreen} />
          <Stack.Screen name="PaseadorRegistro"       component={PaseadorRegistroScreen} initialParams={p('PaseadorRegistro')} />
          <Stack.Screen name="PaseadorApp"            component={PaseadorAppScreen} />
          <Stack.Screen name="PaseadorChat"           component={PaseadorChatScreen} />
          <Stack.Screen name="PaseadorDisponibilidad" component={PaseadorDisponibilidadScreen} />
          <Stack.Screen name="PaseadorChats"          component={PaseadorChatsScreen} />
          {/* Lado dueño de los paseos */}
          <Stack.Screen name="SolicitarPaseo"         component={SolicitarPaseoScreen} />
          <Stack.Screen name="MisPaseos"              component={MisPaseosScreen} />
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
