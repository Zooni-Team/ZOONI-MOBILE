import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

// Fallback: Buenos Aires, CABA
const BUENOS_AIRES = {
  latitude: -34.6037,
  longitude: -58.3816,
};

/**
 * Convierte un nivel de zoom (0–20) al delta de latitud/longitud
 * que usa react-native-maps para la región inicial.
 * A zoom 15 el delta es aproximadamente 0.01°.
 */
const zoomToLatitudeDelta = (zoom) => {
  return 360 / Math.pow(2, zoom);
};

/**
 * MarkerUsuario
 *
 * Círculo azul #2196F3 con animación de pulso radial continua.
 * El anillo exterior escala de 1.0 → 1.4 → 1.0 en loop usando
 * Animated.loop con useNativeDriver: true.
 */
function MarkerUsuario() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={markerStyles.container} accessibilityLabel="Tu ubicación actual">
      {/* Anillo exterior animado */}
      <Animated.View
        style={[
          markerStyles.outerRing,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      {/* Círculo interior sólido */}
      <View style={markerStyles.innerCircle} />
    </View>
  );
}

const markerStyles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
  },
  innerCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
  },
});

/**
 * Configuración de íconos y colores por tipo de servicio.
 * veterinaria → cruz roja #E63946
 * paseador    → naranja #F5A623
 * petshop     → amarillo #F5C842
 * peluqueria  → violeta #9B59B6
 */
const SERVICIO_CONFIG = {
  veterinaria: { color: '#E63946', icono: '🏥' },
  paseador:    { color: '#F5A623', icono: '🐾' },
  petshop:     { color: '#F5C842', icono: '🛒' },
  peluqueria:  { color: '#9B59B6', icono: '✂️' },
};

/**
 * Configuración de íconos y colores por tipo de cartel.
 * perdida       → rojo #E63946 con ícono 🐾
 * encontrada    → gris #6B6B6B con ícono 📍
 * adopcion      → gris #6B6B6B con ícono 📍
 * aviso_general → gris #6B6B6B con ícono 📍
 */
const CARTEL_CONFIG = {
  perdida:       { color: '#E63946', icono: '🐾' },
  encontrada:    { color: '#6B6B6B', icono: '📍' },
  adopcion:      { color: '#6B6B6B', icono: '📍' },
  aviso_general: { color: '#6B6B6B', icono: '📍' },
};

/**
 * MarkerCartel
 *
 * Círculo con fondo del color del tipo de cartel y un emoji/ícono centrado.
 * - perdida: rojo #E63946 con 🐾
 * - otros tipos: gris #6B6B6B con 📍
 *
 * Props:
 *   tipo   'perdida' | 'encontrada' | 'adopcion' | 'aviso_general'
 */
function MarkerCartel({ tipo }) {
  const config = CARTEL_CONFIG[tipo] ?? { color: '#6B6B6B', icono: '📍' };

  return (
    <View
      style={[cartelMarkerStyles.container, { backgroundColor: config.color }]}
    >
      <Text style={cartelMarkerStyles.icono}>{config.icono}</Text>
    </View>
  );
}

const cartelMarkerStyles = StyleSheet.create({
  container: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra para destacar sobre el mapa
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  icono: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
});

/**
 * MarkerServicio
 *
 * Círculo con fondo del color del tipo de servicio y un emoji/ícono centrado.
 *
 * Props:
 *   tipo   'veterinaria' | 'paseador' | 'petshop' | 'peluqueria'
 */
function MarkerServicio({ tipo }) {
  const config = SERVICIO_CONFIG[tipo] ?? { color: '#888888', icono: '📍' };

  return (
    <View
      style={[servicioMarkerStyles.container, { backgroundColor: config.color }]}
    >
      <Text style={servicioMarkerStyles.icono}>{config.icono}</Text>
    </View>
  );
}

const servicioMarkerStyles = StyleSheet.create({
  container: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra para destacar sobre el mapa
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  icono: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
});

/**
 * MarkerTemporal
 *
 * Círculo verde #2DBD72 con animación de pulso radial continua.
 * Se muestra en el modo cartel para indicar la posición seleccionada
 * con un doble tap antes de confirmar la creación del cartel.
 * El anillo exterior escala de 1.0 → 1.5 → 1.0 en loop usando
 * Animated.loop con useNativeDriver: true.
 */
