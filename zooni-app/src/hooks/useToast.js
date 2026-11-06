/**
 * useToast — Estado + temporizador del <Toast /> (src/components/ui/Toast.jsx).
 *
 *   const { toast, mostrarToast } = useToast();
 *   mostrarToast('Guardado');            // se oculta solo a los 2,5 s
 *   <Toast {...toast} />
 *
 * Si se muestra otro aviso antes de que termine el anterior, lo reemplaza y
 * reinicia el tiempo. Al desmontar la pantalla, el temporizador se limpia.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { colores } from '../theme';

export const DURACION_TOAST_MS = 2500;

export function useToast(duracionMs = DURACION_TOAST_MS) {
  const [toast, setToast] = useState({ visible: false, mensaje: '', color: colores.verde });
  const timer = useRef(null);

  const mostrarToast = useCallback((mensaje, color = colores.verde) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ visible: true, mensaje, color });
    timer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), duracionMs);
  }, [duracionMs]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, mostrarToast };
}
