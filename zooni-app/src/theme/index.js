/**
 * theme/ — Sistema de diseño de Zooni. Punto de entrada único:
 *
 *   import { colores, sombras, useTheme } from '../theme';
 *
 *   colores.js        paleta (todo color repetido sale de acá)
 *   sombras.js        sombras compartidas
 *   ThemeProvider.js  preferencias del dispositivo (tamaño de texto, contraste…)
 *
 * Guía de uso: docs/claude/estilos.md
 */

export { colores, COLOR_POR_HEX } from './colores';
export { sombras } from './sombras';
export { ThemeProvider, useTheme, escalaDeTexto } from './ThemeProvider';
