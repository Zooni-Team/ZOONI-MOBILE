/**
 * secciones.js — Catálogo de todas las secciones de la app Zooni
 *
 * Define la lista maestra de secciones disponibles.
 * Se usa en dos lugares:
 *   1. HomeScreen → para renderizar los botones de navegación dinámicos
 *   2. AddButtonModal → para mostrar qué secciones se pueden agregar a la Home
 *
 * Cada sección tiene:
 *   key   → identificador único (se guarda en la DB como nombre de sección)
 *   label → texto que se muestra en el botón
 *   icono → nombre del ícono de Ionicons
 *   ruta  → nombre de la pantalla en el Stack Navigator (App.jsx)
 */

export const TODAS_LAS_SECCIONES = [
  { key: 'inicio',        label: 'Inicio',                    icono: 'home-outline',               ruta: 'Home' },
  { key: 'comunidad',     label: 'Comunidad',                 icono: 'people-outline',              ruta: 'Comunidad' },
  { key: 'match',         label: 'Match',                     icono: 'paw-outline',                 ruta: 'Match' },
  { key: 'planificador',  label: 'Planificador de Servicios', icono: 'calendar-outline',            ruta: 'Planificador' },
  { key: 'ficha_medica',  label: 'Ficha Médica',              icono: 'medkit-outline',              ruta: 'FichaMedica' },
  { key: 'calendario',    label: 'Calendario',                icono: 'today-outline',               ruta: 'Calendario' },
  { key: 'eventos',       label: 'Eventos',                   icono: 'sparkles-outline',            ruta: 'Eventos' },
  { key: 'chatbot',       label: 'ChatBot',                   icono: 'chatbubble-ellipses-outline', ruta: 'ChatBot' },
  { key: 'closet',        label: 'Closet',                    icono: 'shirt-outline',               ruta: 'Closet' },
  { key: 'perfil',        label: 'Perfil',                    icono: 'person-outline',              ruta: 'Perfil' },
  { key: 'configuracion', label: 'Configuración',             icono: 'settings-outline',            ruta: 'Configuracion' },
];

// Botones que aparecen por defecto en la Home si el usuario no personalizó nada
export const DEFAULT_BOTONES_HOME = ['comunidad', 'ficha_medica', 'mis_mascotas'];

/**
 * getSeccion(key) — Busca una sección por su key
 * Retorna el objeto completo o undefined si no existe.
 * Se usa en HomeScreen para obtener label, icono y ruta de cada botón.
 */
export function getSeccion(key) {
  return TODAS_LAS_SECCIONES.find((s) => s.key === key);
}
