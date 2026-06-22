/**
 * App.jsx — Punto de entrada de la aplicación Zooni
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';

import { getStoredToken } from './src/services/api';

// ── Pantallas implementadas ───────────────────────────────────────────────────
import HomeScreen          from './src/screens/HomeScreen';
import MatchScreen         from './src/screens/MatchScreen';
import MatchFiltersScreen  from './src/screens/MatchFiltersScreen';
import ComunidadScreen     from './src/screens/Comunidad/ComunidadScreen';
import FichaMedicaScreen   from './src/screens/FichaMedicaScreen';
import ConsejosScreen      from './src/screens/ConsejosScreen';
import VacunasScreen       from './src/screens/VacunasScreen';
import TratamientosScreen  from './src/screens/TratamientosScreen';
import VirtualVetScreen    from './src/screens/VirtualVetScreen';

// ── Pantallas placeholder (en construcción) ───────────────────────────────────
import PlaceholderScreen   from './src/screens/PlaceholderScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(
    Platform.OS === 'web' ? 'Home' : null
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const token = await getStoredToken();
      setInitialRoute(token ? 'Home' : 'Login');
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
          {/* ── Autenticación ── */}
          <Stack.Screen name="Login"           component={PlaceholderScreen} />

          {/* ── Pantallas principales ── */}
          <Stack.Screen name="Home"            component={HomeScreen} />
          <Stack.Screen name="Comunidad"       component={ComunidadScreen} />
          <Stack.Screen name="Match"           component={MatchScreen} />
          <Stack.Screen name="MatchFilters"    component={MatchFiltersScreen} />

          {/* ── Ficha Médica y subpantallas ── */}
          <Stack.Screen name="FichaMedica"     component={FichaMedicaScreen} />
          <Stack.Screen name="VirtualVet"      component={VirtualVetScreen} />
          <Stack.Screen name="Vacunas"         component={VacunasScreen} />
          <Stack.Screen name="Tratamientos"    component={TratamientosScreen} />
          <Stack.Screen name="Consejos"        component={ConsejosScreen} />

          {/* ── Otras secciones (en construcción) ── */}
          <Stack.Screen name="MisMascotas"     component={PlaceholderScreen} />
          <Stack.Screen name="Planificador"    component={PlaceholderScreen} />
          <Stack.Screen name="Calendario"      component={PlaceholderScreen} />
          <Stack.Screen name="Eventos"         component={PlaceholderScreen} />
          <Stack.Screen name="ChatBot"         component={PlaceholderScreen} />
          <Stack.Screen name="Closet"          component={PlaceholderScreen} />
          <Stack.Screen name="Perfil"          component={PlaceholderScreen} />
          <Stack.Screen name="Configuracion"   component={PlaceholderScreen} />
          <Stack.Screen name="Notificaciones"  component={PlaceholderScreen} />
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
