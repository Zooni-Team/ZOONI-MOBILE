import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../config/session';
import { enRango, sanitizarDigitos, sanitizarTexto } from '../utils/sanitizar';
import { subirImagenPublica, borrarImagenPublica } from './imagenStorage';
import { edadResumida } from '../utils/calcularEdad';
import { toISODateLocal } from '../utils/fechaLocal';
import { esFuncionInexistente } from './comun';

export const LIMITE_ACTIVAS = 10;

function errorLimite() {
  const err = new Error('limite');
  err.code = 'LIMITE_ACTIVAS';
  return err;
}

const esErrorDeLimite = (error) => String(error?.message ?? '').includes('limite_mascotas_activas');

function errorNoEncontrada() {
  const err = new Error('mascota_no_encontrada');
  err.code = 'MASCOTA_NO_ENCONTRADA';
  return err;
}

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

function mapMascota(m) {
  return {
    id: m.Id_Mascota,
    nombre: m.Nombre,
    especie: m.Especie,
    raza: m.Raza,
    sexo: m.Sexo ?? null,
    fotoUrl: m.Foto ?? null,
    imagenAsset: m.ImagenAsset ?? 'perro_default',
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
  try {
    await supabase.from('mascota_estado_historial').insert({
      id_mascota: idMascota, desde, hasta, motivo: motivo ?? null,
      cambiado_por: getCurrentUserId(),
    });
  } catch {  }
}

async function promoverPrincipalSiHaceFalta(idQueSale) {
  const { data: activas, error } = await supabase
    .from('Mascota')
    .select('*')
    .eq('Id_User', getCurrentUserId())
    .eq('Estado', 'active')
    .neq('Id_Mascota', idQueSale)
    .order('Id_Mascota', { ascending: true });
  if (error || !activas?.length) return null;
  if (activas.some((m) => m.EsActiva)) return null;
  const promovida = activas[0];
  const { error: errUp } = await supabase
    .from('Mascota')
    .update({ EsActiva: true })
    .eq('Id_Mascota', promovida.Id_Mascota);
  return errUp ? null : mapMascota(promovida);
}

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

export async function archivarMascota(id, motivo = null, motivoTexto = null) {
  const esMemorial = motivo === 'deceased';
  const previa = await estadoPrevio(id);
  if (previa.Estado !== 'active') return { promovida: null };

  const { data: cambiadas, error } = await supabase
    .from('Mascota')
    .update({
      Estado: esMemorial ? 'memorial' : 'archived',
      ArchivadaEn: new Date().toISOString(),
      MotivoArchivo: motivo,
      MotivoArchivoTexto: motivoTexto,
      FechaFallecimiento: esMemorial ? toISODateLocal(new Date()) : null,
      EsActiva: false,
    })
    .eq('Id_Mascota', id)
    .eq('Id_User', getCurrentUserId())
    .eq('Estado', 'active')
    .select('Id_Mascota');
  if (error) throw error;
  if (!cambiadas?.length) return { promovida: null };

  await registrarHistorial(id, 'active', esMemorial ? 'memorial' : 'archived', motivo);
  const promovida = previa.EsActiva ? await promoverPrincipalSiHaceFalta(id) : null;
  return { promovida };
}

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
      FechaFallecimiento: null,
    })
    .eq('Id_Mascota', id)
    .eq('Id_User', getCurrentUserId())
    .select('Id_Mascota');
  if (error) throw esErrorDeLimite(error) ? errorLimite() : error;
  if (!cambiadas?.length) throw errorNoEncontrada();
  await registrarHistorial(id, 'archived', 'active', null);
  await promoverPrincipalSiHaceFalta(-1);
  return true;
}

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

export async function crearMascota(datos) {
  const userId = getCurrentUserId();
  const { activas } = await fetchMisMascotas();
  if (activas.length >= LIMITE_ACTIVAS) throw errorLimite();

  const peso = datos.peso ?? null;
  if (!enRango(peso, 0.1, 120)) {
    const err = new Error('peso');
    err.code = 'PESO_INVALIDO';
    throw err;
  }
  const microchip = datos.microchip ? sanitizarDigitos(datos.microchip, 15) : null;

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
    EsActiva: activas.length === 0,
  };

  const { data, error } = await supabase
    .from('Mascota').insert(fila).select().single();
  if (error) {
    if (fotoUrl && fotoUrl !== datos.fotoUrl) await borrarImagenPublica(fotoUrl);
    if (esErrorDeLimite(error)) throw errorLimite();
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

export async function agregarFotoMascota(idMascota, uri) {
  const url = await subirImagenPublica(uri, 'mascotas');
  const { data, error } = await supabase
    .from('mascota_fotos')
    .insert({ id_mascota: idMascota, url, orden: Date.now() % 1000000 })
    .select().single();
  if (error) throw error;
  return { id: data.id, url: data.url, esPortada: false };
}

export async function eliminarFotoMascota(fotoId) {
  const { data: fila } = await supabase.from('mascota_fotos').select('url').eq('id', fotoId).maybeSingle();

  const { error } = await supabase.from('mascota_fotos').delete().eq('id', fotoId);
  if (error) throw error;

  if (fila?.url) borrarImagenPublica(fila.url);
  return true;
}

export async function setFotoPrincipalMascota(id, uri) {
  const url = await subirImagenPublica(uri, 'mascotas');
  const { error } = await supabase
    .from('Mascota').update({ Foto: url })
    .eq('Id_Mascota', id).eq('Id_User', getCurrentUserId());
  if (error) throw error;
  return url;
}

export async function actualizarMascota(id, patch) {
  const permitidos = {
    nombre: 'Nombre', especie: 'Especie', raza: 'Raza', sexo: 'Sexo',
    fechaNacimiento: 'FechaNacimiento', peso: 'Peso', tamano: 'Tamano',
    castrado: 'Castrado', microchip: 'Microchip', descripcion: 'Descripcion',
    senas: 'SenasParticulares', visibleEnMatch: 'VisibleEnMatch',
    imagenAsset: 'ImagenAsset', fotoUrl: 'Foto', mostrarFoto: 'MostrarFoto',
  };
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
