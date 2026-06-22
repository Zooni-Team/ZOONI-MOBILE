/**
 * VacunasScreen.jsx — Pantalla de Vacunas (en desarrollo)
 * Recibe route.params.petId
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function VacunasScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const petId = route.params?.petId;

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>💉</Text>
      <Text style={styles.title}>Vacunas</Text>
      <Text style={styles.subtitle}>Pantalla en desarrollo 🚧</Text>
      {petId && <Text style={styles.petId}>Pet ID: {petId}</Text>}
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C8F0D8', gap: 10 },
  emoji:    { fontSize: 48 },
  title:    { fontSize: 24, fontWeight: '800', color: '#2C2C2C' },
  subtitle: { fontSize: 15, color: '#6B6B6B' },
  petId:    { fontSize: 12, color: '#AAAAAA' },
  btn: { marginTop: 16, backgroundColor: '#F5C842', borderRadius: 30, paddingHorizontal: 28, paddingVertical: 14 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
});
