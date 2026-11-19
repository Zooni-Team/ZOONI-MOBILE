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

/*
  ¿Un evento le sirve a esta mascota? Los eventos no tienen columnas de
  especie/raza: lo dice su etiqueta (categoria_tag), ej. "PERROS Y GATOS",
  "TODAS LAS MASCOTAS" o "GOLDEN RETRIEVER". Antes se le ofrecía un encuentro
  de Golden Retrievers a un mestizo.
    · sin etiqueta o "todas…"           → sí
    · etiqueta de especie ("perros…")   → si la especie está nombrada
    · cualquier otra etiqueta = una raza → sólo si es la raza de la mascota
  Mascota sin datos (o sin mascota elegida): no se descarta nada.
*/
const ESPECIES_TAG = { perro: /perr/, gato: /gat/, conejo: /conej/, ave: /\bave|pajar/ };
const sinTildes = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function eventoAplicaAMascota(evento, mascota) {
  const tag = sinTildes(evento?.categoria_tag);
  if (!tag || /todas|todos|general/.test(tag) || !mascota) return true;
  const nombraEspecie = Object.values(ESPECIES_TAG).some((re) => re.test(tag));
  if (nombraEspecie) {
    const re = ESPECIES_TAG[sinTildes(mascota.especie)];
    return !re || re.test(tag);
  }
  const raza = sinTildes(mascota.raza);
  if (!raza) return true;
  return raza.includes(tag) || tag.includes(raza);
}
