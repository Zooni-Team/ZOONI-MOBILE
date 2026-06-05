import { useState, useCallback, useRef } from 'react';
import { fetchMapaData, actualizarUbicacion } from '../api/comunidad';
import useDebounce from './useDebounce';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'zooni_mapa_cache';

export default function useMapaData(location) {
  const [mapaData, setMapaData] = useState({ servicios: [], carteles: [], amigos: [] });
  const [loading, setLoading] = useState(false);

  const cargarMapa = useCallback(async (bbox) => {
    setLoading(true);
    try {
      const data = await fetchMapaData(bbox);
      setMapaData(data);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));

      // Actualizar ubicación en paralelo
      if (location) {
        actualizarUbicacion(location.latitude, location.longitude).catch(() => {});
      }
    } catch (err) {
      // Sin conexión: cargar caché
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) setMapaData(JSON.parse(cached));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [location]);

  const cargarMapaDebounced = useDebounce(cargarMapa, 800);

  return { mapaData, loading, cargarMapa, cargarMapaDebounced };
}
