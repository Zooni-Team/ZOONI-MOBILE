/**
 * PaseadorTabBar.jsx — Bottom nav de Zooni Paseadores
 *
 * Igual que la de Zooni: fondo blanco, tab activo en verde teal con label
 * bold, inactivos en gris claro. El tab "Paseo" muestra un punto rojo mientras
 * hay un paseo en curso, y "Solicitudes" un badge ámbar con las pendientes.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from './PaseadorUI';

export const TABS_PASEADOR = [
  { key: 'inicio', label: 'Inicio', icono: 'home' },
  { key: 'solicitudes', label: 'Solicitudes', icono: 'file-tray-full' },
  { key: 'paseo', label: 'Paseo', icono: 'walk' },
  { key: 'ganancias', label: 'Ganancias', icono: 'wallet' },
  { key: 'perfil', label: 'Perfil', icono: 'person' },
];

export default function PaseadorTabBar({ activo, onCambiar, pendientes = 0, enCurso = false }) {
  return (
    <View style={s.bar}>
      {TABS_PASEADOR.map((t) => {
        const on = t.key === activo;
        const color = on ? C.teal : C.gris;
        return (
          <TouchableOpacity
            key={t.key}
            style={s.tab}
            onPress={() => onCambiar(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
          >
            <View>
              <Ionicons name={on ? t.icono : `${t.icono}-outline`} size={24} color={color} />
              {t.key === 'solicitudes' && pendientes > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>{pendientes > 9 ? '9+' : pendientes}</Text>
                </View>
              )}
              {t.key === 'paseo' && enCurso && <View style={s.enVivo} />}
            </View>
            <Text style={[s.label, { color }, on && s.labelOn]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', paddingTop: 8, paddingBottom: 8,
    borderTopWidth: 1, borderTopColor: C.borde,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  label: { fontSize: 11, marginTop: 3, fontWeight: '500' },
  labelOn: { fontWeight: '800' },
  badge: {
    position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: C.ambar, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  badgeTxt: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  enVivo: {
    position: 'absolute', top: -2, right: -4, width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.rojo, borderWidth: 2, borderColor: '#FFFFFF',
  },
});
