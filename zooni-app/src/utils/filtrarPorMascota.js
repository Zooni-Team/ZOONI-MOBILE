/**
 * filtrarPorMascota.js — Filtro compartido para los catálogos de Vacunas,
 * Tratamientos y Consejos (Ficha Médica).
 *
 * Cada fila del catálogo puede traer criterios opcionales de edad/peso/raza.
 * Si un criterio es null, no restringe nada (aplica a cualquier mascota de
 * esa especie). Si el dato de LA MASCOTA es desconocido (peso/raza sin
 * cargar), tampoco se descarta la sugerencia — mejor mostrar de más que
 * ocultar una sugerencia válida solo porque el perfil está incompleto.
 */

export function aplicaParaMascota(criterios, mascota) {
  const { edadMinMeses, edadMaxMeses, pesoMinKg, pesoMaxKg, razas } = criterios;

  if (edadMinMeses != null && mascota.edadMeses != null && mascota.edadMeses < edadMinMeses) return false;
  if (edadMaxMeses != null && mascota.edadMeses != null && mascota.edadMeses > edadMaxMeses) return false;
  if (pesoMinKg != null && mascota.pesoKg != null && mascota.pesoKg < pesoMinKg) return false;
  if (pesoMaxKg != null && mascota.pesoKg != null && mascota.pesoKg > pesoMaxKg) return false;
  if (razas?.length && mascota.raza && !razas.some((r) => r.toLowerCase() === mascota.raza.toLowerCase())) return false;

  return true;
}
