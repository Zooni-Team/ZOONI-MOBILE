/**
 * SuscripcionesScreen.jsx — Configuración › Suscripciones y pagos (§3.5.9)
 *
 * La fuente de verdad del plan son los webhooks de la tienda, nunca el
 * cliente. Acá se muestra el estado y se deriva a la tienda para administrar.
 */

import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  SettingsAction, SettingsGroup, SettingsRow, SettingsScreen, T,
} from '../../components/settings/SettingsKit';

const proximamente = () => Alert.alert('Próximamente', 'Esta opción va a estar disponible en una próxima versión.');

const BENEFICIOS_PLUS = [
  'Match ilimitado y filtros avanzados',
  'Ficha médica con historial completo',
  'Sin publicidad en la comunidad',
];

export default function SuscripcionesScreen() {
  return (
    <SettingsScreen title="Suscripciones y pagos">

      {/* Card de plan actual (destacada, borde --cta) */}
      <View style={s.planCard}>
        <Text style={s.planNombre}>Plan Free</Text>
        <Text style={s.planEstado}>Activo</Text>
        <View style={{ marginTop: 10, gap: 6 }}>
          {BENEFICIOS_PLUS.map((b) => (
            <View key={b} style={s.beneficio}>
              <Ionicons name="checkmark-circle" size={18} color={T.brandText} />
              <Text style={s.beneficioTxt}>{b}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={s.planBtn} onPress={proximamente}
          accessibilityRole="button" accessibilityLabel="Conocer Zooni Plus">
          <Text style={s.planBtnTxt}>Conocer Zooni Plus</Text>
        </TouchableOpacity>
      </View>

      <SettingsGroup label="Pagos">
        <SettingsRow label="Métodos de pago" value="•••• 4242" onPress={proximamente} />
        <SettingsRow label="Historial de facturación" onPress={proximamente} />
        <SettingsAction label="Restaurar compras" onPress={proximamente} />
        <SettingsRow label="Códigos y cupones" onPress={proximamente} />
      </SettingsGroup>

      <SettingsGroup label="Servicios">
        <SettingsRow label="Pagos a veterinarias y paseadores" onPress={proximamente} />
        <SettingsRow label="Facturación" onPress={proximamente} />
      </SettingsGroup>

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  planCard: {
    backgroundColor: T.surface, borderRadius: 18, borderWidth: 2, borderColor: T.cta,
    padding: 18, marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  planNombre: { fontSize: 20, fontWeight: '800', color: T.text },
  planEstado: { fontSize: 14, color: T.brandText, fontWeight: '700', marginTop: 2 },
  beneficio:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  beneficioTxt: { fontSize: 14, color: T.textSoft, flex: 1 },
  planBtn: {
    backgroundColor: T.cta, borderRadius: 30, height: 48,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  planBtnTxt: { fontSize: 16, fontWeight: '700', color: T.text },
});
