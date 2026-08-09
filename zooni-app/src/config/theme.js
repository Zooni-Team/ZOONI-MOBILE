/**
 * theme.js — Tema de la app (Configuración › Tema de la aplicación)
 *
 * Preferencias de DISPOSITIVO (viven en settingsStore, no sincronizan).
 * Lo que se aplica de verdad hoy:
 *   · Tamaño del texto → escala TODA la tipografía de la app (ver abajo).
 *   · Reducir movimiento / Alto contraste → expuestos por useTheme() para que
 *     los componentes que los soportan los respeten.
 *
 * Modo oscuro: no está implementado como tema real (las pantallas usan colores
 * fijos). La opción se muestra como "Próximamente" en TemaScreen; acá 'dark' se
 * resuelve como 'light' para no romper nada.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { getSettings, subscribeSettings } from '../services/settingsStore';

// text_size → multiplicador de tamaño de fuente
const ESCALA_POR_TAMANO = {
  small: 0.85, normal: 1, large: 1.15, xlarge: 1.3, max: 1.5,
};

export function escalaDeTexto(textSize) {
  return ESCALA_POR_TAMANO[textSize] ?? 1;
}

// La escala vigente. El override de Text.render la lee en cada render, así que
// cuando cambia + el árbol se re-renderiza, toda la tipografía se reescala.
let escalaGlobal = 1;

// ── Escalado global de la tipografía ────────────────────────────────────────
// Text (RN y react-native-web) es un forwardRef con .render. Se envuelve una
// sola vez para inyectar un fontSize escalado en los PROPS DE ENTRADA, antes de
// que cada plataforma procese el estilo. (Modificar el estilo del elemento ya
// renderizado no sirve en web: ahí los estilos ya se convirtieron a CSS.)
(function parchearText() {
  if (Text.__zooniPatched) return;
  const renderOriginal = Text.render;
  if (typeof renderOriginal !== 'function') return; // por si cambia la versión de RN

  Text.render = function zooniText(props, ref) {
    if (escalaGlobal !== 1 && props) {
      const estilo = StyleSheet.flatten(props.style) || {};
      const baseFont = estilo.fontSize ?? 14; // default de RN
      const extra = { fontSize: baseFont * escalaGlobal };
      if (estilo.lineHeight) extra.lineHeight = estilo.lineHeight * escalaGlobal;
      props = { ...props, style: [props.style, extra] };
    }
    return renderOriginal.call(this, props, ref);
  };
  Text.__zooniPatched = true;
})();

// ── Contexto ────────────────────────────────────────────────────────────────

const ThemeContext = createContext({
  theme: 'light',
  textSize: 'normal',
  fontScale: 1,
  reduceMotion: false,
  highContrast: false,
});

export function ThemeProvider({ children }) {
  const [device, setDevice] = useState(() => ({ ...getSettings().device }));

  useEffect(() => subscribeSettings(() => setDevice({ ...getSettings().device })), []);

  // Actualizar la escala ANTES de renderizar los hijos: al re-renderizar el
  // árbol, cada <Text> toma el nuevo valor.
  escalaGlobal = escalaDeTexto(device.text_size);

  const value = {
    theme: device.theme === 'dark' ? 'light' : device.theme, // dark aún no existe
    textSize: device.text_size,
    fontScale: escalaGlobal,
    reduceMotion: !!device.reduce_motion,
    highContrast: !!device.high_contrast,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
