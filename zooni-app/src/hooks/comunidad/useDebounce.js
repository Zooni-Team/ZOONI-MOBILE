/**
 * src/hooks/comunidad/useDebounce.js
 *
 * Hooks de debounce genéricos para la pantalla Comunidad.
 *
 * Exporta dos hooks:
 *
 *   useDebouncedCallback(callback, delay)
 *     Devuelve una versión debounced del callback recibido.
 *     Usos principales:
 *       - Movimiento del mapa: delay 800ms
 *         const onMapaMovido = useDebouncedCallback(fetchMapaData, 800);
 *       - Búsqueda de usuarios: delay 400ms
 *         const onBuscar = useDebouncedCallback(buscarUsuarios, 400);
 *
 *   useDebounceValue(value, delay)
 *     Devuelve una versión debounced del valor recibido.
 *     Útil para debouncing de valores de estado (p. ej. texto de búsqueda).
 *       const textoBuscado = useDebounceValue(inputValue, 400);
 *
 * Ambos hooks limpian el timer pendiente al desmontar el componente.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Devuelve una versión debounced del callback recibido.
 * El timer se cancela automáticamente al desmontar el componente.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} callback - Función a ejecutar tras el delay.
 * @param {number} delay - Tiempo de espera en milisegundos.
 * @returns {T} Versión debounced del callback.
 *
 * @example
 * // Movimiento del mapa (800ms)
 * const onMapaMovido = useDebouncedCallback((bbox) => {
 *   fetchMapaData(bbox);
 * }, 800);
 *
 * @example
 * // Búsqueda de usuarios (400ms)
 * const onBuscar = useDebouncedCallback((texto) => {
 *   buscarUsuarios(texto);
 * }, 400);
 */
export function useDebouncedCallback(callback, delay) {
  const timerRef = useRef(null);
  // Mantener siempre la referencia al callback más reciente para evitar closures obsoletas
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Limpiar el timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  return debouncedCallback;
}

/**
 * Devuelve una versión debounced del valor recibido.
 * El valor devuelto solo se actualiza cuando el valor de entrada
 * no ha cambiado durante el tiempo indicado por `delay`.
 *
 * @template T
 * @param {T} value - Valor a debouncear.
 * @param {number} delay - Tiempo de espera en milisegundos.
 * @returns {T} Valor debounced.
 *
 * @example
 * // Debouncear el texto del input de búsqueda (400ms)
 * const [inputValue, setInputValue] = useState('');
 * const textoBuscado = useDebounceValue(inputValue, 400);
 *
 * useEffect(() => {
 *   if (textoBuscado) buscarUsuarios(textoBuscado);
 * }, [textoBuscado]);
 */
export function useDebounceValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
