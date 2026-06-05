import React, { useRef, useEffect } from 'react';
import { StyleSheet, Animated, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const MARKER_COLORS = {
  veterinaria: '#E63946',
  paseador:    '#F5A623',
  petshop:     '#F5C842',
  peluqueria:  '#9B59B6',
};

const MARKER_EMOJIS = {
  veterinaria: '🏥',
  paseador:    '🦮',
  petshop:     '🛍️',
  peluqueria:  '✂️',
};

export default function MapaComponent({
  location,
  mapaData,
  mapRef,
  modoCartel,
  markerTemporal,
  onDoubleTap,
  onRegionChangeComplete,
  onMarkerServicioPress,
  onMarkerCartelPress,
}) {
  const pulso = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 1.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const bboxFromRegion = (region) => ({
    lat_min: region.latitude  - region.latitudeDelta  / 2,
    lat_max: region.latitude  + region.latitudeDelta  / 2,
    lng_min: region.longitude - region.longitudeDelta / 2,
    lng_max: region.longitude + region.longitudeDelta / 2,
  });

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
        latitude:       location.latitude,
        longitude:      location.longitude,
        latitudeDelta:  0.015,
        longitudeDelta: 0.015,
      }}
      onDoublePress={modoCartel ? onDoubleTap : undefined}
      onRegionChangeComplete={(region) => onRegionChangeComplete(bboxFromRegion(region))}
      showsUserLocation={false}
      provider="google"
    >
      {/* Marker del usuario — círculo azul pulsante */}
      <Marker
        coordinate={location}
        accessibilityLabel="Tu ubicación actual"
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
      >
        <View style={styles.userMarkerContainer}>
          <Animated.View style={[styles.userPulse, { transform: [{ scale: pulso }] }]} />
          <View style={styles.userDot} />
        </View>
      </Marker>

      {/* Markers de servicios */}
      {(mapaData.servicios || []).map((s) => (
        <Marker
          key={`serv-${s.id}`}
          coordinate={{ latitude: s.lat, longitude: s.lng }}
          onPress={() => onMarkerServicioPress(s)}
          accessibilityLabel={`${s.tipo}: ${s.nombre}`}
          tracksViewChanges={false}
        >
          <View style={[styles.iconMarker, { backgroundColor: MARKER_COLORS[s.tipo] || '#888' }]}>
            <Animated.Text style={styles.iconText}>
              {MARKER_EMOJIS[s.tipo] || '📍'}
            </Animated.Text>
          </View>
        </Marker>
      ))}

      {/* Markers de carteles */}
      {(mapaData.carteles || []).map((c) => (
        <Marker
          key={`cartel-${c.id}`}
          coordinate={{ latitude: c.lat, longitude: c.lng }}
          onPress={() => onMarkerCartelPress(c)}
          accessibilityLabel={`Cartel ${c.tipo}: ${c.mascota_nombre || 'sin nombre'}`}
          tracksViewChanges={false}
        >
          <View style={[
            styles.iconMarker,
            { backgroundColor: c.tipo === 'perdida' ? '#E63946' : '#6B6B6B' },
          ]}>
            <Animated.Text style={styles.iconText}>
              {c.tipo === 'perdida' ? '🔴' : '📌'}
            </Animated.Text>
          </View>
        </Marker>
      ))}

      {/* Markers de amigos */}
      {(mapaData.amigos || []).map((a) => (
        <Marker
          key={`amigo-${a.usuario_id}`}
          coordinate={{ latitude: a.lat, longitude: a.lng }}
          accessibilityLabel={`Amigo: ${a.nombre}`}
          tracksViewChanges={false}
        >
          <View style={styles.amigoAvatar}>
            <Animated.Text style={{ fontSize: 16 }}>👤</Animated.Text>
          </View>
        </Marker>
      ))}

      {/* Marker temporal modo cartel */}
      {markerTemporal && (
        <Marker
          coordinate={markerTemporal}
          accessibilityLabel="Ubicación del nuevo cartel"
          pinColor="#2DBD72"
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  userPulse: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(33,150,243,0.25)',
  },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  iconMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  iconText: { fontSize: 15 },
  amigoAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    borderWidth: 2.5,
    borderColor: '#2DBD72',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});
