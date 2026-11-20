/**
 * petsApi.js — Ciclo de vida de mascotas contra Supabase (Instruction-MisMascotas)
 *
 * Todas las funciones operan SOLO sobre las mascotas del usuario logueado
 * (getCurrentUserId()), nunca datos al azar. Requiere la migración
 * sección 020 de SUPABASE_PEGAR_TODO.sql (columnas Estado / ArchivadaEn / etc.).
 *
 * Estados: active → archived → active · → memorial (falleció) · → deleted
 * (borrado lógico con 30 días de gracia; el cliente nunca ve las deleted).
 *
 * "EsActiva" = mascota PRINCIPAL (la de Home). No confundir con Estado.
 */

import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { enRango, sanitizarDigitos, sanitizarTexto } from '../utils/sanitizar';
import { subirImagenPublica, borrarImagenPublica } from './imagenStorage';
import { edadResumida } from '../utils/calcularEdad';
import { toISODateLocal } from '../utils/fechaLocal';
import { esFuncionInexistente } from './comun';

// El mismo número lo controla la base (trigger de MIGRACION_071): acá es sólo
// para avisar antes de subir la foto.
export const LIMITE_ACTIVAS = 10;

function errorLimite() {
  const err = new Error('limite');
  err.code = 'LIMITE_ACTIVAS';
  return err;
}

/** El trigger de la 071 rechazó el alta/recuperación por el límite. */
const esErrorDeLimite = (error) => String(error?.message ?? '').includes('limite_mascotas_activas');

function errorNoEncontrada() {
  const err = new Error('mascota_no_encontrada');
  err.code = 'MASCOTA_NO_ENCONTRADA';
  return err;
}

/** Estado actual de una mascota propia. Tira si la base falla o si no es mía. */
async function estadoPrevio(id) {
  const { data, error } = await supabase
    .from('Mascota').select('"Estado","EsActiva"')
    .eq('Id_Mascota', id).eq('Id_User', getCurrentUserId()).maybeSingle();
  if (error) throw error;
  if (!data) throw errorNoEncontrada();
  return data;
}

export const MOTIVOS_ARCHIVO = [
  { value: 'foster_ended',      label: 'Terminó el tránsito' },
  { value: 'adopted',           label: 'Fue adoptada' },
  { value: 'in_care',           label: 'Está al cuidado de otra persona' },
  { value: 'at_vet',            label: 'Quedó en la veterinaria' },
  { value: 'no_longer_with_me', label: 'Ya no vive conmigo' },
  { value: 'deceased',          label: 'Falleció' },
  { value: 'other',             label: 'Otro' },
];

