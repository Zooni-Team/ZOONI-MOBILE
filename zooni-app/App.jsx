/**
 * App.jsx — Punto de entrada de la aplicación Zooni
 *
 * Responsabilidades:
 * - Envuelve toda la app con GestureHandlerRootView (necesario para gestos)
 * - Define el NavigationContainer con todas las pantallas registradas
 * - Al iniciar, verifica si hay un token JWT guardado:
 *     → Si hay token  → va directo a Home
 *     → Si no hay     → va a Login
 *     → En web (preview) → siempre va a Home sin verificar token
 * - Mientras verifica el token, muestra un spinner de carga
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';

import { getStoredToken } from './src/services/api';
import HomeScreen from './src/screens/HomeScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';

// Crea el navegador de tipo stack (apila pantallas una sobre otra)
const Stack = createNativeStackNavigator();

export default function App() {
  // null = todavía verificando, 'Home' o 'Login' = ruta inicial definida
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    (async () => {
      // En web, ir directo a Home para poder previsualizar sin login
      if (Platform.OS === 'web') {
        setInitialRoute('Home');
        return;
      }
      // En mobile: verificar si hay token guardado en SecureStore
      const token = await getStoredToken();
      setInitialRoute(token ? 'Home' : 'Login');
    })();
  }, []);

  // Mientras se verifica el token, mostrar spinner verde
  if (!initialRoute) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2DBD72" />
      </View>
    );
  }

  return (
    // GestureHandlerRootView es requerido por react-native-gesture-handler
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        {/* headerShown: false → cada pantalla maneja su propio header */}
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          {/* Pantalla principal — única completamente implementada */}
          <Stack.Screen name="Home" component={HomeScreen} />

          {/* Pantallas en construcción — todas usan PlaceholderScreen por ahora */}
          <Stack.Screen name="Login" component={PlaceholderScreen} />
          <Stack.Screen name="Comunidad" component={PlaceholderScreen} />
          <Stack.Screen name="FichaMedica" component={PlaceholderScreen} />
          <Stack.Screen name="MisMascotas" component={PlaceholderScreen} />
          <Stack.Screen name="Match" component={PlaceholderScreen} />
          <Stack.Screen name="Planificador" component={PlaceholderScreen} />
          <Stack.Screen name="Calendario" component={PlaceholderScreen} />
          <Stack.Screen name="Eventos" component={PlaceholderScreen} />
          <Stack.Screen name="ChatBot" component={PlaceholderScreen} />
          <Stack.Screen name="Closet" component={PlaceholderScreen} />
          <Stack.Screen name="Perfil" component={PlaceholderScreen} />
          <Stack.Screen name="Configuracion" component={PlaceholderScreen} />
          <Stack.Screen name="Notificaciones" component={PlaceholderScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Pantalla de carga inicial mientras se verifica el token
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C8F0D8',
  },
});
