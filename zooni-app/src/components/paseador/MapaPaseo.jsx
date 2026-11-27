import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from './PaseadorUI';
import { colores } from '../../theme';
import { CENTRO_MAPA, MAPA_PASEO_HTML } from '../mapas/mapasHtml';

export default function MapaPaseo({
  centro = CENTRO_MAPA, posicion = null, destino = null, ruta = [],
  seguir = false, interactivo = true, style, apiRef,
}) {
  const iframeRef = useRef(null);
  const datos = { centro, posicion, destino, ruta, seguir, interactivo };
  const datosRef = useRef(datos);
  datosRef.current = datos;

  const enviar = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { tipo: 'zooni-cmd', metodo: 'set', args: [datosRef.current] }, '*',
    );
  }, []);

  const firma = JSON.stringify([posicion, destino, ruta.length, ruta[ruta.length - 1], seguir, interactivo]);
  useEffect(() => { enviar(); }, [firma, enviar]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      centrar: (lat, lng) => iframeRef.current?.contentWindow?.postMessage(
        { tipo: 'zooni-cmd', metodo: 'centrar', args: [lat, lng] }, '*',
      ),
    };
  }, [apiRef]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[s.fallback, style]}>
        <Ionicons name="map-outline" size={44} color={C.teal} />
        <Text style={s.fallbackTxt}>Mapa disponible en la versión web</Text>
      </View>
    );
  }

  return (
    <View style={[s.wrap, style]}>
      <iframe
        ref={iframeRef}
        srcDoc={MAPA_PASEO_HTML}
        onLoad={enviar}
        sandbox="allow-scripts"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Mapa del paseo"
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colores.mentaSuave },
  fallback: {
    backgroundColor: colores.mentaSuave, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  fallbackTxt: { fontSize: 13, color: C.texto2, fontWeight: '600' },
});
