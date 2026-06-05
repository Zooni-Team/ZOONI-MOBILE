import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Alert,
  SafeAreaView, TouchableOpacity,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import MapaComponent     from '../components/MapaComponent';
import BotonesFlotantes  from '../components/BotonesFlotantes';
import ControlesZoom     from '../components/ControlesZoom';
import PopupServicio     from '../components/PopupServicio';
import PopupCartel       from '../components/PopupCartel';
import FormularioCartel  from '../components/FormularioCartel';
import TabAmigos         from '../components/TabAmigos';
import TabServicios      from '../components/TabServicios';
import TabSolicitudes    from '../components/TabSolicitudes';
import BuscadorUsuarios  from '../components/BuscadorUsuarios';

import useGeolocalizacion from '../hooks/useGeolocalizacion';
import useMapaData        from '../hooks/useMapaData';
import { actualizarUbicacion } from '../api/comunidad';

// ID del usuario autenticado — en producción viene del contexto/auth
const USER_ID = 1;

const TABS = ['Amigos', 'Servicios', 'Solicitudes', 'Buscar'];
const SNAP_POINTS = ['10%', '45%', '90%'];

export default function ComunidadScreen() {
  const mapRef = useRef(null);
  const bottomSheetRef = useRef(null);

  const { location, permiso } = useGeolocalizacion();
  const { mapaData, cargarMapa, cargarMapaDebounced } = useMapaData(location);

  const [bbox, setBbox]                   = useState(null);
  const [tabActivo, setTabActivo]         = useState('Amigos');
  const [modoCartel, setModoCartel]       = useState(false);
  const [markerTemporal, setMarkerTemp]   = useState(null);
  const [mostrarFormulario, setFormulario]= useState(false);
  const [popupServicio, setPopupServicio] = useState(null);
  const [popupCartel, setPopupCartel]     = useState(null);
  const [modalAmigo, setModalAmigo]       = useState(false);
  const [toast, setToast]                 = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslate = useRef(new Animated.Value(-20)).current;
  const [zoom, setZoom] = useState(15);

  // Carga inicial del mapa
  useEffect(() => {
    const initialBbox = {
      lat_min: location.latitude  - 0.01,
      lat_max: location.latitude  + 0.01,
      lng_min: location.longitude - 0.01,
      lng_max: location.longitude + 0.01,
    };
    cargarMapa(initialBbox);
    setBbox(initialBbox);
  }, [location]);

  // Polling cada 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (bbox) cargarMapa(bbox);
      if (location) actualizarUbicacion(location.latitude, location.longitude).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [bbox, location]);

  // Animación del banner modo cartel
  useEffect(() => {
    if (modoCartel) {
      Animated.parallel([
        Animated.timing(bannerOpacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(bannerTranslate,  { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(bannerOpacity,    { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(bannerTranslate,  { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [modoCartel]);

  // Toast helper
  const mostrarToast = (msg) => {
    setToast(msg);
    toastOpacity.setValue(1);
    setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start();
    }, 2500);
  };

  // Región cambiada
  const handleRegionChange = useCallback((newBbox) => {
    setBbox(newBbox);
    cargarMapaDebounced(newBbox);
  }, [cargarMapaDebounced]);

  // Doble tap en mapa → colocar marker temporal
  const handleDoubleTap = (e) => {
    const coord = e.nativeEvent.coordinate;
    setMarkerTemp(coord);
    setFormulario(true);
  };

  // Centrar mapa en mi ubicación
  const centrarEnMiUbicacion = () => {
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 500);
  };

  // Zoom
  const handleZoomIn  = () => mapRef.current?.animateCamera({ zoom: zoom + 1 });
  const handleZoomOut = () => mapRef.current?.animateCamera({ zoom: zoom - 1 });

  // Cartel creado exitosamente
  const onCartelCreado = (nuevoCartel) => {
    setFormulario(false);
    setMarkerTemp(null);
    setModoCartel(false);
    mostrarToast('✅ Cartel creado exitosamente');
    if (bbox) cargarMapa(bbox);
  };

  // Cartel eliminado
  const onCartelEliminado = (id) => {
    mostrarToast('🗑️ Cartel eliminado');
    if (bbox) cargarMapa(bbox);
  };

  // Ver amigo en mapa
  const verAmigoEnMapa = (amigo) => {
    mapRef.current?.animateToRegion({
      latitude: amigo.lat,
      longitude: amigo.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
    bottomSheetRef.current?.snapToIndex(0);
  };

  // Seleccionar servicio desde la lista
  const onSeleccionarServicio = (s) => {
    setPopupServicio(s);
    mapRef.current?.animateToRegion({
      latitude: s.lat, longitude: s.lng,
      latitudeDelta: 0.01, longitudeDelta: 0.01,
    }, 400);
    bottomSheetRef.current?.snapToIndex(0);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>

        {/* Mapa pantalla completa */}
        <MapaComponent
          location={location}
          mapaData={mapaData}
          mapRef={mapRef}
          modoCartel={modoCartel}
          markerTemporal={markerTemporal}
          onDoubleTap={handleDoubleTap}
          onRegionChangeComplete={handleRegionChange}
          onMarkerServicioPress={(s) => { setPopupServicio(s); setPopupCartel(null); }}
          onMarkerCartelPress={(c)   => { setPopupCartel(c);   setPopupServicio(null); }}
        />

        {/* Header hamburguesa flotante */}
        <View style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Menú principal">
          <Text style={styles.hamburger}>☰</Text>
        </View>

        {/* Banner modo cartel */}
        <Animated.View style={[
          styles.bannerCartel,
          { opacity: bannerOpacity, transform: [{ translateY: bannerTranslate }] },
        ]}>
          <Text style={styles.bannerText}>
            Hacé doble tap en el mapa donde querés crear el cartel
          </Text>
        </Animated.View>

        {/* Sin permiso de ubicación */}
        {permiso === 'denied' && (
          <View style={styles.bannerSinPermiso}>
            <Text style={styles.bannerSinPermisoText}>
              📍 Sin permiso de ubicación — mostrando Buenos Aires
            </Text>
          </View>
        )}

        {/* Botones flotantes */}
        <BotonesFlotantes
          modoCartel={modoCartel}
          onMiUbicacion={centrarEnMiUbicacion}
          onAgregarAmigo={() => setModalAmigo(true)}
          onCrearCartel={() => setModoCartel((v) => !v)}
        />

        {/* Controles de zoom */}
        <ControlesZoom onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />

        {/* Toast */}
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>

        {/* Popups */}
        {popupServicio && (
          <PopupServicio
            servicio={popupServicio}
            onClose={() => setPopupServicio(null)}
          />
        )}
        {popupCartel && (
          <PopupCartel
            cartel={popupCartel}
            userId={USER_ID}
            onClose={() => setPopupCartel(null)}
            onEliminado={onCartelEliminado}
          />
        )}

        {/* Modal formulario cartel */}
        <Modal visible={mostrarFormulario} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <FormularioCartel
              coordenadas={markerTemporal}
              onExito={onCartelCreado}
              onCancelar={() => {
                setFormulario(false);
                setMarkerTemp(null);
                setModoCartel(false);
              }}
            />
          </View>
        </Modal>

        {/* Modal agregar amigo */}
        <Modal visible={modalAmigo} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitulo}>➕ Agregar Amigo</Text>
                <TouchableOpacity onPress={() => setModalAmigo(false)}>
                  <Text style={styles.cerrar}>✕</Text>
                </TouchableOpacity>
              </View>
              <BuscadorUsuarios
                onSolicitudEnviada={(nombre) => {
                  mostrarToast(`✅ Solicitud enviada a ${nombre}`);
                  setModalAmigo(false);
                }}
              />
            </View>
          </View>
        </Modal>

        {/* Bottom Sheet */}
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={SNAP_POINTS}
          index={1}
          handleIndicatorStyle={styles.handle}
          backgroundStyle={styles.sheetBg}
        >
          <BottomSheetView style={styles.sheetContent} accessibilityViewIsModal={false}>
            {/* Tabs */}
            <View style={styles.tabsRow}>
              {TABS.map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, tabActivo === tab && styles.tabActivo]}
                  onPress={() => setTabActivo(tab)}
                  accessibilityLabel={`Tab ${tab}`}
                  accessibilityRole="tab"
                >
                  <Text style={[styles.tabText, tabActivo === tab && styles.tabTextoActivo]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.tabSeparador} />

            {/* Contenido del tab */}
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              {tabActivo === 'Amigos'      && <TabAmigos onVerEnMapa={verAmigoEnMapa} />}
              {tabActivo === 'Servicios'   && (
                <TabServicios bbox={bbox} onSeleccionarServicio={onSeleccionarServicio} />
              )}
              {tabActivo === 'Solicitudes' && (
                <TabSolicitudes onRespuesta={() => {
                  mostrarToast('✅ ¡Ahora son amigos!');
                  if (bbox) cargarMapa(bbox);
                }} />
              )}
              {tabActivo === 'Buscar' && (
                <BuscadorUsuarios
                  onSolicitudEnviada={(nombre) => mostrarToast(`✅ Solicitud enviada a ${nombre}`)}
                />
              )}
            </View>
          </BottomSheetView>
        </BottomSheet>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#C8F0D8' },
  headerBtn: {
    position: 'absolute',
    top: 50,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  hamburger: { fontSize: 20, color: '#2C2C2C' },
  bannerCartel: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: '#2DBD72',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  bannerText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 13 },
  bannerSinPermiso: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: '#F5A623',
    borderRadius: 10,
    padding: 10,
  },
  bannerSinPermisoText: { color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: '600' },
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: '#2DBD72',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  toastText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  sheetBg:      { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetContent: { flex: 1 },
  handle:       { backgroundColor: '#CCCCCC', width: 40, height: 4 },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
    flexWrap: 'nowrap',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabActivo: { backgroundColor: '#2DBD72' },
  tabText:   { color: '#6B6B6B', fontSize: 13 },
  tabTextoActivo: { color: '#fff', fontWeight: 'bold' },
  tabSeparador: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitulo: { fontSize: 16, fontWeight: 'bold', color: '#2C2C2C' },
  cerrar: { fontSize: 18, color: '#6B6B6B' },
});
