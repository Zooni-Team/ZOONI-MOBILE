import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from './PaseadorUI';
import { barrioDe, buscarLugar } from '../../services/geocodificacion';
import { colores } from '../../theme';
import { CENTRO_MAPA, MAPA_ZONA_HTML } from '../mapas/mapasHtml';

export const RADIO_MIN = 0.5;
export const RADIO_MAX = 30;

export function radioValido(texto) {
  const n = Number(String(texto ?? '').replace(',', '.'));
  if (!String(texto ?? '').trim() || !Number.isFinite(n)) return null;
  return n >= RADIO_MIN && n <= RADIO_MAX ? Math.round(n * 10) / 10 : null;
}

function sanitizarKm(v) {
  const limpio = v.replace(/[^0-9.,]/g, '').replace(',', '.');
  const [ent, ...resto] = limpio.split('.');
  const entero = ent.slice(0, 2);
  return resto.length ? `${entero}.${resto.join('').slice(0, 1)}` : entero;
}

const formatoKm = (n) => (n == null ? '' : String(n).replace('.', ','));

function obtenerGps() {
  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null;
    if (!geo) return resolve(null);
    geo.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  });
}

export default function ZonaMapaPicker({ valor, onCambio, baseTexto, conRadio = true }) {
  const iframeRef = useRef(null);
  const valorRef = useRef(valor);
  valorRef.current = valor;
  const onCambioRef = useRef(onCambio);
  onCambioRef.current = onCambio;

  const [busqueda, setBusqueda] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [nombrando, setNombrando] = useState(false);
  const [error, setError] = useState(null);
  const [radioTexto, setRadioTexto] = useState(formatoKm(valor?.radioKm));

  useEffect(() => {
    if (radioValido(radioTexto) !== (valor?.radioKm ?? null)) setRadioTexto(formatoKm(valor?.radioKm));
  }, [valor?.radioKm]);

  const cambiarRadio = (texto) => {
    setRadioTexto(texto);
    onCambio({ ...valorRef.current, radioKm: radioValido(texto) });
  };
  const pasoRadio = (delta) => {
    const actual = radioValido(radioTexto) ?? 0;
    const nuevo = Math.min(RADIO_MAX, Math.max(RADIO_MIN, Math.round((actual + delta) * 10) / 10));
    cambiarRadio(formatoKm(nuevo));
  };
  const radioFueraDeRango = radioTexto.trim() !== '' && radioValido(radioTexto) == null;

  const enviarAlMapa = useCallback((mover, v = valorRef.current) => {
    if (v?.lat == null) return;
    iframeRef.current?.contentWindow?.postMessage(
      { tipo: 'zooni-cmd', metodo: 'set', args: [v, mover] }, '*',
    );
  }, []);

  const moverA = useCallback(async ({ lat, lng }, { mover = false, zona } = {}) => {
    const nuevo = { ...valorRef.current, lat, lng, ...(zona ? { zona } : {}) };
    valorRef.current = nuevo;
    onCambioRef.current(nuevo);
    if (mover) enviarAlMapa(true, nuevo);
    if (zona) return;
    setNombrando(true);
    const barrio = await barrioDe(lat, lng);
    setNombrando(false);
    const sigue = valorRef.current?.lat === lat && valorRef.current?.lng === lng;
    if (barrio && sigue) {
      valorRef.current = { ...valorRef.current, zona: barrio };
      onCambioRef.current(valorRef.current);
    }
  }, [enviarAlMapa]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.tipo === 'zooni-zona-evento') moverA(e.data.payload);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [moverA]);

  useEffect(() => {
    if (valorRef.current?.lat != null) return;
    let vivo = true;
    (async () => {
      let base = baseTexto ? await buscarLugar(baseTexto) : null;
      if (!base) base = await obtenerGps();
      if (!vivo) return;
      moverA(base ?? CENTRO_MAPA, { mover: true });
    })();
    return () => { vivo = false; };
  }, []);

  useEffect(() => { enviarAlMapa(true); }, [valor?.radioKm, enviarAlMapa]);

  const buscar = async () => {
    const q = busqueda.trim();
    if (q.length < 3) return;
    setBuscando(true);
    setError(null);
    const lugar = await buscarLugar(q);
    setBuscando(false);
    if (!lugar) {
      setError('No encontramos ese lugar. Probá con "barrio, ciudad".');
      return;
    }
    setBusqueda('');
    moverA(lugar, { mover: true });
  };

  const usarGps = async () => {
    setBuscando(true);
    const p = await obtenerGps();
    setBuscando(false);
    if (p) moverA(p, { mover: true });
    else setError('No pudimos obtener tu ubicación. Activá el permiso o buscá tu barrio.');
  };

  return (
    <View>
      <View style={s.buscador}>
        <Ionicons name="search" size={18} color={C.texto2} />
        <TextInput
          style={s.buscadorInput}
          value={busqueda}
          onChangeText={(v) => { setBusqueda(v); setError(null); }}
          placeholder="Buscá tu barrio (ej: Palermo)"
          placeholderTextColor={C.gris}
          returnKeyType="search"
          onSubmitEditing={buscar}
        />
        {buscando ? <ActivityIndicator size="small" color={C.teal} /> : (
          <TouchableOpacity onPress={usarGps} hitSlop={8} accessibilityLabel="Usar mi ubicación">
            <Ionicons name="locate" size={20} color={C.teal} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={s.error}>{error}</Text>}

      {Platform.OS === 'web' ? (
        <View style={s.mapa}>
          <iframe
            ref={iframeRef}
            srcDoc={MAPA_ZONA_HTML}
            onLoad={() => enviarAlMapa(true)}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            title="Zona de atención"
          />
        </View>
      ) : (
        <View style={[s.mapa, s.sinMapa]}>
          <Ionicons name="map-outline" size={36} color={C.teal} />
          <Text style={s.sinMapaTxt}>Buscá tu barrio arriba: el mapa está disponible en la versión web.</Text>
        </View>
      )}
      <Text style={s.ayuda}>
        {conRadio
          ? 'Arrastrá el círculo verde o tocá el mapa para mover tu zona.'
          : 'Tocá el mapa o arrastrá el punto hasta donde está tu local.'}
      </Text>

      <View style={s.zonaRow}>
        <Ionicons name="location" size={16} color={C.teal} />
        <Text style={s.zonaTxt} numberOfLines={1}>
          {nombrando ? 'Buscando el barrio…' : (valor?.zona || (conRadio ? 'Elegí tu zona en el mapa' : 'Marcá tu local en el mapa'))}
        </Text>
      </View>

      {conRadio && (
      <>
      <Text style={s.label}>Radio de atención (km)</Text>
      <View style={s.radioFila}>
        <TouchableOpacity style={s.radioBtn} onPress={() => pasoRadio(-1)} accessibilityLabel="Un kilómetro menos">
          <Ionicons name="remove" size={22} color={C.teal} />
        </TouchableOpacity>
        <View style={[s.radioInputWrap, radioFueraDeRango && { borderColor: C.rojo }]}>
          <TextInput
            style={s.radioInput}
            value={radioTexto}
            onChangeText={(v) => cambiarRadio(sanitizarKm(v))}
            placeholder="Ej: 4"
            placeholderTextColor={C.gris}
            keyboardType="decimal-pad"
            accessibilityLabel="Radio de atención en kilómetros"
          />
          <Text style={s.radioUnidad}>km</Text>
        </View>
        <TouchableOpacity style={s.radioBtn} onPress={() => pasoRadio(1)} accessibilityLabel="Un kilómetro más">
          <Ionicons name="add" size={22} color={C.teal} />
        </TouchableOpacity>
      </View>
      <Text style={[s.ayuda, radioFueraDeRango && { color: C.rojo }]}>
        {radioFueraDeRango
          ? `El radio tiene que estar entre ${formatoKm(RADIO_MIN)} y ${RADIO_MAX} km`
          : `Hasta dónde vas a buscar perros: entre ${formatoKm(RADIO_MIN)} y ${RADIO_MAX} km.`}
      </Text>
      </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colores.gris300,
    borderRadius: 12, paddingHorizontal: 12, backgroundColor: colores.blanco, marginBottom: 10,
  },
  buscadorInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: C.texto },
  error: { fontSize: 12, color: C.rojo, marginTop: -4, marginBottom: 8 },
  mapa: { height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: colores.mentaSuave },
  sinMapa: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  sinMapaTxt: { fontSize: 13, color: C.texto2, textAlign: 'center' },
  ayuda: { fontSize: 12, color: C.texto2, marginTop: 6, textAlign: 'center' },
  zonaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'center',
    backgroundColor: C.menta, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, maxWidth: '100%',
  },
  zonaTxt: { fontSize: 14, fontWeight: '800', color: C.texto, flexShrink: 1 },
  label: { fontSize: 13, fontWeight: '700', color: C.texto, marginTop: 14, marginBottom: 8 },
  radioFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  radioInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 46,
    borderWidth: 1, borderColor: colores.gris300, borderRadius: 12, backgroundColor: colores.blanco, paddingHorizontal: 12,
  },
  radioInput: { flex: 1, fontSize: 20, fontWeight: '900', color: C.texto, textAlign: 'center', minWidth: 0 },
  radioUnidad: { fontSize: 15, fontWeight: '700', color: C.texto2 },
});
