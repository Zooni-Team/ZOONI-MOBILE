/**
 * MapaPaseo.jsx — Mapa de Zooni Paseadores (mini mapa del Inicio y mapa a
 * pantalla completa del Paseo activo).
 *
 * Misma técnica que el mapa de Comunidad: Leaflet + OpenStreetMap dentro de
 * un iframe (sólo web). El HTML es constante para que el iframe no se recargue
 * nunca; React le pasa los datos por postMessage (no por contentWindow directo:
 * el iframe va con sandbox="allow-scripts", sin allow-same-origin, para que un
 * CDN comprometido no pueda leer el localStorage/sesión de la app — informe
 * de seguridad #24). En nativo muestra un placeholder (no hay react-native-maps
 * en el proyecto).
 *
 * Props:
 *   centro    {lat,lng}           — dónde centrar si no hay posición
 *   posicion  {lat,lng} | null    — punto azul del paseador
 *   destino   {lat,lng} | null    — casa de la mascota (pin ámbar)
 *   ruta      [{lat,lng}]         — recorrido del paseo (línea teal)
 *   seguir    bool                — recentra en cada posición nueva
 *   interactivo bool              — false en el mini mapa (sin gestos)
 */

import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from './PaseadorUI';
import { colores } from '../../theme';

const CENTRO_DEFAULT = { lat: -34.6189, lng: -58.4380 }; // Caballito

const MAPA_HTML = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous"/>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#E8F5EC}
.yo{width:44px;height:44px;display:flex;align-items:center;justify-content:center;position:relative}
.yo .pulso{position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(45,189,114,.25);animation:pu 1.8s ease-in-out infinite}
.yo .punto{width:18px;height:18px;border-radius:50%;background:#2DBD72;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);position:relative}
.casa{width:36px;height:36px;border-radius:50%;background:#F5A623;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 1px 4px rgba(0,0,0,.3)}
@keyframes pu{0%,100%{transform:scale(1)}50%{transform:scale(1.6)}}
.leaflet-control-attribution{font-size:9px}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<script>
(function(){
  var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${CENTRO_DEFAULT.lat},${CENTRO_DEFAULT.lng}],15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
  var iconYo=L.divIcon({className:'',html:'<div class="yo"><div class="pulso"></div><div class="punto"></div></div>',iconSize:[44,44],iconAnchor:[22,22]});
  var iconCasa=L.divIcon({className:'',html:'<div class="casa"><svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M12 3 2 11.5h3V21h5.5v-5.5h3V21H19v-9.5h3z"/></svg></div>',iconSize:[36,36],iconAnchor:[18,18]});
  var yo=null,casa=null,linea=null,primera=true;

  function set(d){
    if(d.interactivo===false){
      map.dragging.disable();map.touchZoom.disable();map.scrollWheelZoom.disable();map.doubleClickZoom.disable();
    }else{
      map.dragging.enable();map.touchZoom.enable();map.scrollWheelZoom.enable();
    }
    if(casa){map.removeLayer(casa);casa=null}
    if(d.destino){casa=L.marker([d.destino.lat,d.destino.lng],{icon:iconCasa}).addTo(map)}
    if(yo){map.removeLayer(yo);yo=null}
    if(d.posicion){yo=L.marker([d.posicion.lat,d.posicion.lng],{icon:iconYo,zIndexOffset:1000}).addTo(map)}
    if(linea){map.removeLayer(linea);linea=null}
    if(d.ruta&&d.ruta.length>1){
      linea=L.polyline(d.ruta.map(function(p){return[p.lat,p.lng]}),{color:'#2DBD72',weight:6,opacity:.85,lineCap:'round'}).addTo(map);
    }
    var foco=d.posicion||d.destino||d.centro;
    if(primera&&d.posicion&&d.destino){
      map.fitBounds(L.latLngBounds([[d.posicion.lat,d.posicion.lng],[d.destino.lat,d.destino.lng]]).pad(0.4));
      primera=false;
    }else if(foco&&(primera||d.seguir)){
      map.setView([foco.lat,foco.lng],primera?16:map.getZoom(),{animate:!primera});
      primera=false;
    }
  }
  var api={
    set:set,
    centrar:function(lat,lng){map.flyTo([lat,lng],17,{duration:.6})}
  };
  window.addEventListener('message',function(e){
    var m=e.data;
    if(!m||m.tipo!=='zooni-cmd'||typeof api[m.metodo]!=='function')return;
    api[m.metodo].apply(null,m.args||[]);
  });
  try{window.parent.postMessage({tipo:'zooni-paseo-listo'},'*')}catch(e){}
})();
</script>
</body></html>`;

export default function MapaPaseo({
  centro = CENTRO_DEFAULT, posicion = null, destino = null, ruta = [],
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

  // Cada vez que cambian los datos, se los pasa al mapa (sin recargarlo)
  const firma = JSON.stringify([posicion, destino, ruta.length, ruta[ruta.length - 1], seguir, interactivo]);
  useEffect(() => { enviar(); }, [firma, enviar]);

  // Expone "centrar en mí" al padre
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
        srcDoc={MAPA_HTML}
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
