import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';

// Fallback: Buenos Aires, CABA
const BUENOS_AIRES = { lat: -34.6037, lng: -58.3816 };

const MENSAJE_PERMISO =
  'Zooni necesita tu ubicación para mostrarte servicios y amigos cercanos';

/**
 * Hook de geolocalización para la pantalla Comunidad.
 *
 * - Solicita permiso de geolocalización al montar.
 * - Si se otorga: obtiene la posición actual y devuelve { lat, lng }.
 * - Si se deniega: usa Buenos Aires CABA como fallback.
 *
 * @returns {{ ubicacion: { lat: number, lng: number }, permiso: 'granted' | 'denied' | 'pending' }}
 */
function useGeolocalizacion() {
  const [ubicacion, setUbicacion] = useState(null);
  const [permiso, setPermiso] = useState('pending');

  useEffect(() => {
    let cancelado = false;

    async function solicitarUbicacion() {
      try {
        if (Platform.OS === 'web') {
          // Web: usar la API del navegador
          if (!navigator.geolocation) {
            if (!cancelado) {
              setPermiso('denied');
              setUbicacion(BUENOS_AIRES);
            }
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (!cancelado) {
                setUbicacion({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                });
                setPermiso('granted');
              }
            },
            () => {
              if (!cancelado) {
                setPermiso('denied');
                setUbicacion(BUENOS_AIRES);
              }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
          return;
        }

        // React Native (iOS / Android)
        // Importación dinámica para evitar errores en entornos web
        const { PermissionsAndroid, Geolocation } = await import('react-native');

        if (Platform.OS === 'android') {
          // En Android hay que solicitar el permiso explícitamente
          const resultado = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Permiso de ubicación',
              message: MENSAJE_PERMISO,
              buttonPositive: 'Permitir',
              buttonNegative: 'Denegar',
            }
          );

          if (resultado !== PermissionsAndroid.RESULTS.GRANTED) {
            if (!cancelado) {
              setPermiso('denied');
              setUbicacion(BUENOS_AIRES);
            }
            return;
          }
        } else {
          // iOS: el permiso se solicita automáticamente al llamar getCurrentPosition.
          // Mostramos el mensaje informativo antes de la solicitud del sistema.
          Alert.alert('Ubicación', MENSAJE_PERMISO, [{ text: 'Continuar' }]);
        }

        Geolocation.getCurrentPosition(
          (position) => {
            if (!cancelado) {
              setUbicacion({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
              setPermiso('granted');
            }
          },
          () => {
            if (!cancelado) {
              setPermiso('denied');
              setUbicacion(BUENOS_AIRES);
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      } catch {
        // Cualquier error inesperado → fallback a Buenos Aires
        if (!cancelado) {
          setPermiso('denied');
          setUbicacion(BUENOS_AIRES);
        }
      }
    }

    solicitarUbicacion();

    return () => {
      cancelado = true;
    };
  }, []);

  return { ubicacion, permiso };
}

export default useGeolocalizacion;
