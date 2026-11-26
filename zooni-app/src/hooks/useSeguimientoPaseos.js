import { useCallback, useEffect, useRef, useState } from 'react';

import { distanciaMetros } from '../utils/geo';
import { fetchRecorrido, registrarPunto } from '../services/paseadorApi';

const PRECISION_MAX_M = 60;
const SALTO_MIN_M = 5;
const SALTO_MAX_M = 300;
const GUARDAR_CADA_MS = 15000;
const GUARDAR_CADA_M = 30;

function geolocalizacion() {
  return typeof navigator !== 'undefined' ? navigator.geolocation : null;
}

export default function useSeguimientoPaseos(activos, setActivos) {
  const [posicion, setPosicion] = useState(null);
  const [ruta, setRuta] = useState([]);
  const [gpsError, setGpsError] = useState(null);

  const corriendo = activos.some((p) => p.reanudadoEn);
  const hayPaseos = activos.length > 0;
  const idRuta = hayPaseos
    ? [...activos].sort((a, b) => String(a.horaInicio ?? '').localeCompare(String(b.horaInicio ?? '')))[0].id
    : null;

  const activosRef = useRef(activos);
  activosRef.current = activos;
  const ultimo = useRef(null);
  const guardado = useRef({ t: 0, metros: 0 });

  useEffect(() => {
    if (!idRuta) {
      setRuta([]);
      ultimo.current = null;
      return undefined;
    }
    let vivo = true;
    fetchRecorrido(idRuta).then((pts) => {
      if (!vivo || !pts.length) return;
      setRuta((r) => (r.length ? r : pts));
      if (!ultimo.current) ultimo.current = pts[pts.length - 1];
    });
    return () => { vivo = false; };
  }, [idRuta]);

  useEffect(() => {
    if (!corriendo) ultimo.current = null;
  }, [corriendo]);

  const onPosicion = useCallback((p) => {
    const { latitude: lat, longitude: lng, accuracy } = p.coords;
    const punto = { lat, lng };
    setPosicion(punto);
    setGpsError(null);
    if (accuracy != null && accuracy > PRECISION_MAX_M) return;

    const prev = ultimo.current;
    if (!prev) {
      ultimo.current = punto;
      setRuta((r) => [...r, punto]);
      return;
    }
    const salto = distanciaMetros(prev, punto);
    if (salto < SALTO_MIN_M) return;
    if (salto > SALTO_MAX_M) {
      ultimo.current = punto;
      setRuta((r) => [...r, punto]);
      return;
    }

    ultimo.current = punto;
    setRuta((r) => [...r, punto]);
    setActivos((lista) => lista.map((x) => (x.reanudadoEn
      ? { ...x, distanciaMetros: (x.distanciaMetros ?? 0) + salto } : x)));

    const ahora = Date.now();
    guardado.current.metros += salto;
    if (ahora - guardado.current.t > GUARDAR_CADA_MS || guardado.current.metros > GUARDAR_CADA_M) {
      guardado.current = { t: ahora, metros: 0 };
      activosRef.current.filter((x) => x.reanudadoEn).forEach((x) => {
        registrarPunto(x.id, punto, (x.distanciaMetros ?? 0) + salto).catch(() => {});
      });
    }
  }, [setActivos]);

  useEffect(() => {
    if (!hayPaseos) {
      setGpsError(null);
      return undefined;
    }
    const geo = geolocalizacion();
    if (!geo) {
      setGpsError('Este dispositivo no comparte la ubicación: el tiempo se cuenta igual.');
      return undefined;
    }
    if (!corriendo) return undefined;
    const id = geo.watchPosition(
      onPosicion,
      (err) => setGpsError(err?.code === 1
        ? 'Activá el permiso de ubicación para registrar el recorrido.'
        : 'Buscando señal de GPS…'),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
    return () => geo.clearWatch(id);
  }, [hayPaseos, corriendo, onPosicion]);

  return { posicion, ruta, gpsError };
}
