export function aplicaParaMascota(criterios, mascota) {
  const { edadMinMeses, edadMaxMeses, pesoMinKg, pesoMaxKg, razas } = criterios;

  if (edadMinMeses != null && mascota.edadMeses != null && mascota.edadMeses < edadMinMeses) return false;
  if (edadMaxMeses != null && mascota.edadMeses != null && mascota.edadMeses > edadMaxMeses) return false;
  if (pesoMinKg != null && mascota.pesoKg != null && mascota.pesoKg < pesoMinKg) return false;
  if (pesoMaxKg != null && mascota.pesoKg != null && mascota.pesoKg > pesoMaxKg) return false;
  if (razas?.length && mascota.raza && !razas.some((r) => r.toLowerCase() === mascota.raza.toLowerCase())) return false;

  return true;
}

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
