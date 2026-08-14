/**
 * mascotaVacia.js — Placeholder neutro cuando no hay una mascota real que mostrar
 *
 * Vacunas, Tratamientos, Consultas y Ficha Médica tenían cada una su propia
 * copia de una mascota inventada ("Titán, Labrador Retriever, 20,40 kg") que se
 * aplicaba ante cualquier error de red. El usuario veía una mascota que no era
 * la suya —con vacunas y consultas que tampoco eran suyas— y no había forma de
 * distinguirlo de un dato real.
 *
 * Este objeto ocupa ese lugar: mantiene la forma que esperan las pantallas (por
 * eso no alcanza con `null`, que las rompería) pero sin afirmar nada falso. Los
 * campos vacíos hacen que la UI no muestre raza, peso ni edad.
 */

export const MASCOTA_VACIA = {
  id: null,
  nombre: 'Tu mascota',
  especie: 'perro',
  raza: null,
  peso: null,
  fecha_nacimiento: null,
  imagen_asset: null,
};
