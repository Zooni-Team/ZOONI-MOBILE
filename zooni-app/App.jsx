/**
 * App.jsx — Punto de entrada de la aplicación Zooni
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { loadStoredUserId } from './src/config/session';
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
import EventosScreen     from './src/screens/EventosScreen';
import CalendarioScreen  from './src/screens/CalendarioScreen';
import ChatScreen        from './src/screens/ChatScreen';

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

  if (!initialRoute) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2DBD72" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Home"          component={HomeScreen} />
          <Stack.Screen name="Login"         component={LoginScreen} />
          <Stack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
          <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
          <Stack.Screen name="RegisterStep3" component={RegisterStep3Screen} />
          <Stack.Screen name="RegisterStep4" component={RegisterStep4Screen} />
          <Stack.Screen name="Comunidad"     component={ComunidadScreen} />
          <Stack.Screen name="FichaMedica" component={FichaMedicaScreen} />          
          <Stack.Screen name="MisMascotas"   component={PlaceholderScreen} />
          <Stack.Screen name="Match"         component={MatchScreen} />
          <Stack.Screen name="MatchFilters"  component={MatchFiltersScreen} />
          <Stack.Screen name="Planificador"  component={PlaceholderScreen} />
          <Stack.Screen name="Calendario"    component={CalendarioScreen} />
          <Stack.Screen name="Chat"          component={ChatScreen} />
          <Stack.Screen name="Eventos"       component={EventosScreen} />
          <Stack.Screen name="ChatBot"       component={PlaceholderScreen} />
          <Stack.Screen name="Closet"        component={ClosetScreen} />
          <Stack.Screen name="Perfil"        component={PlaceholderScreen} />
          <Stack.Screen name="Consejos" component={ConsejosScreen} />
          <Stack.Screen name="Tratamientos" component={TratamientosScreen} />
          <Stack.Screen name="Vacunas" component={VacunasScreen} />
          <Stack.Screen name="Configuracion" component={PlaceholderScreen} />
          <Stack.Screen name="Notificaciones" component={PlaceholderScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
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
