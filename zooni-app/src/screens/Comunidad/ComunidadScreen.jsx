import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';

import TabAmigos        from '../../components/Comunidad/TabAmigos';
import TabServicios     from '../../components/Comunidad/TabServicios';
import TabSolicitudes   from '../../components/Comunidad/TabSolicitudes';
import BuscadorUsuarios from '../../components/Comunidad/BuscadorUsuarios';
import FormularioCartel from '../../components/Comunidad/FormularioCartel';
import PopupServicio    from '../../components/Comunidad/PopupServicio';
import PopupPaseador    from '../../components/Comunidad/PopupPaseador';
import PopupCartel      from '../../components/Comunidad/PopupCartel';
import HamburgerDrawer  from '../../components/HamburgerDrawer';
import { useUsuarioActivo } from '../../hooks/useUsuarioActivo';

import {
  fetchCarteles, fetchServiciosPropios, fetchAmigos, actualizarUbicacion,
} from '../../services/comunidadApi';
import { getCurrentUserId } from '../../config/session';
import { fetchPaseadoresParaMi } from '../../services/paseadorApi';
import { buscarLugares, combinarServicios } from '../../services/lugaresApi';
import { colores } from '../../theme';
import { MAPA_COMUNIDAD_HTML } from '../../components/mapas/mapasHtml';
import Toast from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';

const TABS    = ['Amigos', 'Servicios', 'Solicitudes', 'Buscar'];

let ultimoMapa = { servicios: [], carteles: [], amigos: [], paseadores: [] };

