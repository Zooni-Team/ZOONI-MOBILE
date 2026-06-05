import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

// Fallback: Buenos Aires
const BUENOS_AIRES = { latitude: -34.6037, longitude: -58.3816 };

export default function useGeolocalizacion() {
  const [location, setLocation] = useState(BUENOS_AIRES);
  const [permiso, setPermiso] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermiso(status);
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  return { location, permiso };
}
