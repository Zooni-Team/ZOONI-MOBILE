/**
 * CambiarContrasenaScreen.jsx — Cuenta y Seguridad › Cambiar contraseña (§3.5.1)
 *
 * Una de las TRES pantallas con botón Guardar explícito (junto con cambio de
 * email y eliminar cuenta). Medidor de fuerza débil / media / fuerte.
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { SettingsGroup, SettingsScreen, T } from '../../components/settings/SettingsKit';
import { cambiarMiContrasena } from '../../services/perfilApi';
import AppDialog from '../../components/AppDialog';

function fuerza(pass) {
  if (pass.length < 8) return { nivel: 'debil', label: 'Débil', color: T.sosRedText, ratio: 0.33 };
  const variedad =
    (/[a-z]/.test(pass) ? 1 : 0) + (/[A-Z]/.test(pass) ? 1 : 0) +
    (/[0-9]/.test(pass) ? 1 : 0) + (/[^a-zA-Z0-9]/.test(pass) ? 1 : 0);
  if (pass.length >= 12 && variedad >= 3) return { nivel: 'fuerte', label: 'Fuerte', color: T.brandText, ratio: 1 };
  if (variedad >= 2) return { nivel: 'media', label: 'Media', color: T.amberText, ratio: 0.66 };
  return { nivel: 'debil', label: 'Débil', color: T.sosRedText, ratio: 0.33 };
}

export default function CambiarContrasenaScreen() {
  const navigation = useNavigation();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [errorActual, setErrorActual] = useState(false);
  const [dialogo, setDialogo] = useState(null);

  const f = useMemo(() => fuerza(nueva), [nueva]);
  const valido = actual.length >= 1 && nueva.length >= 8 && nueva === repetir && !guardando;

  const guardar = async () => {
    setGuardando(true);
    setErrorActual(false);
    try {
      const ok = await cambiarMiContrasena(actual, nueva);
      setGuardando(false);
      if (!ok) {
        setErrorActual(true);
        return;
      }
      setDialogo({
        titulo: 'Contraseña actualizada',
        mensaje: 'Ya podés usar tu contraseña nueva.',
        botones: [{ texto: 'Listo', estilo: 'primary', onPress: () => navigation.goBack() }],
      });
    } catch {
      setGuardando(false);
      setDialogo({
        titulo: 'No pudimos cambiar la contraseña',
        mensaje: 'Revisá tu conexión y probá de nuevo.',
        botones: [{ texto: 'Entendido', estilo: 'primary' }],
      });
    }
  };

  return (
    <SettingsScreen title="Cambiar contraseña">

      <SettingsGroup>
        <View style={s.campo}>
          <Text style={s.label}>Contraseña actual</Text>
          <TextInput style={[s.input, errorActual && { borderColor: T.sosRedText }]}
            value={actual} onChangeText={(v) => { setActual(v); setErrorActual(false); }}
            secureTextEntry placeholder="••••••••" placeholderTextColor={T.textSoft} />
          {errorActual && <Text style={s.errorTxt}>La contraseña actual no es correcta.</Text>}
        </View>
        <View style={s.campo}>
          <Text style={s.label}>Nueva contraseña</Text>
          <TextInput style={s.input} value={nueva} onChangeText={setNueva}
            secureTextEntry placeholder="Mínimo 8 caracteres" placeholderTextColor={T.textSoft} />
          {nueva.length > 0 && (
            <View style={s.fuerzaWrap}>
              <View style={s.fuerzaTrack}>
                <View style={[s.fuerzaFill, { width: `${f.ratio * 100}%`, backgroundColor: f.color }]} />
              </View>
              <Text style={[s.fuerzaTxt, { color: f.color }]}>{f.label}</Text>
            </View>
          )}
        </View>
        <View style={s.campo}>
          <Text style={s.label}>Repetir nueva contraseña</Text>
          <TextInput style={s.input} value={repetir} onChangeText={setRepetir}
            secureTextEntry placeholder="••••••••" placeholderTextColor={T.textSoft} />
          {repetir.length > 0 && nueva !== repetir && (
            <Text style={s.errorTxt}>Las contraseñas no coinciden.</Text>
          )}
        </View>
      </SettingsGroup>

      <TouchableOpacity
        style={[s.btnGuardar, !valido && { opacity: 0.45 }]}
        disabled={!valido}
        onPress={guardar}
        accessibilityRole="button" accessibilityLabel="Guardar"
        accessibilityState={{ disabled: !valido }}
      >
        {guardando
          ? <ActivityIndicator size="small" color={T.text} />
          : <Text style={s.btnGuardarTxt}>Guardar</Text>}
      </TouchableOpacity>

      <AppDialog
        visible={!!dialogo}
        titulo={dialogo?.titulo}
        mensaje={dialogo?.mensaje}
        botones={dialogo?.botones ?? []}
        onCerrar={() => setDialogo(null)}
      />

    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  campo: { paddingHorizontal: 16, paddingVertical: 12 },
  label: { fontSize: 14, fontWeight: '600', color: T.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: T.divider, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: T.text,
  },

  fuerzaWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  fuerzaTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: T.switchOff },
  fuerzaFill:  { height: 4, borderRadius: 2 },
  fuerzaTxt:   { fontSize: 13, fontWeight: '700' },

  errorTxt: { fontSize: 13, color: T.sosRedText, marginTop: 6 },

  btnGuardar: {
    backgroundColor: T.cta, borderRadius: 30, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  btnGuardarTxt: { fontSize: 16, fontWeight: '700', color: T.text },
});
