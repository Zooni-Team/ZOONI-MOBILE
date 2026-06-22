/**
 * VirtualVetScreen.jsx — Pantalla "Virtual Vet" (próximamente)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function VirtualVetScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🐾</Text>
      <Text style={styles.title}>Virtual Vet</Text>
      <Text style={styles.subtitle}>Próximamente</Text>
      <Text style={styles.desc}>
        Consultá con nuestra IA veterinaria{'\n'}disponible las 24 horas.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C8F0D8', gap: 10, paddingHorizontal: 32 },
  emoji:    { fontSize: 56, marginBottom: 4 },
  title:    { fontSize: 24, fontWeight: '800', color: '#2C2C2C' },
  subtitle: { fontSize: 18, fontWeight: '700', color: '#2DBD72' },
  desc:     { fontSize: 15, color: '#6B6B6B', textAlign: 'center', lineHeight: 22 },
  btn: { marginTop: 20, backgroundColor: '#F5C842', borderRadius: 30, paddingHorizontal: 28, paddingVertical: 14 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
});
