import { useEffect, useState } from 'react';

export function useReloj(activo, cadaMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    const t = setInterval(() => setTick((x) => x + 1), cadaMs);
    return () => clearInterval(t);
  }, [activo, cadaMs]);
}
