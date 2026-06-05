import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, Platform, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import TabAmigos       from '../../components/Comunidad/TabAmigos';
import TabServicios    from '../../components/Comunidad/TabServicios';
import TabSolicitudes  from '../../components/Comunidad/TabSolicitudes';
import BuscadorUsuarios from '../../components/Comunidad/BuscadorUsuarios';
import FormularioCartel from '../../components/Comunidad/FormularioCartel';
import PopupServicio   from '../../components/Comunidad/PopupServicio';
import PopupCartel     from '../../components/Comunidad/PopupCartel';

import { fetchMapaData, actualizarUbicacion } from '../../api/comunidad';

const TABS  = ['Amigos', 'Servicios', 'Solicitudes', 'Buscar'];
const USER_ID = 1; // demo — en producción viene del contexto de auth

// ── Mapa web embebido via iframe ─────────────────────────────────────────────
// En Expo web no hay react-native-maps, usamos Leaflet en un iframe inline.
const MapaLeaflet = ({ onServicioClick, onCartelClick, onDblClick, mapaData, markerTemp, modoCartel }) => {
  const iframeRef = useRef(null);

  // Genera el HTML del mapa con los markers actuales
  const buildHtml = () => {
    const serviciosJson = JSON.stringify(mapaData.servicios || []);
    const cartelesJson  = JSON.stringify(mapaData.carteles  || []);
    const amigosJson    = JSON.stringify(mapaData.amigos    || []);
    const tempJson      = markerTemp ? JSON.stringify(markerTemp) : 'null';

    return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden}
  .mk{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-size:16px;box-shadow:0 1px 4px rgba(0,0,0,.3);line-height:34px;text-align:center}
  .mk-user-wrap{width:44px;height:44px;display:flex;align-items:center;justify-content:center;position:relative}
  .mk-pulse{position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(33,150,243,.25);animation:p 1.8s ease-in-out infinite}
  .mk-dot{width:16px;height:16px;border-radius:50%;background:#2196F3;border:2.5px solid #fff;position:relative}
  @keyframes p{0%,100%{transform:scale(1)}50%{transform:scale(1.55)}}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map',{zoomControl:false,doubleClickZoom:false}).setView([-34.6037,-58.3816],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);

function mk(emoji,bg){return L.divIcon({className:'',html:'<div class="mk" style="background:'+bg+'">'+emoji+'</div>',iconSize:[34,34],iconAnchor:[17,34]})}
var iconUser=L.divIcon({className:'',html:'<div class="mk-user-wrap"><div class="mk-pulse"></div><div class="mk-dot"></div></div>',iconSize:[44,44],iconAnchor:[22,22]});
var ICONS={veterinaria:mk('🏥','#E63946'),paseador:mk('🦮','#F5A623'),petshop:mk('🛍️','#F5C842'),peluqueria:mk('✂️','#9B59B6'),perdida:mk('🔴','#E63946'),aviso:mk('📌','#6B6B6B'),amigo:mk('👤','#2DBD72'),temporal:mk('📍','#2DBD72')};

if(navigator.geolocation){
  navigator.geolocation.getCurrentPosition(function(p){
    map.setView([p.coords.latitude,p.coords.longitude],15);
    L.marker([p.coords.latitude,p.coords.longitude],{icon:iconUser,zIndexOffset:1000}).addTo(map);
    window.parent&&window.parent.postMessage&&window.parent.postMessage(JSON.stringify({type:'location',lat:p.coords.latitude,lng:p.coords.longitude}),'*');
  },function(){L.marker([-34.6037,-58.3816],{icon:iconUser,zIndexOffset:1000}).addTo(map)});
}else{L.marker([-34.6037,-58.3816],{icon:iconUser,zIndexOffset:1000}).addTo(map)}

var servicios=${serviciosJson};
servicios.forEach(function(s){
  L.marker([s.lat,s.lng],{icon:ICONS[s.tipo]||mk('📍','#888')}).addTo(map).on('click',function(){window.parent&&window.parent.postMessage&&window.parent.postMessage(JSON.stringify({type:'servicio',data:s}),'*')});
});

var carteles=${cartelesJson};
carteles.forEach(function(c){
  L.marker([c.lat,c.lng],{icon:c.tipo==='perdida'?ICONS.perdida:ICONS.aviso}).addTo(map).on('click',function(){window.parent&&window.parent.postMessage&&window.parent.postMessage(JSON.stringify({type:'cartel',data:c}),'*')});
});

var amigos=${amigosJson};
amigos.forEach(function(a){
  if(a.lat&&a.lng)L.marker([a.lat,a.lng],{icon:ICONS.amigo}).addTo(map);
});

var tempMarker=null;
if(${tempJson}){
  var t=${tempJson};
  tempMarker=L.marker([t.latitude||t.lat,t.longitude||t.lng],{icon:ICONS.temporal}).addTo(map);
}

map.on('dblclick',function(e){
  if(${modoCartel?'true':'false'}){
    window.parent&&window.parent.postMessage&&window.parent.postMessage(JSON.stringify({type:'dblclick',lat:e.latlng.lat,lng:e.latlng.lng}),'*');
  }
});
map.on('moveend',function(){
  var b=map.getBounds();
  window.parent&&window.parent.postMessage&&window.parent.postMessage(JSON.stringify({type:'bounds',lat_min:b.getSouth(),lat_max:b.getNorth(),lng_min:b.getWest(),lng_max:b.getEast()}),'*');
});

window.flyTo=function(lat,lng){map.flyTo([lat,lng],16,{duration:0.7})};
window.zoomIn=function(){map.zoomIn()};
window.zoomOut=function(){map.zoomOut()};
</script>
</body></html>`;
  };

  // Solo en web podemos usar iframe directamente
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.mapaFallback}>
        <Ionicons name="map-outline" size={60} color="#2DBD72" />
        <Text style={styles.mapaFallbackText}>Mapa disponible en versión web</Text>
      </View>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={buildHtml()}
      style={{ width: '100%', height: '100%', border: 'none' }}
      title="Mapa Zooni Comunidad"
    />
  );
};

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function ComunidadScreen() {
  const navigation = useNavigation();

  const [mapaData,   setMapaData]   = useState({ servicios: [], carteles: [], amigos: [] });
  const [bbox,       setBbox]       = useState(null);
  const [tab,        setTab]        = useState('Amigos');
  const [sheetH,     setSheetH]     = useState('half'); // collapsed | half | full
  const [modoCartel, setModoCartel] = useState(false);
  const [markerTemp, setMarkerTemp] = useState(null);
  const [formulario, setFormulario] = useState(false);
  const [popServ,    setPopServ]    = useState(null);
  const [popCart,    setPopCart]    = useState(null);
  const [modalAmigo, setModalAmigo] = useState(false);
  const [toast,      setToast]      = useState(null);
  const [toastKey,   setToastKey]   = useState(0);
  const [userPos,    setUserPos]    = useState(null);
  const iframeRef = useRef(null);
  const boundsTimer = useRef(null);
  const bannerAnim = useRef(new Animated.Value(0)).current;

  // ── Carga de datos ──────────────────────────────────────────────────────────
  const cargarMapa = useCallback(async (b) => {
    if (!b) return;
    try {
      const data = await fetchMapaData(b);
      setMapaData(data);
    } catch {}
  }, []);

  // ── Polling 30s ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (bbox) cargarMapa(bbox);
      if (userPos) actualizarUbicacion(userPos.lat, userPos.lng).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, [bbox, userPos, cargarMapa]);

  // ── Mensajes del iframe (mapa) ───────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'bounds') {
          const b = { lat_min: msg.lat_min, lat_max: msg.lat_max, lng_min: msg.lng_min, lng_max: msg.lng_max };
          setBbox(b);
          clearTimeout(boundsTimer.current);
          boundsTimer.current = setTimeout(() => cargarMapa(b), 800);
        } else if (msg.type === 'location') {
          setUserPos({ lat: msg.lat, lng: msg.lng });
        } else if (msg.type === 'servicio') {
          setPopServ(msg.data); setPopCart(null);
        } else if (msg.type === 'cartel') {
          setPopCart(msg.data); setPopServ(null);
        } else if (msg.type === 'dblclick') {
          setMarkerTemp({ latitude: msg.lat, longitude: msg.lng });
          setFormulario(true);
        }
      } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [cargarMapa]);

  // ── Animación banner modo cartel ─────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(bannerAnim, {
      toValue: modoCartel ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [modoCartel]);

  const mostrarToast = (msg) => {
    setToast(msg);
    setToastKey(k => k + 1);
    setTimeout(() => setToast(null), 3000);
  };

  const flyTo = (lat, lng) => {
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.flyTo?.(lat, lng);
    }
  };

  const zoomIn  = () => { if (Platform.OS === 'web') iframeRef.current?.contentWindow?.zoomIn?.(); };
  const zoomOut = () => { if (Platform.OS === 'web') iframeRef.current?.contentWindow?.zoomOut?.(); };

  const sheetHeights = { collapsed: 64, half: '42%', full: '90%' };
  const bboxObj = bbox;

  return (
    <View style={styles.container}>

      {/* ── MAPA ─────────────────────────────────────────────────────────── */}
      <View style={styles.mapaWrapper}>
        {Platform.OS === 'web' ? (
          <iframe
            ref={iframeRef}
            srcDoc={(() => {
              const serviciosJson = JSON.stringify(mapaData.servicios || []);
              const cartelesJson  = JSON.stringify(mapaData.carteles  || []);
              const amigosJson    = JSON.stringify(mapaData.amigos    || []);
              const tempJson      = markerTemp ? JSON.stringify(markerTemp) : 'null';
              return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%}.mk{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;font-size:16px;box-shadow:0 1px 4px rgba(0,0,0,.3);line-height:34px;text-align:center}.mk-user-wrap{width:44px;height:44px;display:flex;align-items:center;justify-content:center;position:relative}.mk-pulse{position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(33,150,243,.25);animation:p 1.8s ease-in-out infinite}.mk-dot{width:16px;height:16px;border-radius:50%;background:#2196F3;border:2.5px solid #fff;position:relative}@keyframes p{0%,100%{transform:scale(1)}50%{transform:scale(1.55)}}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:false,doubleClickZoom:false}).setView([-34.6037,-58.3816],15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
function mk(e,bg){return L.divIcon({className:'',html:'<div class="mk" style="background:'+bg+'">'+e+'</div>',iconSize:[34,34],iconAnchor:[17,34]})}
var iconUser=L.divIcon({className:'',html:'<div class="mk-user-wrap"><div class="mk-pulse"></div><div class="mk-dot"></div></div>',iconSize:[44,44],iconAnchor:[22,22]});
var ICONS={veterinaria:mk('🏥','#E63946'),paseador:mk('🦮','#F5A623'),petshop:mk('🛍️','#F5C842'),peluqueria:mk('✂️','#9B59B6'),perdida:mk('🔴','#E63946'),aviso:mk('📌','#6B6B6B'),amigo:mk('👤','#2DBD72'),temporal:mk('📍','#2DBD72')};
function post(obj){try{window.parent.postMessage(JSON.stringify(obj),'*')}catch(e){}}
if(navigator.geolocation){navigator.geolocation.getCurrentPosition(function(p){map.setView([p.coords.latitude,p.coords.longitude],15);L.marker([p.coords.latitude,p.coords.longitude],{icon:iconUser,zIndexOffset:1000}).addTo(map);post({type:'location',lat:p.coords.latitude,lng:p.coords.longitude})},function(){L.marker([-34.6037,-58.3816],{icon:iconUser,zIndexOffset:1000}).addTo(map)})}else{L.marker([-34.6037,-58.3816],{icon:iconUser,zIndexOffset:1000}).addTo(map)}
var s=${serviciosJson};s.forEach(function(x){L.marker([x.lat,x.lng],{icon:ICONS[x.tipo]||mk('📍','#888')}).addTo(map).on('click',function(){post({type:'servicio',data:x})})});
var c=${cartelesJson};c.forEach(function(x){L.marker([x.lat,x.lng],{icon:x.tipo==='perdida'?ICONS.perdida:ICONS.aviso}).addTo(map).on('click',function(){post({type:'cartel',data:x})})});
var a=${amigosJson};a.forEach(function(x){if(x.lat&&x.lng)L.marker([x.lat,x.lng],{icon:ICONS.amigo}).addTo(map)});
if(${tempJson}){var t=${tempJson};L.marker([t.latitude||t.lat,t.longitude||t.lng],{icon:ICONS.temporal}).addTo(map)}
map.on('dblclick',function(e){if(${modoCartel?'true':'false'}){post({type:'dblclick',lat:e.latlng.lat,lng:e.latlng.lng})}});
map.on('moveend',function(){var b=map.getBounds();post({type:'bounds',lat_min:b.getSouth(),lat_max:b.getNorth(),lng_min:b.getWest(),lng_max:b.getEast()})});
window.flyTo=function(lat,lng){map.flyTo([lat,lng],16,{duration:0.7})};
window.zoomIn=function(){map.zoomIn()};
window.zoomOut=function(){map.zoomOut()};
</script></body></html>`;
            })()}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Mapa Zooni"
          />
        ) : (
          <View style={styles.mapaFallback}>
            <Ionicons name="map-outline" size={60} color="#2DBD72" />
            <Text style={styles.mapaFallbackText}>Mapa disponible en versión web</Text>
          </View>
        )}

        {/* Botón volver */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#2C2C2C" />
        </TouchableOpacity>

        {/* Banner modo cartel */}
        <Animated.View style={[
          styles.bannerCartel,
          { opacity: bannerAnim, transform: [{ translateY: bannerAnim.interpolate({ inputRange:[0,1], outputRange:[-16,0] }) }] }
        ]}>
          <Text style={styles.bannerText}>
            Hacé doble click en el mapa donde querés crear el cartel
          </Text>
        </Animated.View>

        {/* Toast */}
        {toast && (
          <View key={toastKey} style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {/* Botones flotantes */}
        <View style={styles.botonesFlotantes}>
          <TouchableOpacity style={[styles.pill, styles.pillBlanco]}
            onPress={() => userPos && flyTo(userPos.lat, userPos.lng)}>
            <Text style={styles.pillText}>📍 Mi Ubicación</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill, styles.pillBlanco]}
            onPress={() => setModalAmigo(true)}>
            <Text style={styles.pillText}>➕ Agregar Amigo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, modoCartel ? styles.pillVerde : styles.pillRojo]}
            onPress={() => { setModoCartel(v => !v); setMarkerTemp(null); }}>
            <Text style={styles.pillTextBlanco}>🚨 {modoCartel ? 'Cancelar' : 'Crear Cartel'}</Text>
          </TouchableOpacity>
        </View>

        {/* Controles zoom */}
        <View style={styles.zoom}>
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut}>
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
        </View>

        {/* Popups */}
        {popServ && <PopupServicio servicio={popServ} onClose={() => setPopServ(null)} />}
        {popCart && (
          <PopupCartel cartel={popCart} userId={USER_ID}
            onClose={() => setPopCart(null)}
            onEliminado={(id) => {
              setMapaData(p => ({ ...p, carteles: p.carteles.filter(c => c.id !== id) }));
              mostrarToast('🗑️ Cartel eliminado');
            }}
          />
        )}
      </View>

      {/* ── BOTTOM SHEET ─────────────────────────────────────────────────── */}
      <View style={[styles.sheet, { height: sheetHeights[sheetH] }]}>
        {/* Handle */}
        <TouchableOpacity style={styles.handleRow}
          onPress={() => setSheetH(s => s === 'half' ? 'full' : s === 'full' ? 'collapsed' : 'half')}>
          <View style={styles.handle} />
        </TouchableOpacity>

        {sheetH !== 'collapsed' && (
          <>
            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
              {TABS.map(t => (
                <TouchableOpacity key={t}
                  style={[styles.tabBtn, tab === t && styles.tabBtnOn]}
                  onPress={() => setTab(t)}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.tabSep} />

            {/* Contenido */}
            <View style={styles.tabBody}>
              {tab === 'Amigos' && (
                <TabAmigos onVerEnMapa={a => { flyTo(a.lat, a.lng); setSheetH('half'); }} />
              )}
              {tab === 'Servicios' && (
                <TabServicios bbox={bboxObj} onSeleccionar={s => {
                  setPopServ(s); flyTo(s.lat, s.lng); setSheetH('half');
                }} />
              )}
              {tab === 'Solicitudes' && (
                <TabSolicitudes onRespuesta={() => {
                  mostrarToast('✅ ¡Ahora son amigos!');
                  if (bbox) cargarMapa(bbox);
                }} />
              )}
              {tab === 'Buscar' && (
                <BuscadorUsuarios
                  onSolicitudEnviada={n => mostrarToast(`✅ Solicitud enviada a ${n}`)}
                />
              )}
            </View>
          </>
        )}
      </View>

      {/* ── FORMULARIO CARTEL ──────────────────────────────────────────────── */}
      {formulario && (
        <FormularioCartel
          coordenadas={markerTemp}
          onExito={(cartel) => {
            setFormulario(false); setMarkerTemp(null); setModoCartel(false);
            setMapaData(p => ({ ...p, carteles: [...p.carteles, cartel] }));
            mostrarToast('✅ Cartel creado exitosamente');
          }}
          onCancelar={() => { setFormulario(false); setMarkerTemp(null); setModoCartel(false); }}
        />
      )}

      {/* ── MODAL AGREGAR AMIGO ────────────────────────────────────────────── */}
      <Modal visible={modalAmigo} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTit}>➕ Agregar Amigo</Text>
              <TouchableOpacity onPress={() => setModalAmigo(false)}>
                <Text style={{ fontSize: 18, color: '#6B6B6B' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <BuscadorUsuarios onSolicitudEnviada={n => {
              mostrarToast(`✅ Solicitud enviada a ${n}`);
              setModalAmigo(false);
            }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#C8F0D8' },
  mapaWrapper:  { flex: 1, position: 'relative' },
  mapaFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C8F0D8' },
  mapaFallbackText: { fontSize: 15, color: '#6B6B6B', marginTop: 12 },

  // Botón volver
  backBtn: {
    position: 'absolute', top: 14, left: 14, zIndex: 100,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },

  // Banner cartel
  bannerCartel: {
    position: 'absolute', top: 68, left: 14, right: 14, zIndex: 100,
    backgroundColor: '#2DBD72', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  bannerText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 13 },

  // Toast
  toast: {
    position: 'absolute', top: 58, alignSelf: 'center', zIndex: 200,
    backgroundColor: '#2DBD72', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 8,
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Botones flotantes
  botonesFlotantes: { position: 'absolute', top: 60, right: 14, zIndex: 100, gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
  },
  pillBlanco:  { backgroundColor: '#fff' },
  pillRojo:    { backgroundColor: '#E63946' },
  pillVerde:   { backgroundColor: '#2DBD72' },
  pillText:    { fontWeight: '700', fontSize: 13, color: '#2C2C2C' },
  pillTextBlanco: { fontWeight: '700', fontSize: 13, color: '#fff' },

  // Zoom
  zoom:    { position: 'absolute', bottom: 280, right: 14, zIndex: 100, gap: 2 },
  zoomBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  zoomText: { fontSize: 20, fontWeight: '700', color: '#2C2C2C' },

  // Bottom sheet
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },
  handleRow:  { alignItems: 'center', paddingVertical: 10 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CCCCCC' },
  tabsRow:    { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, maxHeight: 48 },
  tabBtn:     { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginRight: 6 },
  tabBtnOn:   { backgroundColor: '#2DBD72' },
  tabText:    { fontSize: 13, color: '#6B6B6B' },
  tabTextOn:  { color: '#fff', fontWeight: '700' },
  tabSep:     { height: 1, backgroundColor: '#EEEEEE', marginHorizontal: 16, marginBottom: 4 },
  tabBody:    { flex: 1, paddingHorizontal: 16, overflow: 'hidden' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox:     { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTit:     { fontSize: 16, fontWeight: '700', color: '#2C2C2C' },
});
