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
