/**
 * BotonesSociales.jsx — "Continuar con Google / Facebook / Apple"
 *
 * Los mismos tres botones en el login de dueños, el de paseadores y el
 * registro de paseador. `intencion` ('dueno' | 'paseador') decide a qué
 * registro se sigue si la cuenta es nueva (ver services/socialAuthApi.js).
 * Al tocar uno, la página se va al proveedor y vuelve sola a la app.
 *
 * Props: intencion · titulo (texto arriba de los botones, opcional)
 */

import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { APPLE_ICON, FACEBOOK_ICON, GOOGLE_ICON } from '../constants/registroImages';
import { PROVEEDORES, iniciarConProveedor, loginSocialDisponible } from '../services/socialAuthApi';
import { alerta } from '../utils/dialogo';

const ICONOS = { google: GOOGLE_ICON, facebook: FACEBOOK_ICON, apple: APPLE_ICON };

export default function BotonesSociales({ intencion = 'dueno', titulo }) {
  const [yendo, setYendo] = useState(null); // proveedor al que se está redirigiendo
  const [error, setError] = useState(null);

  const entrar = async (proveedor) => {
    if (yendo) return;
    if (!loginSocialDisponible) {
      alerta('Próximamente en la app', `Por ahora podés entrar con ${PROVEEDORES[proveedor].nombre} desde la versión web de Zooni.`);
      return;
    }
    setError(null);
    setYendo(proveedor);
    try {
      await iniciarConProveedor(proveedor, intencion);
      // Si todo va bien, el navegador ya se está yendo al proveedor
    } catch (err) {
      console.error('[Login social]', err?.message ?? err);
      setYendo(null);
      setError(/provider is not enabled|Unsupported provider/i.test(String(err?.message))
        ? `${PROVEEDORES[proveedor].nombre} todavía no está habilitado en Zooni.`
        : 'No se pudo abrir el inicio de sesión. Probá de nuevo.');
    }
  };

  return (
    <View style={s.wrap}>
      {titulo ? (
        <View style={s.tituloFila}>
          <View style={s.linea} />
          <Text style={s.titulo}>{titulo}</Text>
          <View style={s.linea} />
        </View>
      ) : null}
      <View style={s.fila}>
        {Object.keys(PROVEEDORES).map((p) => (
          <TouchableOpacity key={p} style={s.btn} onPress={() => entrar(p)} disabled={!!yendo} activeOpacity={0.8}
            accessibilityRole="button" accessibilityLabel={`Continuar con ${PROVEEDORES[p].nombre}`}>
            {yendo === p
              ? <ActivityIndicator color="#6B6B6B" />
              : <Image source={ICONOS[p]} style={s.icono} resizeMode="contain" />}
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 16, alignItems: 'center' },
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginBottom: 12 },
  linea: { flex: 1, height: 1, backgroundColor: '#E6E6E6' },
  titulo: { fontSize: 13, color: '#6B6B6B', fontWeight: '600' },
  fila: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
  btn: {
    width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: '#E6E6E6', backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  icono: { width: 30, height: 30 },
  error: { fontSize: 13, color: '#E63946', textAlign: 'center', marginTop: 10 },
});
