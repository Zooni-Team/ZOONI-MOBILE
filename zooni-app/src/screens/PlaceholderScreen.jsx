/**
 * PlaceholderScreen.jsx — Pantalla temporal para secciones en construcción
 *
 * Se usa como componente para todas las pantallas que todavía no están
 * implementadas (Comunidad, Match, FichaMedica, etc.).
 * Muestra el nombre de la ruta actual y un botón para volver atrás.
 *
 * Cuando una pantalla esté lista, reemplazar en App.jsx:
 *   <Stack.Screen name="Comunidad" component={PlaceholderScreen} />
 * por:
 *   <Stack.Screen name="Comunidad" component={ComunidadScreen} />
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function PlaceholderScreen() {
  const navigation = useNavigation();
  const route = useRoute(); // Permite leer el nombre de la pantalla actual

  return (
    <View style={styles.container}>
      {/* Muestra el nombre de la ruta (ej: "Comunidad", "Match") */}
      <Text style={styles.title}>{route.name}</Text>
      <Text style={styles.subtitle}>Pantalla en construcción 🚧</Text>

      {/* Vuelve a la pantalla anterior en el stack */}
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C8F0D8', // Verde menta — fondo principal de Zooni
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#27AE60' },
  subtitle: { fontSize: 16, color: '#6B6B6B' },
  btn: {
    marginTop: 16,
    backgroundColor: '#F5C842', // Amarillo dorado — botón primario
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
});