function MarkerTemporal() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={markerTemporalStyles.container} accessibilityLabel="Posición seleccionada para el cartel">
      {/* Anillo exterior animado */}
      <Animated.View
        style={[
          markerTemporalStyles.outerRing,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      {/* Círculo interior sólido */}
      <View style={markerTemporalStyles.innerCircle} />
    </View>
  );
}

const markerTemporalStyles = StyleSheet.create({
  container: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(45, 189, 114, 0.3)',
  },
  innerCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2DBD72',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    // Sombra para destacar sobre el mapa
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
});

/**
 * MarkerAmigo
 *
 * Avatar circular de 40px con borde verde #2DBD72.
 * Muestra la foto de perfil del amigo si está disponible;
 * si no, muestra las iniciales del nombre sobre fondo verde.
 *
 * Props:
 *   nombre          string  — nombre del amigo (para iniciales y accesibilidad)
 *   foto_perfil_url string | null  — URL de la foto de perfil
 */
function MarkerAmigo({ nombre, foto_perfil_url }) {
  // Obtener iniciales: primera letra del primer y segundo nombre (si existe)
  const getIniciales = (nombreCompleto) => {
    if (!nombreCompleto) return '?';
    const partes = nombreCompleto.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
  };

  return (
    <View style={amigoMarkerStyles.container}>
      {foto_perfil_url ? (
        <Image
          source={{ uri: foto_perfil_url }}
          style={amigoMarkerStyles.avatar}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={amigoMarkerStyles.avatarFallback}>
          <Text style={amigoMarkerStyles.iniciales}>
            {getIniciales(nombre)}
          </Text>
        </View>
      )}
    </View>
  );
}

const amigoMarkerStyles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#2DBD72',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    // Sombra para destacar sobre el mapa
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2DBD72',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciales: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

/**
 * MapaComponent
 *
 * Componente base del mapa interactivo de la pantalla Comunidad.
 * Renderiza un MapView a pantalla completa centrado en la ubicación
 * del usuario (o Buenos Aires como fallback) con zoom inicial 15.
 *
 * Props:
 *   ubicacionUsuario  { lat, lng } | null  — posición actual del usuario
 *   markers           { servicios, carteles, amigos }  — datos de markers (tareas 5.2–5.9)
 *   modoCartel        boolean  — activa el modo de creación de cartel
 *   markerTemporal    { lat, lng } | null  — posición del marker temporal pulsante (modo cartel)
 *   onMapaMovido      (bbox) => void  — callback al mover el mapa
 *   onDoubleTap       (coordenadas) => void  — callback al hacer doble tap
 *   onMarkerPress     (marker) => void  — callback al tocar un marker
 *   zoomLevel         number  — nivel de zoom actual
 *
 * Ref expuesto:
 *   animateToRegion(region, duration?)  — centra el mapa en una región
 *   animateToCoordinate(coord, duration?)  — centra el mapa en una coordenada
 */
