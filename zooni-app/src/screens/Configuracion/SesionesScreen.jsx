/**
 * SesionesScreen.jsx — Cuenta y Seguridad › Sesiones activas (§3.5.1)
 *
 * La sesión actual se marca "Este dispositivo" y no se puede cerrar desde acá.
 */

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SettingsGroup, SettingsScreen, T } from '../../components/settings/SettingsKit';

const SESIONES_DEMO = [
  { id: 1, dispositivo: 'Este dispositivo',  detalle: 'Windows · Buenos Aires',        actual: true },
  { id: 2, dispositivo: 'iPhone 14',          detalle: 'Buenos Aires · hace 2 horas',   actual: false },
  { id: 3, dispositivo: 'Samsung Galaxy S23', detalle: 'Buenos Aires · hace 1 día',     actual: false },
  { id: 4, dispositivo: 'iPad',               detalle: 'Mar del Plata · hace 12 días',  actual: false },
];

export default function SesionesScreen() {
  const [sesiones, setSesiones] = useState(SESIONES_DEMO);

  const cerrar = (sesion) => {
    Alert.alert(
      `¿Cerrar la sesión de ${sesion.dispositivo}?`,
      'Ese dispositivo va a tener que volver a iniciar sesión.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión', style: 'destructive',
          onPress: () => setSesiones((prev) => prev.filter((x) => x.id !== sesion.id)),
        },
      ]
    );
  };

  return (
    <SettingsScreen title="Sesiones activas">
      <SettingsGroup>
        {sesiones.map((sesion) => (
          <View key={sesion.id} style={s.fila}>
            <Ionicons
              name={sesion.dispositivo.includes('iPad') ? 'tablet-portrait-outline'
                : sesion.actual ? 'desktop-outline' : 'phone-portrait-outline'}
              size={22} color={T.text} style={{ width: 30 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.nombre}>{sesion.dispositivo}</Text>
              <Text style={s.detalle}>{sesion.detalle}</Text>
            </View>
            {sesion.actual ? (
              <View style={s.chipActual}>
                <Text style={s.chipActualTxt}>Actual</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => cerrar(sesion)} accessibilityRole="button"
                accessibilityLabel={`Cerrar sesión de ${sesion.dispositivo}`}>
                <Text style={s.cerrarTxt}>Cerrar sesión</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </SettingsGroup>
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  fila: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
  },
  nombre:  { fontSize: 16, fontWeight: '600', color: T.text },
  detalle: { fontSize: 13, color: T.textSoft, marginTop: 2 },
  chipActual: {
    backgroundColor: '#E8F7EE', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  chipActualTxt: { fontSize: 12, fontWeight: '700', color: T.brandText },
  cerrarTxt: { fontSize: 14, fontWeight: '700', color: T.sosRedText },
});
