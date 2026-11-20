/**
 * useReloj — Re-dibuja SÓLO el componente que lo usa cada `cadaMs` mientras
 * `activo` sea true (para cronómetros: "12:34" que avanza solo).
 *
 *   function Tiempo({ paseo }) {
 *     useReloj(!!paseo.reanudadoEn);
 *     return <Text>{formatoTimer(segundosDePaseo(paseo))}</Text>;
 *   }
 *
 * Antes cada pantalla de paseos tenía su propio setTick cada 1 s y se volvía a
 * dibujar ENTERA (mapa, listas, modales) sólo para mover el cronómetro.
 */

import { useEffect, useState } from 'react';

export function useReloj(activo, cadaMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    const t = setInterval(() => setTick((x) => x + 1), cadaMs);
    return () => clearInterval(t);
  }, [activo, cadaMs]);
}