export default function ComunidadScreen() {
  const [mapaData,   setMapaData]   = useState(ultimoMapa);
  const [cargandoLugares, setCargandoLugares] = useState(false);
  const [bbox,       setBbox]       = useState(null);
  const [tab,        setTab]        = useState('Amigos');
  const [sheetH,     setSheetH]     = useState('half');
  const [modoCartel, setModoCartel] = useState(false);
  const [markerTemp, setMarkerTemp] = useState(null);
  const [formulario, setFormulario] = useState(false);
  const [popServ,    setPopServ]    = useState(null);
  const [popPaseador, setPopPaseador] = useState(null);
  const [popCart,    setPopCart]    = useState(null);
  const [modalAmigo, setModalAmigo] = useState(false);
  const { toast, mostrarToast } = useToast(3000);
  const [userPos,    setUserPos]    = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { usuario, mascotaActiva } = useUsuarioActivo();

  const iframeRef   = useRef(null);
  const boundsTimer = useRef(null);
  const ultimoBboxRef = useRef(null);
  const userPosRef = useRef(null);
  const mapaReady   = useRef(false);
  const bannerAnim  = useRef(new Animated.Value(0)).current;
  const pintarRef = useRef({ mapaData, markerTemp });
  pintarRef.current = { mapaData, markerTemp };
  const pedidoZona = useRef(0);

  const mapCall = useCallback((fn, ...args) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { tipo: 'zooni-cmd', metodo: fn, args }, '*',
      );
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.tipo !== 'zooni-evento') return;
      const msg = e.data.payload;
      switch (msg.type) {
        case 'ready':
          mapaReady.current = true;
          mapCall('setData', { ...pintarRef.current.mapaData, markerTemp: pintarRef.current.markerTemp });
          pedirUbicacionRef.current(false);
          break;
        case 'bounds': {
          const b = { lat_min: msg.lat_min, lat_max: msg.lat_max, lng_min: msg.lng_min, lng_max: msg.lng_max };
          const primera = !ultimoBboxRef.current;
          setBbox(b);
          ultimoBboxRef.current = b;
          clearTimeout(boundsTimer.current);
          if (primera) cargarZonaRef.current(b);
          else boundsTimer.current = setTimeout(() => cargarZonaRef.current(b), 300);
          break;
        }
        case 'servicio':
          setPopServ(msg.data); setPopCart(null); setPopPaseador(null);
          break;
        case 'paseador':
          setPopPaseador(msg.data); setPopServ(null); setPopCart(null);
          break;
        case 'cartel':
          setPopCart(msg.data); setPopServ(null);
          break;
        case 'dblclick':
          setMarkerTemp({ latitude: msg.lat, longitude: msg.lng });
          setFormulario(true);
          break;
        default: break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(boundsTimer.current);
    };
  }, []);

  const actualizar = useCallback((parcial) => {
    setMapaData((p) => (ultimoMapa = { ...p, ...parcial }));
  }, []);

  const cargarPaseadores = useCallback(() => {
    fetchPaseadoresParaMi(userPosRef.current)
      .then((paseadores) => actualizar({ paseadores }))
      .catch(() => {});
  }, [actualizar]);
  const cargarAmigos = useCallback(() => {
    fetchAmigos().then(({ amigos }) => actualizar({ amigos })).catch(() => {});
  }, [actualizar]);

  const cargarZona = useCallback((b) => {
    if (!b) return;
    const id = ++pedidoZona.current;
    const vigente = () => id === pedidoZona.current;

    fetchCarteles(b)
      .then((carteles) => { if (vigente()) actualizar({ carteles }); })
      .catch(() => {});

    setCargandoLugares(true);
    Promise.all([
      fetchServiciosPropios(b).catch(() => []),
      buscarLugares(b, 'todos'),
    ])
      .then(([propios, externos]) => {
        if (vigente()) actualizar({ servicios: combinarServicios(propios, externos) });
      })
      .catch(() => {})
      .finally(() => { if (vigente()) setCargandoLugares(false); });
  }, [actualizar]);

  const cargarZonaRef = useRef(cargarZona);
  useEffect(() => { cargarZonaRef.current = cargarZona; }, [cargarZona]);
  const cargarPaseadoresRef = useRef(cargarPaseadores);
  useEffect(() => { cargarPaseadoresRef.current = cargarPaseadores; }, [cargarPaseadores]);

  const pedirUbicacion = useCallback((centrar) => {
    if (Platform.OS !== 'web' || !navigator.geolocation) {
      if (!centrar) mapCall('setUserMarker', -34.6089, -58.4340);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        const antes = userPosRef.current;
        userPosRef.current = { lat, lng };
        setUserPos(userPosRef.current);
        mapCall('setUserLocation', lat, lng, centrar);
        const movido = !antes || Math.abs(antes.lat - lat) + Math.abs(antes.lng - lng) > 0.002;
        if (movido) cargarPaseadoresRef.current();
      },
      () => {
        if (!centrar) mapCall('setUserMarker', -34.6089, -58.4340);
        else mostrarToast('No pudimos obtener tu ubicación.', { color: colores.rojo, icono: 'location' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [mapCall, mostrarToast]);
  const pedirUbicacionRef = useRef(pedirUbicacion);
  useEffect(() => { pedirUbicacionRef.current = pedirUbicacion; }, [pedirUbicacion]);

  useEffect(() => {
    cargarPaseadores();
    cargarAmigos();
  }, [cargarPaseadores, cargarAmigos]);

  const enFoco = useIsFocused();
  const bboxRef = useRef(bbox);
  bboxRef.current = bbox;
  const posRef = useRef(userPos);
  posRef.current = userPos;
  useEffect(() => {
    if (!enFoco) return undefined;
    const iv = setInterval(() => {
      if (bboxRef.current) cargarZona(bboxRef.current);
      cargarPaseadores();
      cargarAmigos();
      const pos = posRef.current;
      if (pos) actualizarUbicacion(pos.lat, pos.lng).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, [enFoco, cargarZona, cargarPaseadores, cargarAmigos]);

  useEffect(() => {
    if (!mapaReady.current) return;
    mapCall('setData', { ...mapaData, markerTemp });
  }, [mapaData, markerTemp, mapCall]);

  useEffect(() => {
    if (!mapaReady.current) return;
    mapCall('setModoCartel', modoCartel);
  }, [modoCartel, mapCall]);

  useEffect(() => {
    Animated.timing(bannerAnim, {
      toValue: modoCartel ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [bannerAnim, modoCartel]);

  const flyTo          = (lat, lng) => mapCall('flyTo', lat, lng);
  const zoomIn         = ()         => mapCall('zoomIn');
  const zoomOut        = ()         => mapCall('zoomOut');
  const irAMiUbicacion = () => pedirUbicacion(true);

  const sheetHeights = { collapsed: 64, half: '42%', full: '90%' };

  return (
    <View style={styles.container}>

      <View style={styles.mapaWrapper}>
        {Platform.OS === 'web' ? (
          <iframe
            ref={iframeRef}
            srcDoc={MAPA_COMUNIDAD_HTML}
            sandbox="allow-scripts"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Mapa Zooni"
          />
        ) : (
          <View style={styles.mapaFallback}>
            <Ionicons name="map-outline" size={60} color={colores.verde} />
            <Text style={styles.mapaFallbackText}>Mapa disponible en versión web</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setDrawerOpen(true)}
          accessibilityLabel="Abrir menú"
        >
          <Ionicons name="menu" size={30} color={colores.negroSuave} />
        </TouchableOpacity>

        <Animated.View pointerEvents="none" style={[
          styles.bannerCartel,
          { opacity: bannerAnim, transform: [{ translateY: bannerAnim.interpolate({ inputRange:[0,1], outputRange:[-16,0] }) }] }
        ]}>
          <Text style={styles.bannerText} numberOfLines={2}>
            Tocá el mapa donde va el cartel
          </Text>
        </Animated.View>

        <Toast {...toast} />

        <View style={styles.botonesFlotantes}>
          <TouchableOpacity style={[styles.pill, styles.pillBlanco]} onPress={irAMiUbicacion}>
            <Text style={styles.pillText}>📍 Mi Ubicación</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pill, styles.pillBlanco]} onPress={() => setModalAmigo(true)}>
            <Text style={styles.pillText}>➕ Agregar Amigo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, modoCartel ? styles.pillVerde : styles.pillRojo]}
            onPress={() => { setModoCartel(v => !v); setMarkerTemp(null); }}>
            <Text style={styles.pillTextBlanco}>{modoCartel ? '✕ Cancelar' : '🚨 Crear Cartel'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.zoom, { bottom: sheetH === 'collapsed' ? 80 : 16 }]}>
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut}>
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
        </View>

        {popServ && <PopupServicio servicio={popServ} onClose={() => setPopServ(null)} />}
        {popPaseador && <PopupPaseador paseador={popPaseador} onClose={() => setPopPaseador(null)} />}
        {popCart && (
          <PopupCartel cartel={popCart} userId={getCurrentUserId()}
            onClose={() => setPopCart(null)}
            onEliminado={(id) => {
              setMapaData(p => ({ ...p, carteles: p.carteles.filter(c => c.id !== id) }));
              mostrarToast('Cartel eliminado', { icono: 'trash' });
            }}
          />
        )}
      </View>

      <View style={[styles.sheet, { height: sheetHeights[sheetH] }]}>
        <TouchableOpacity style={styles.handleRow}
          onPress={() => setSheetH(s => s === 'half' ? 'full' : s === 'full' ? 'collapsed' : 'half')}>
          <View style={styles.handle} />
        </TouchableOpacity>

        {sheetH !== 'collapsed' && (
          <>
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
            <View style={styles.tabBody}>
              {tab === 'Amigos'      && <TabAmigos onVerEnMapa={a => {
                if (a.lat == null || a.lng == null) { mostrarToast('Este amigo todavía no compartió su ubicación', { icono: 'location' }); return; }
                flyTo(a.lat, a.lng); setSheetH('half');
              }} />}
              {tab === 'Servicios'   && <TabServicios bbox={bbox} paseadores={mapaData.paseadores}
                servicios={mapaData.servicios} cargando={cargandoLugares}
                onSeleccionarPaseador={p => { setPopPaseador(p); setPopServ(null); flyTo(p.lat, p.lng); setSheetH('half'); }}
                onSeleccionar={s => { setPopServ(s); setPopPaseador(null); flyTo(s.lat, s.lng); setSheetH('half'); }} />}
              {tab === 'Solicitudes' && <TabSolicitudes onRespuesta={() => { mostrarToast('¡Ahora son amigos!'); cargarAmigos(); }} />}
              {tab === 'Buscar'      && <BuscadorUsuarios onSolicitudEnviada={n => mostrarToast(`Solicitud enviada a ${n}`)} />}
            </View>
          </>
        )}
      </View>

      {formulario && (
        <FormularioCartel
          coordenadas={markerTemp}
          onExito={(cartel) => {
            setFormulario(false); setMarkerTemp(null); setModoCartel(false);
            setMapaData(p => ({ ...p, carteles: [...p.carteles, cartel] }));
            mostrarToast('Cartel creado');
          }}
          onCancelar={() => { setFormulario(false); setMarkerTemp(null); setModoCartel(false); }}
        />
      )}

      <Modal visible={modalAmigo} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTit}>➕ Agregar Amigo</Text>
              <TouchableOpacity onPress={() => setModalAmigo(false)}>
                <Text style={{ fontSize: 18, color: colores.textoSecundario }}>✕</Text>
              </TouchableOpacity>
            </View>
            <BuscadorUsuarios onSolicitudEnviada={n => {
              mostrarToast(`Solicitud enviada a ${n}`);
              setModalAmigo(false);
            }} />
          </View>
        </View>
      </Modal>

      <HamburgerDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={usuario}
        mascotaActiva={mascotaActiva}
        activeRoute="Comunidad"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colores.menta },
  mapaWrapper:      { flex: 1, position: 'relative' },
  mapaFallback:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.menta },
  mapaFallbackText: { fontSize: 15, color: colores.textoSecundario, marginTop: 12 },

  backBtn: {
    position: 'absolute', top: 14, left: 14, zIndex: 100,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colores.blanco, alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  bannerCartel: {
    position: 'absolute', top: 14, left: 66, right: 14, zIndex: 100, minHeight: 42,
    justifyContent: 'center',
    backgroundColor: colores.verde, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  bannerText: { color: colores.blanco, textAlign: 'center', fontWeight: '600', fontSize: 13 },

  botonesFlotantes: { position: 'absolute', top: 60, right: 14, zIndex: 100, gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, shadowColor: colores.negro, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
  },
  pillBlanco:     { backgroundColor: colores.blanco },
  pillRojo:       { backgroundColor: colores.rojo },
  pillVerde:      { backgroundColor: colores.verde },
  pillText:       { fontWeight: '700', fontSize: 13, color: colores.texto },
  pillTextBlanco: { fontWeight: '700', fontSize: 13, color: colores.blanco },

  zoom: { position: 'absolute', right: 14, zIndex: 100, gap: 2 },
  zoomBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: colores.blanco,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colores.negro, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  zoomText: { fontSize: 20, fontWeight: '700', color: colores.texto },

  sheet: {
    backgroundColor: colores.blanco, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: colores.negro, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },
  handleRow: { alignItems: 'center', paddingVertical: 10 },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: colores.gris420 },
  tabsRow:   { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, maxHeight: 48, flexGrow: 0, flexShrink: 0 },
  tabBtn:    { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginRight: 6 },
  tabBtnOn:  { backgroundColor: colores.verde },
  tabText:   { fontSize: 13, color: colores.textoSecundario },
  tabTextOn: { color: colores.blanco, fontWeight: '700' },
  tabSep:    { height: 1, backgroundColor: colores.gris100, marginHorizontal: 16, marginBottom: 4 },
  tabBody:   { flex: 1, paddingHorizontal: 16, overflow: 'hidden' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox:     { backgroundColor: colores.blanco, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTit:     { fontSize: 16, fontWeight: '700', color: colores.texto },
});
