/**
 * ZonaMapaPicker.jsx — Zona de atención del paseador: un círculo en el mapa
 *
 * El paseador arrastra el círculo (o toca el mapa) hasta donde trabaja y
 * escribe el radio en km (entre RADIO_MIN y RADIO_MAX, no hay uno elegido de
 * entrada). Hasta que no haya un radio válido sólo se ve el centro, sin círculo. El punto de partida es una "ubicación base": la que se pase
 * por props (ej. la guardada en su perfil), si no su GPS, y si no Caballito.
 * Al soltar el círculo se busca el nombre del barrio (Nominatim / OSM) para
 * completar la zona sola.
 *
 * Mismo Leaflet + OpenStreetMap en iframe que Comunidad y MapaPaseo (sólo
 * web). En nativo queda un buscador de barrio + radio, sin mapa.
 *
 * Props: valor { lat, lng, radioKm, zona } · onCambio(valor) — radioKm es null
 *        mientras el radio escrito no sea válido
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from './PaseadorUI';
import { barrioDe, buscarLugar } from '../../services/paseadorApi';

const BASE_DEFAULT = { lat: -34.6189, lng: -58.4380 }; // Caballito
// Mismos límites que el CHECK paseador_radio_ok (035): NUMERIC(4,1) entre 0.5 y 30
export const RADIO_MIN = 0.5;
export const RADIO_MAX = 30;

/** "2,5" → 2.5 · null si está vacío o fuera de rango */
export function radioValido(texto) {
  const n = Number(String(texto ?? '').replace(',', '.'));
  if (!String(texto ?? '').trim() || !Number.isFinite(n)) return null;
  return n >= RADIO_MIN && n <= RADIO_MAX ? Math.round(n * 10) / 10 : null;
}

/** Deja sólo dígitos y un separador decimal con un decimal como máximo */
function sanitizarKm(v) {
  const limpio = v.replace(/[^0-9.,]/g, '').replace(',', '.');
  const [ent, ...resto] = limpio.split('.');
  const entero = ent.slice(0, 2);
  return resto.length ? `${entero}.${resto.join('').slice(0, 1)}` : entero;
}

const formatoKm = (n) => (n == null ? '' : String(n).replace('.', ','));

const MAPA_HTML = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#E8F5EC}
.centro{width:40px;height:40px;border-radius:50%;background:#2DBD72;border:3px solid #fff;
  display:flex;align-items:center;justify-content:center;font-size:18px;
  box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:grab}