export function labelMotivo(value) {
  return MOTIVOS_ARCHIVO.find((m) => m.value === value)?.label ?? null;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function mapMascota(m) {
  return {
    id: m.Id_Mascota,
    nombre: m.Nombre,
    especie: m.Especie,
    raza: m.Raza,
    sexo: m.Sexo ?? null,
    fotoUrl: m.Foto ?? null,
    imagenAsset: m.ImagenAsset ?? 'perro_default',
    // Si la columna todavía no existe (migración 032 sin correr), se asume
    // true: mismo comportamiento que antes, la foto manda.
    mostrarFoto: m.MostrarFoto ?? true,
    peso: m.Peso != null ? Number(m.Peso) : null,
    fechaNacimiento: m.FechaNacimiento ?? null,
    edadTexto: edadResumida(m.FechaNacimiento),
    tamano: m.Tamano ?? null,
    castrado: m.Castrado ?? null,
    microchip: m.Microchip ?? null,
    descripcion: m.Descripcion ?? null,
    senas: m.SenasParticulares ?? null,
    visibleEnMatch: m.VisibleEnMatch ?? true,
    esPrincipal: !!m.EsActiva,
    estado: m.Estado ?? 'active',
    archivadaEn: m.ArchivadaEn ?? null,
    motivoArchivo: m.MotivoArchivo ?? null,
    motivoArchivoTexto: m.MotivoArchivoTexto ?? null,
    fechaFallecimiento: m.FechaFallecimiento ?? null,
  };
}

async function registrarHistorial(idMascota, desde, hasta, motivo) {
  // Auditoría best-effort: si la tabla no existe todavía, no rompe el flujo
  try {
    await supabase.from('mascota_estado_historial').insert({
      id_mascota: idMascota, desde, hasta, motivo: motivo ?? null,
      cambiado_por: getCurrentUserId(),
    });
  } catch { /* auditoría opcional */ }
}

/**
 * Si la principal sale de las activas, promueve a la activa más antigua.
 * Devuelve la mascota promovida (para el toast) o null.
 */
async function promoverPrincipalSiHaceFalta(idQueSale) {
  const { data: activas, error } = await supabase
    .from('Mascota')
    .select('*')
    .eq('Id_User', getCurrentUserId())
    .eq('Estado', 'active')
    .neq('Id_Mascota', idQueSale)
    .order('Id_Mascota', { ascending: true });
  if (error || !activas?.length) return null;
  if (activas.some((m) => m.EsActiva)) return null; // ya hay principal
  const promovida = activas[0];
  const { error: errUp } = await supabase
    .from('Mascota')
    .update({ EsActiva: true })
    .eq('Id_Mascota', promovida.Id_Mascota);
  return errUp ? null : mapMascota(promovida);
}

// ─── LECTURA ─────────────────────────────────────────────────────────────────

/**
 * Todas las mascotas del usuario logueado, agrupadas por estado.
 * Las 'deleted' en período de gracia no se devuelven nunca.
 */
export async function fetchMisMascotas() {
  const { data, error } = await supabase
    .from('Mascota')
    .select('*')
    .eq('Id_User', getCurrentUserId())
    .neq('Estado', 'deleted')
    .order('Id_Mascota', { ascending: true });
  if (error) throw error;

  const todas = (data ?? []).map(mapMascota);
  return {
    activas: todas.filter((m) => m.estado === 'active'),
    archivadas: todas
      .filter((m) => m.estado === 'archived')
      .sort((a, b) => (b.archivadaEn ?? '').localeCompare(a.archivadaEn ?? '')),
    enMemoria: todas.filter((m) => m.estado === 'memorial'),
  };
}

// ─── CICLO DE VIDA ───────────────────────────────────────────────────────────

/**
 * active → archived (o memorial si motivo = 'deceased').
 * Idempotente: si ya está archivada devuelve OK sin fallar.
 * Devuelve { promovida } con la nueva principal si la archivada lo era.
 */
export async function archivarMascota(id, motivo = null, motivoTexto = null) {
  const esMemorial = motivo === 'deceased';
  // Antes el error de esta lectura se ignoraba y se seguía "a ciegas".
  const previa = await estadoPrevio(id);
  if (previa.Estado !== 'active') return { promovida: null }; // idempotente

  const { data: cambiadas, error } = await supabase
    .from('Mascota')
    .update({
      Estado: esMemorial ? 'memorial' : 'archived',
      ArchivadaEn: new Date().toISOString(),
      MotivoArchivo: motivo,
      MotivoArchivoTexto: motivoTexto,
      // Fecha LOCAL: toISOString() es UTC y de noche (UTC-3) guardaba el día siguiente.
      FechaFallecimiento: esMemorial ? toISODateLocal(new Date()) : null,
      EsActiva: false,
    })
    .eq('Id_Mascota', id)
    .eq('Id_User', getCurrentUserId())
    .eq('Estado', 'active')
    .select('Id_Mascota');
  if (error) throw error;
  // 0 filas: otro dispositivo la cambió mientras tanto. Nada que hacer.
  if (!cambiadas?.length) return { promovida: null };

  await registrarHistorial(id, 'active', esMemorial ? 'memorial' : 'archived', motivo);
  const promovida = previa.EsActiva ? await promoverPrincipalSiHaceFalta(id) : null;
  return { promovida };
}

/**
 * archived → active. Valida el límite de activas. No vuelve principal.
 */
export async function recuperarMascota(id) {
  const { activas } = await fetchMisMascotas();
  if (activas.length >= LIMITE_ACTIVAS) throw errorLimite();
  const { data: cambiadas, error } = await supabase
    .from('Mascota')
    .update({
      Estado: 'active',
      ArchivadaEn: null,
      MotivoArchivo: null,
      MotivoArchivoTexto: null,
      // Si estaba "En memoria" por un toque sin querer, se limpia también
      FechaFallecimiento: null,
    })
    .eq('Id_Mascota', id)
    .eq('Id_User', getCurrentUserId())
    .select('Id_Mascota');
  if (error) throw esErrorDeLimite(error) ? errorLimite() : error;
  if (!cambiadas?.length) throw errorNoEncontrada();
  await registrarHistorial(id, 'archived', 'active', null);
  // Si no quedaba ninguna principal, la recuperada asume
  await promoverPrincipalSiHaceFalta(-1);
  return true;
}

/**
 * Borrado lógico con 30 días de gracia. La recuperación es por soporte.
 */
export async function eliminarMascota(id) {
  const ahora = new Date();
  const purga = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
  const previa = await estadoPrevio(id);

  const { data: cambiadas, error } = await supabase
    .from('Mascota')
    .update({
      Estado: 'deleted',
      EliminadaEn: ahora.toISOString(),
      PurgarDespues: purga.toISOString(),
      EsActiva: false,
    })
    .eq('Id_Mascota', id)
    .eq('Id_User', getCurrentUserId())
    .select('Id_Mascota');
  if (error) throw error;
  if (!cambiadas?.length) throw errorNoEncontrada();

  await registrarHistorial(id, previa.Estado, 'deleted', null);
  if (previa.EsActiva) await promoverPrincipalSiHaceFalta(id);
  return true;
}

/**
 * Baja la principal anterior y sube la nueva en UNA transacción (RPC de la
 * 071). Antes eran dos UPDATE sueltos: si el segundo fallaba, la cuenta
 * quedaba sin principal. Sin la 071 todavía pegada, cae al camino viejo.
 */
export async function marcarPrincipal(id) {
  const { error: errRpc } = await supabase.rpc('marcar_mascota_principal', { p_id_mascota: id });
  if (!errRpc) return true;
  if (!esFuncionInexistente(errRpc)) throw errRpc;

  const userId = getCurrentUserId();
  const { error: errBaja } = await supabase
    .from('Mascota').update({ EsActiva: false })
    .eq('Id_User', userId).eq('EsActiva', true);
  if (errBaja) throw errBaja;
  const { error: errSube } = await supabase
    .from('Mascota').update({ EsActiva: true })
    .eq('Id_Mascota', id).eq('Id_User', userId).eq('Estado', 'active');
  if (errSube) throw errSube;
  return true;
}

// ─── ALTA Y EDICIÓN ──────────────────────────────────────────────────────────

/**
 * Crea una mascota del usuario logueado. Solo nombre y especie obligatorios.
 * Si es la primera activa, queda como principal.
 */
export async function crearMascota(datos) {
  const userId = getCurrentUserId();
  const { activas } = await fetchMisMascotas();
  if (activas.length >= LIMITE_ACTIVAS) throw errorLimite();

  // Sanitización + validación de rangos antes de tocar la base
  const peso = datos.peso ?? null;
  if (!enRango(peso, 0.1, 120)) {
    const err = new Error('peso');
    err.code = 'PESO_INVALIDO';
    throw err;
  }
  const microchip = datos.microchip ? sanitizarDigitos(datos.microchip, 15) : null;

  // Foto real: se sube a Supabase Storage y se guarda su URL en Mascota.Foto
  // (es la que muestra Match). Si viene una URL ya subida, se usa tal cual.
  let fotoUrl = datos.fotoUrl ?? null;
  if (!fotoUrl && datos.fotoUri) {
    fotoUrl = await subirImagenPublica(datos.fotoUri, 'mascotas');
  }

  const fila = {
    Id_User: userId,
    Foto: fotoUrl,
    Nombre: sanitizarTexto(datos.nombre, 30),
    Especie: sanitizarTexto(datos.especie, 50),
    Raza: sanitizarTexto(datos.raza, 100),
    Sexo: sanitizarTexto(datos.sexo, 10),
    FechaNacimiento: datos.fechaNacimiento ?? null,
    Peso: peso,
    Tamano: sanitizarTexto(datos.tamano, 10),
    Castrado: datos.castrado ?? null,
    Microchip: microchip,
    Descripcion: sanitizarTexto(datos.descripcion, 150),
    SenasParticulares: sanitizarTexto(datos.senas, 200),
    VisibleEnMatch: datos.visibleEnMatch ?? true,
    ImagenAsset: datos.imagenAsset ?? `${(datos.especie ?? 'perro').toLowerCase()}_default`,
    Estado: 'active',
    EsActiva: activas.length === 0, // primera mascota → principal
  };

  const { data, error } = await supabase
    .from('Mascota').insert(fila).select().single();
  if (error) {
    // La foto ya se subió: si la mascota no se crea, no tiene que quedar huérfana.
    if (fotoUrl && fotoUrl !== datos.fotoUrl) await borrarImagenPublica(fotoUrl);
    if (esErrorDeLimite(error)) throw errorLimite();
    // Microchip duplicado: nunca se revela de quién es
    if (String(error.message ?? '').includes('idx_mascota_microchip')) {
      const err = new Error('microchip');
      err.code = 'MICROCHIP_DUPLICADO';
      throw err;
    }
    throw error;
  }
  await registrarHistorial(data.Id_Mascota, null, 'active', 'alta');
  return mapMascota(data);
}

// ─── GALERÍA DE FOTOS (varias fotos por mascota — migración 028) ─────────────

/**
 * Todas las fotos de una mascota para el carrusel: la portada (Mascota.Foto)
 * primero, después las de la galería por orden. Devuelve array de
 * { id, url, esPortada }. `id` null para la portada (no está en mascota_fotos).
 */
export async function fetchFotosMascota(idMascota, fotoPortada) {
  const { data } = await supabase
    .from('mascota_fotos').select('*')
    .eq('id_mascota', idMascota)
    .order('orden', { ascending: true });
  const galeria = (data ?? []).map((f) => ({ id: f.id, url: f.url, esPortada: false }));
  return fotoPortada
    ? [{ id: null, url: fotoPortada, esPortada: true }, ...galeria]
    : galeria;
}

/** Sube una foto nueva a la galería de la mascota. */
export async function agregarFotoMascota(idMascota, uri) {
  const url = await subirImagenPublica(uri, 'mascotas');
  const { data, error } = await supabase
    .from('mascota_fotos')
    .insert({ id_mascota: idMascota, url, orden: Date.now() % 1000000 })
    .select().single();
  if (error) throw error;
  return { id: data.id, url: data.url, esPortada: false };
}

/** Elimina una foto de la galería (no la portada). */
export async function eliminarFotoMascota(fotoId) {
  // La URL se lee ANTES de borrar la fila. El trigger de la 068 también la
  // anota en archivos_por_borrar; esto la saca de Storage en el momento y
  // nunca tira (la fila ya se borró) — informe #70.
  const { data: fila } = await supabase.from('mascota_fotos').select('url').eq('id', fotoId).maybeSingle();

  const { error } = await supabase.from('mascota_fotos').delete().eq('id', fotoId);
  if (error) throw error;

  if (fila?.url) borrarImagenPublica(fila.url);
  return true;
}

/** Sube y setea la foto principal (portada) de una mascota. Devuelve la URL. */
export async function setFotoPrincipalMascota(id, uri) {
  const url = await subirImagenPublica(uri, 'mascotas');
  const { error } = await supabase
    .from('Mascota').update({ Foto: url })
    .eq('Id_Mascota', id).eq('Id_User', getCurrentUserId());
  if (error) throw error;
  return url;
}

/**
 * Merge parcial de campos editables. Los cambios de Estado van por las
 * funciones de ciclo de vida, nunca por acá.
 */
export async function actualizarMascota(id, patch) {
  const permitidos = {
    nombre: 'Nombre', especie: 'Especie', raza: 'Raza', sexo: 'Sexo',
    fechaNacimiento: 'FechaNacimiento', peso: 'Peso', tamano: 'Tamano',
    castrado: 'Castrado', microchip: 'Microchip', descripcion: 'Descripcion',
    senas: 'SenasParticulares', visibleEnMatch: 'VisibleEnMatch',
    imagenAsset: 'ImagenAsset', fotoUrl: 'Foto', mostrarFoto: 'MostrarFoto',
  };
  // Longitudes máximas por campo de texto (mismas que los CHECK del 021)
  const maxLen = {
    Nombre: 30, Especie: 50, Raza: 100, Sexo: 10, Tamano: 10,
    Descripcion: 150, SenasParticulares: 200,
  };
  if (patch.peso !== undefined && !enRango(patch.peso, 0.1, 120)) {
    const err = new Error('peso');
    err.code = 'PESO_INVALIDO';
    throw err;
  }
  const fila = {};
  for (const [k, col] of Object.entries(permitidos)) {
    if (patch[k] === undefined) continue;
    if (col === 'Microchip') {
      fila[col] = patch[k] ? sanitizarDigitos(patch[k], 15) : null;
    } else if (maxLen[col] && typeof patch[k] === 'string') {
      fila[col] = sanitizarTexto(patch[k], maxLen[col]);
    } else {
      fila[col] = patch[k];
    }
  }
  if (!Object.keys(fila).length) return true;

  const { error } = await supabase
    .from('Mascota').update(fila)
    .eq('Id_Mascota', id).eq('Id_User', getCurrentUserId());
  if (error) throw error;
  return true;
}
