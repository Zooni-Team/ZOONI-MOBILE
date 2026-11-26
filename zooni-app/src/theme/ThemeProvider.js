import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { getSettings, subscribeSettings } from '../services/settingsStore';

const ESCALA_POR_TAMANO = {
  small: 0.85, normal: 1, large: 1.15, xlarge: 1.3, max: 1.5,
};

export function escalaDeTexto(textSize) {
  return ESCALA_POR_TAMANO[textSize] ?? 1;
}

let escalaGlobal = 1;

(function parchearText() {
  if (Text.__zooniPatched) return;
  const renderOriginal = Text.render;
  if (typeof renderOriginal !== 'function') return;

  Text.render = function zooniText(props, ref) {
    if (escalaGlobal !== 1 && props) {
      const estilo = StyleSheet.flatten(props.style) || {};
      const baseFont = estilo.fontSize ?? 14;
      const extra = { fontSize: baseFont * escalaGlobal };
      if (estilo.lineHeight) extra.lineHeight = estilo.lineHeight * escalaGlobal;
      props = { ...props, style: [props.style, extra] };
    }
    return renderOriginal.call(this, props, ref);
  };
  Text.__zooniPatched = true;
})();

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

  escalaGlobal = escalaDeTexto(device.text_size);

  const value = {
    theme: device.theme === 'dark' ? 'light' : device.theme,
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