.leaflet-control-attribution{font-size:9px}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var map=L.map('map',{zoomControl:false}).setView([${BASE_DEFAULT.lat},${BASE_DEFAULT.lng}],14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
  var icon=L.divIcon({className:'',html:'<div class="centro"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><circle cx="5" cy="9.5" r="2.2"/><circle cx="9" cy="5.5" r="2.2"/><circle cx="15" cy="5.5" r="2.2"/><circle cx="19" cy="9.5" r="2.2"/><path d="M12 10.5c-3 0-6.5 4.6-6.5 7.3 0 1.8 1.4 2.7 3 2.7 1.4 0 2.3-.8 3.5-.8s2.1.8 3.5.8c1.6 0 3-.9 3-2.7 0-2.7-3.5-7.3-6.5-7.3z"/></svg></div>',iconSize:[40,40],iconAnchor:[20,20]});
  var circulo=null, centro=null, radio=0;

  function avisar(){
    var p=centro.getLatLng();
    try{window.parent.__zooniZona&&window.parent.__zooniZona({lat:p.lat,lng:p.lng})}catch(e){}
  }
  function encuadrar(){
    if(radio>0) map.fitBounds(circulo.getBounds().pad(0.15),{animate:true});
    else map.setView(centro.getLatLng(),14,{animate:true});
  }
  function dibujar(lat,lng){
    if(!circulo){
      circulo=L.circle([lat,lng],{radius:radio,color:'#2DBD72',weight:3,fillColor:'#2DBD72',fillOpacity:.18}).addTo(map);
      centro=L.marker([lat,lng],{icon:icon,draggable:true,zIndexOffset:1000}).addTo(map);
      // Mientras se arrastra, el círculo sigue al centro
      centro.on('drag',function(e){circulo.setLatLng(e.target.getLatLng())});
      centro.on('dragend',avisar);
      // Arrastrar el círculo mismo (no sólo el centro)
      var arrastrando=false;
      circulo.on('mousedown touchstart',function(){arrastrando=true;map.dragging.disable()});
      map.on('mousemove',function(e){if(arrastrando){circulo.setLatLng(e.latlng);centro.setLatLng(e.latlng)}});
      map.on('mouseup',function(){if(arrastrando){arrastrando=false;map.dragging.enable();avisar()}});
    }else{
      circulo.setLatLng([lat,lng]);centro.setLatLng([lat,lng]);
    }
  }
  // Tocar el mapa mueve la zona ahí
  map.on('click',function(e){dibujar(e.latlng.lat,e.latlng.lng);avisar()});

  window.__zooniZonaMapa={
    set:function(d,mover){
      // Sin radio válido: sólo el centro, el círculo queda invisible
      radio=d.radioKm>0?d.radioKm*1000:0;
      dibujar(d.lat,d.lng);
      circulo.setRadius(radio||1);
      circulo.setStyle(radio?{opacity:1,fillOpacity:.18}:{opacity:0,fillOpacity:0});
      if(mover) encuadrar();
    }
  };
  try{window.parent.__zooniZonaListo&&window.parent.__zooniZonaListo()}catch(e){}
})();
</script>
</body></html>`;

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

export default function ZonaMapaPicker({ valor, onCambio, baseTexto }) {
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

  // Si el radio cambia desde afuera (ej. llega el perfil guardado), mostrarlo
  useEffect(() => {
    if (radioValido(radioTexto) !== (valor?.radioKm ?? null)) setRadioTexto(formatoKm(valor?.radioKm));
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const api = iframeRef.current?.contentWindow?.__zooniZonaMapa;
    if (api && v?.lat != null) api.set(v, mover);
  }, []);

  // Mover el centro → actualizar coordenadas y nombre del barrio
  const moverA = useCallback(async ({ lat, lng }, { mover = false, zona } = {}) => {
    const nuevo = { ...valorRef.current, lat, lng, ...(zona ? { zona } : {}) };
    valorRef.current = nuevo;
    onCambioRef.current(nuevo);
    if (mover) enviarAlMapa(true, nuevo);
    if (zona) return;
    setNombrando(true);
    const barrio = await barrioDe(lat, lng);
    setNombrando(false);
    // Si mientras tanto lo movieron de nuevo, este nombre ya no corresponde
    const sigue = valorRef.current?.lat === lat && valorRef.current?.lng === lng;
    if (barrio && sigue) {
      valorRef.current = { ...valorRef.current, zona: barrio };
      onCambioRef.current(valorRef.current);
    }
  }, [enviarAlMapa]);

  // El iframe avisa cuando sueltan el círculo
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    window.__zooniZona = (p) => moverA(p);
    return () => { delete window.__zooniZona; };
  }, [moverA]);

  // Ubicación base: la que ya traía el valor → si no, texto base (ciudad) → GPS → Caballito
  useEffect(() => {
    if (valorRef.current?.lat != null) return;
    let vivo = true;
    (async () => {
      let base = baseTexto ? await buscarLugar(baseTexto) : null;
      if (!base) base = await obtenerGps();
      if (!vivo) return;
      moverA(base ?? BASE_DEFAULT, { mover: true });
    })();
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambió el radio → redibujar y encuadrar
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
            srcDoc={MAPA_HTML}
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
      <Text style={s.ayuda}>Arrastrá el círculo verde o tocá el mapa para mover tu zona.</Text>

      <View style={s.zonaRow}>
        <Ionicons name="location" size={16} color={C.teal} />
        <Text style={s.zonaTxt} numberOfLines={1}>
          {nombrando ? 'Buscando el barrio…' : (valor?.zona || 'Elegí tu zona en el mapa')}
        </Text>
      </View>

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
    </View>
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#DDDDDD',
    borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#FFFFFF', marginBottom: 10,
  },
  buscadorInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: C.texto },
  error: { fontSize: 12, color: C.rojo, marginTop: -4, marginBottom: 8 },
  mapa: { height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E8F5EC' },
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
    borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12,
  },
  radioInput: { flex: 1, fontSize: 20, fontWeight: '900', color: C.texto, textAlign: 'center', minWidth: 0 },
  radioUnidad: { fontSize: 15, fontWeight: '700', color: C.texto2 },
});