const MapaComponent = forwardRef(function MapaComponent(
  {
    ubicacionUsuario = null,
    markers = { servicios: [], carteles: [], amigos: [] },
    modoCartel = false,
    markerTemporal = null,
    onMapaMovido,
    onDoubleTap,
    onMarkerPress,
    zoomLevel = 15,
  },
  ref
) {
  const mapRef = useRef(null);

  // Determinar la región inicial según la ubicación del usuario o el fallback
  const latitudeDelta = zoomToLatitudeDelta(zoomLevel);
  const longitudeDelta = latitudeDelta; // proporción 1:1 como punto de partida

  const initialRegion = {
    latitude: ubicacionUsuario?.lat ?? BUENOS_AIRES.latitude,
    longitude: ubicacionUsuario?.lng ?? BUENOS_AIRES.longitude,
    latitudeDelta,
    longitudeDelta,
  };

  // Exponer métodos del mapa al componente padre via ref
  useImperativeHandle(ref, () => ({
    animateToRegion: (region, duration = 500) => {
      mapRef.current?.animateToRegion(region, duration);
    },
    animateToCoordinate: (coordinate, duration = 500) => {
      mapRef.current?.animateToRegion(
        {
          latitude: coordinate.lat ?? coordinate.latitude,
          longitude: coordinate.lng ?? coordinate.longitude,
          latitudeDelta: zoomToLatitudeDelta(zoomLevel),
          longitudeDelta: zoomToLatitudeDelta(zoomLevel),
        },
        duration
      );
    },
  }));

  // Calcular el bounding box a partir de la región visible y notificar al padre
  const handleRegionChangeComplete = (region) => {
    if (!onMapaMovido) return;

    const bbox = {
      lat_min: region.latitude - region.latitudeDelta / 2,
      lat_max: region.latitude + region.latitudeDelta / 2,
      lng_min: region.longitude - region.longitudeDelta / 2,
      lng_max: region.longitude + region.longitudeDelta / 2,
    };

    onMapaMovido(bbox);
  };

  // Doble tap sobre el mapa (usado en modo cartel)
  const handleDoublePress = (event) => {
    if (!onDoubleTap || !modoCartel) return;

    const { coordinate } = event.nativeEvent;
    onDoubleTap({ lat: coordinate.latitude, lng: coordinate.longitude });
  };

  return (
    <View style={styles.container}>
      <ClusteredMapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        onDoublePress={handleDoublePress}
        // Deshabilitar el doble tap nativo del mapa para capturarlo manualmente
        zoomTapEnabled={false}
        showsUserLocation={false}   // usamos marker propio (tarea 5.2)
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        accessibilityLabel="Mapa de la comunidad Zooni"
        // Clustering: radio de 50px en pantalla
        radius={50}
        renderCluster={(cluster) => {
          const { id, geometry, onPress, properties } = cluster;
          const count = properties.point_count;
          const coordinate = {
            latitude: geometry.coordinates[1],
            longitude: geometry.coordinates[0],
          };
          return (
            <Marker
              key={`cluster-${id}`}
              coordinate={coordinate}
              onPress={onPress}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              accessibilityLabel={`Grupo de ${count} marcadores`}
              accessibilityRole="button"
            >
              <View style={clusterStyles.container}>
                <Text style={clusterStyles.text}>{count}</Text>
              </View>
            </Marker>
          );
        }}
      >
        {/* Marker del usuario (tarea 5.2) */}
        {ubicacionUsuario && (
          <Marker
            coordinate={{
              latitude: ubicacionUsuario.lat,
              longitude: ubicacionUsuario.lng,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <MarkerUsuario />
          </Marker>
        )}
        {/* Los demás markers se agregarán en las tareas 5.3–5.9 */}
        {/* Markers de servicios (tarea 5.3) */}
        {(markers.servicios ?? []).map((servicio) => (
          <Marker
            key={servicio.id}
            coordinate={{
              latitude: servicio.lat,
              longitude: servicio.lng,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => onMarkerPress?.({ tipo: 'servicio', data: servicio })}
            accessibilityLabel={`${servicio.tipo}: ${servicio.nombre}, ${servicio.distancia_km} km`}
            accessibilityRole="button"
          >
            <MarkerServicio tipo={servicio.tipo} />
          </Marker>
        ))}
        {/* Markers de carteles (tarea 5.4) */}
        {(markers.carteles ?? []).map((cartel) => (
          <Marker
            key={cartel.id}
            coordinate={{
              latitude: cartel.lat,
              longitude: cartel.lng,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => onMarkerPress?.({ tipo: 'cartel', data: cartel })}
            accessibilityLabel={`Cartel: ${cartel.tipo}, ${cartel.mascota_nombre}`}
            accessibilityRole="button"
          >
            <MarkerCartel tipo={cartel.tipo} />
          </Marker>
        ))}
        {/* Markers de amigos (tarea 5.5) */}
        {(markers.amigos ?? []).map((amigo) => (
          <Marker
            key={amigo.usuario_id}
            coordinate={{
              latitude: amigo.lat,
              longitude: amigo.lng,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => onMarkerPress?.({ tipo: 'amigo', data: amigo })}
            accessibilityLabel={`Amigo: ${amigo.nombre}, ${amigo.distancia_km} km`}
            accessibilityRole="button"
          >
            <MarkerAmigo
              nombre={amigo.nombre}
              foto_perfil_url={amigo.foto_perfil_url}
            />
          </Marker>
        ))}
        {/* Marker temporal para modo cartel (tarea 5.7) */}
        {modoCartel && markerTemporal && (
          <Marker
            coordinate={{
              latitude: markerTemporal.lat,
              longitude: markerTemporal.lng,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges
            accessibilityLabel="Posición seleccionada para el cartel"
            accessibilityRole="image"
          >
            <MarkerTemporal />
          </Marker>
        )}
      </ClusteredMapView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

const clusterStyles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra para destacar sobre el mapa
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default MapaComponent;
