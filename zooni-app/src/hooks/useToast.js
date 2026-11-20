/**
 * useToast — Estado + temporizador del <Toast /> (src/components/ui/Toast.jsx).
 *
 *   const { toast, mostrarToast, ocultarToast } = useToast();
 *   mostrarToast('Guardado');                          // verde, 2,5 s
 *   mostrarToast('No se pudo guardar', colores.rojo);  // color (forma corta)
 *   mostrarToast('Mascota archivada', {                // forma larga
 *     icono: 'archive', duracionMs: 6000,
 *     accion: { texto: 'Deshacer', onPress: deshacer },
 *   });
 *   <Toast {...toast} onCerrar={ocultarToast} />
 *
 * Si se muestra otro aviso antes de que termine el anterior, lo reemplaza y
 * reinicia el tiempo (no se apilan). Al desmontar la pantalla, el
 * temporizador se limpia.
 *
 * Es el ÚNICO aviso flotante de la app: antes Comunidad, Mis mascotas, Zooni
 * Negocios y Zooni Paseadores tenían cada una su propia copia.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { colores } from '../theme/colores';

export const DURACION_TOAST_MS = 2500;

const OCULTO = { visible: false, mensaje: '', color: colores.verde, icono: undefined, accion: null };

export function useToast(duracionMs = DURACION_TOAST_MS) {
  const [toast, setToast] = useState(OCULTO);
  const timer = useRef(null);

  const ocultarToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  const mostrarToast = useCallback((mensaje, opciones) => {
    const o = typeof opciones === 'string' ? { color: opciones } : (opciones ?? {});
    if (timer.current) clearTimeout(timer.current);
    setToast({
      visible: true,
      mensaje,
      color: o.color ?? colores.verde,
      icono: o.icono,
      accion: o.accion ?? null,
    });
    timer.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      o.duracionMs ?? duracionMs,
    );
  }, [duracionMs]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, mostrarToast, ocultarToast };
}
