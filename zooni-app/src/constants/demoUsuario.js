/**
 * demoUsuario.js — Usuario y mascota activa de demo
 *
 * Se muestran en el HamburgerDrawer cuando el backend no responde,
 * para que el menú lateral nunca aparezca vacío (mismos datos que
 * usa HomeScreen como fallback).
 */

export const DEMO_USUARIO = { id: 1, nombre: 'Sofía', apellido: 'García', fotoPerfil: null };

export const DEMO_MASCOTA_ACTIVA = {
  id: 1,
  nombre: 'Titán',
  especie: 'perro',
  raza: 'Labrador Retriever',
  fotoUrl: null,
  edadAnios: 4,
  edadMeses: 2,
};
