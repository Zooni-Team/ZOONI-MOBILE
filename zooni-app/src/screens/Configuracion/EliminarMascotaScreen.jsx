/**
 * EliminarMascotaScreen.jsx — Eliminar una mascota (Instruction-MisMascotas §4.4)
 *
 * Nunca un diálogo simple: pantalla dedicada con confirmación escrita
 * (insensible a mayúsculas y tildes), checkbox, alternativa de archivado
 * antes de la confirmación, y 30 días de gracia vía soporte (sin Deshacer).
 */

import React, { useMemo, useState } from 'react';
import {
  Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { SettingsScreen } from '../../components/settings/SettingsKit';
import { resolveMascotaVisual } from '../../constants/petImages';
import { archivarMascota, eliminarMascota } from '../../services/petsApi';
import { alerta } from '../../utils/dialogo';

const P = {
  text: '#2C2C2C', textSoft: '#6B6B6B', textSoftMint: '#5A6B60',
  brandText: '#177046', sosRedText: '#B3121D', sosRedTint: '#FDECEE',
  divider: '#E8EFE9', ringArchived: '#7E9089',
};

const SE_BORRA = [
  'Su perfil y todas sus fotos',
  'Su ficha médica y el historial de vacunas',
  'Su historial de paseos y recorridos',
  'Sus matches y conversaciones asociadas',
  'Su historial de peso y controles',
];

// Comparación insensible a mayúsculas y tildes (§4.4)
function normalizar(str) {
  return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function EliminarMascotaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const mascota = route.params?.mascota;

  const [confirmacion, setConfirmacion] = useState('');
  const [entiendo, setEntiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const nombreOk = useMemo(
    () => mascota && normalizar(confirmacion) === normalizar(mascota.nombre),
    [confirmacion, mascota]
  );
  const puedeEliminar = nombreOk && entiendo && !guardando;

  if (!mascota) {
    navigation.goBack();
    return null;
  }

  const img = resolveMascotaVisual(mascota);

  const archivarEnVez = async () => {
    try {
      await archivarMascota(mascota.id);
      navigation.goBack();
    } catch {
      alerta(`No pudimos archivar a ${mascota.nombre}`, 'Probá de nuevo en un rato.');
    }
  };

  const eliminar = async () => {
    setGuardando(true);
    try {
      await eliminarMascota(mascota.id);
      alerta(
        `${mascota.nombre} se eliminó`,
        'Tenés 30 días para recuperarla escribiéndonos a soporte. Después se borra definitivamente.'
      );
      navigation.goBack();
    } catch {
      setGuardando(false);
      alerta(`No pudimos eliminar a ${mascota.nombre}`, 'Probá de nuevo en un rato.');
    }
  };

  return (
    <SettingsScreen title={`Eliminar a ${mascota.nombre}`}>

      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <Image source={img} style={s.avatar} resizeMode="cover" />
      </View>

      {/* Qué se borra */}
      <View style={s.bloqueRojo}>
        <Text style={s.bloqueRojoTitulo}>Qué se borra</Text>
        {SE_BORRA.map((item) => (
          <View key={item} style={s.bloqueFila}>
            <Ionicons name="close-circle" size={16} color={P.sosRedText} />
            <Text style={s.bloqueFilaTxt}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Alternativa: archivar — va ANTES de la confirmación (§4.4) */}
      <View style={s.alternativa}>
        <Text style={s.alternativaTitulo}>¿Preferís archivarla?</Text>
        <Text style={s.alternativaTxt}>
          Si la archivás no perdés nada y podés recuperarla cuando quieras.
        </Text>
        <TouchableOpacity style={s.btnArchivar} onPress={archivarEnVez}
          accessibilityRole="button" accessibilityLabel="Archivar en vez de eliminar">
          <Ionicons name="archive-outline" size={16} color="#FFF" />
          <Text style={s.btnArchivarTxt}>Archivar en vez de eliminar</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmación escrita */}
      <Text style={s.confirmLabel}>Escribí "{mascota.nombre}" para confirmar</Text>
      <TextInput
        style={[
          s.confirmInput,
          confirmacion.length > 0 && { borderColor: nombreOk ? P.brandText : P.sosRedText },
        ]}
        value={confirmacion}
        onChangeText={setConfirmacion}
        placeholder={mascota.nombre}
        placeholderTextColor={P.textSoft}
        autoCapitalize="none"
      />

      <TouchableOpacity style={s.checkRow} onPress={() => setEntiendo((v) => !v)}
        accessibilityRole="checkbox" accessibilityState={{ checked: entiendo }}
        accessibilityLabel="Entiendo que esto no se puede deshacer">
        <Ionicons name={entiendo ? 'checkbox' : 'square-outline'} size={22}
          color={entiendo ? P.sosRedText : P.ringArchived} />
        <Text style={s.checkTxt}>Entiendo que esto no se puede deshacer.</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.btnEliminar, !puedeEliminar && { opacity: 0.45 }]}
        disabled={!puedeEliminar}
        onPress={eliminar}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar a ${mascota.nombre}`}
        accessibilityState={{ disabled: !puedeEliminar }}
      >
        <Text style={s.btnEliminarTxt}>Eliminar a {mascota.nombre}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btnCancelar} onPress={() => navigation.goBack()}
        accessibilityRole="button" accessibilityLabel="Cancelar">
        <Text style={s.btnCancelarTxt}>Cancelar</Text>
      </TouchableOpacity>

      <Text style={s.gracia}>
        Tenés 30 días para recuperarla escribiéndonos a soporte. Después se borra definitivamente.
      </Text>

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  avatar: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: P.ringArchived,
    opacity: 0.75,
  },

  bloqueRojo: {
    backgroundColor: P.sosRedTint, borderRadius: 16, padding: 16, marginTop: 20, gap: 8,
  },
  bloqueRojoTitulo: { fontSize: 15, fontWeight: '700', color: P.sosRedText },
  bloqueFila:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bloqueFilaTxt:    { flex: 1, fontSize: 14, color: P.text },

  alternativa: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  alternativaTitulo: { fontSize: 15, fontWeight: '700', color: P.text },
  alternativaTxt:    { fontSize: 13, color: P.textSoft, marginTop: 4, lineHeight: 18 },
  btnArchivar: {
    height: 44, borderRadius: 22, backgroundColor: P.brandText, marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnArchivarTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  confirmLabel: { fontSize: 14, fontWeight: '600', color: P.text, marginTop: 24, marginBottom: 8 },
  confirmInput: {
    height: 48, borderWidth: 1.5, borderColor: P.divider, borderRadius: 12,
    paddingHorizontal: 14, fontSize: 15, color: P.text, backgroundColor: '#FFF',
  },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: 44, marginTop: 12,
  },
  checkTxt: { flex: 1, fontSize: 14, color: P.text },

  btnEliminar: {
    height: 52, borderRadius: 26, backgroundColor: '#FFF',
    borderWidth: 2, borderColor: P.sosRedText,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  btnEliminarTxt: { fontSize: 16, fontWeight: '700', color: P.sosRedText },

  btnCancelar:    { alignItems: 'center', paddingVertical: 14 },
  btnCancelarTxt: { fontSize: 15, fontWeight: '700', color: P.textSoft },

  gracia: { fontSize: 13, color: P.textSoftMint, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
});
