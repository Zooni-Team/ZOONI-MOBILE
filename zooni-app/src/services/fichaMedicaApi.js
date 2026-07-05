/**
 * fichaMedicaApi.js — Mascota, Vacunas y Tratamientos sobre Supabase
 *
 * Usado por FichaMedicaScreen, VacunasScreen y TratamientosScreen.
 */

import { supabase } from '../lib/supabase';
import { calcularEdadMeses } from '../utils/calcularEdad';
import { aplicaParaMascota } from '../utils/filtrarPorMascota';

function mapMascota(m) {
  if (!m) return null;
  return {
    id: m.Id_Mascota,
    nombre: m.Nombre,
    especie: m.Especie,
    raza: m.Raza,
    peso: m.Peso != null ? Number(m.Peso) : null,
    fecha_nacimiento: m.FechaNacimiento,
    imagen_asset: m.ImagenAsset ?? 'perro_default',
  };
}

/** Trae una mascota por id. */
export async function fetchMascota(petId) {
  if (!petId) return null;
  const { data, error } = await supabase.from('Mascota').select('*').eq('Id_Mascota', petId).single();
  if (error) throw error;
  return mapMascota(data);
}

export async function actualizarPeso(petId, peso) {
  const { data, error } = await supabase.from('Mascota').update({ Peso: peso }).eq('Id_Mascota', petId).select().single();
  if (error) throw error;
  return mapMascota(data);
}

export async function actualizarRaza(petId, raza) {
  const { data, error } = await supabase.from('Mascota').update({ Raza: raza }).eq('Id_Mascota', petId).select().single();
  if (error) throw error;
  return mapMascota(data);
}

export async function actualizarFechaNacimiento(petId, fechaNacimiento) {
  const { data, error } = await supabase
    .from('Mascota')
    .update({ FechaNacimiento: fechaNacimiento })
    .eq('Id_Mascota', petId)
    .select()
    .single();
  if (error) throw error;
  return mapMascota(data);
}

// ─────────────────────────────────────────────
// VACUNAS
// ─────────────────────────────────────────────

function mapAplicada(row) {
  return {
    id: row.Id,
    nombre: row.NombreLibre ?? row.Vacuna?.Nombre ?? 'Sin nombre',
    descripcion: row.Descripcion,
    fecha_aplicacion: row.FechaAplicacion,
    proximo_refuerzo: row.ProximaDosis,
    tipo: row.Tipo ?? 'Vacuna',
    veterinaria: row.AplicadaPor,
    vacuna_sugerida_id: row.Id_Vacuna,
  };
}

/** Trae mascota + vacunas aplicadas + calendario sugerido según su especie. */
export async function fetchVacunas(petId) {
  const [mascota, { data: aplicadas, error: errAplicadas }, { data: catalogo, error: errCatalogo }] = await Promise.all([
    fetchMascota(petId),
    supabase.from('MascotaVacuna').select('*, Vacuna(*)').eq('Id_Mascota', petId).order('FechaAplicacion', { ascending: false }),
    supabase.from('Vacuna').select('*'),
  ]);
  if (errAplicadas) throw errAplicadas;
  if (errCatalogo) throw errCatalogo;

  const especie = mascota?.especie ?? 'perro';
  const aplicadasMapeadas = (aplicadas ?? []).map(mapAplicada);
  const perfil = {
    edadMeses: calcularEdadMeses(mascota?.fecha_nacimiento),
    pesoKg: mascota?.peso ?? null,
    raza: mascota?.raza ?? null,
  };

  const sugeridas = (catalogo ?? [])
    .filter((v) => v.Especie === especie)
    .filter((v) => aplicaParaMascota({
      edadMinMeses: v.EdadMinMeses, edadMaxMeses: v.EdadMaxMeses,
      pesoMinKg: v.PesoMinKg, pesoMaxKg: v.PesoMaxKg, razas: v.Razas,
    }, perfil))
    .map((v) => {
      const aplicacion = (aplicadas ?? []).find((a) => a.Id_Vacuna === v.Id_Vacuna);
      return {
        id: v.Id_Vacuna,
        nombre: v.Nombre,
        frecuencia_descripcion: v.FrecuenciaDescripcion ?? 'Sin frecuencia definida',
        applied: !!aplicacion,
        proximo_refuerzo: aplicacion?.ProximaDosis ?? null,
      };
    });

  return { mascota, aplicadas: aplicadasMapeadas, sugeridas };
}

/** Registra una vacuna/tratamiento aplicado con nombre libre (botón "Añadir"). */
export async function crearVacunaAplicada(petId, datos) {
  const { data, error } = await supabase
    .from('MascotaVacuna')
    .insert({
      Id_Mascota: petId,
      NombreLibre: datos.nombre,
      Descripcion: datos.descripcion ?? null,
      FechaAplicacion: datos.fecha_aplicacion,
      ProximaDosis: datos.proximo_refuerzo ?? null,
      Tipo: datos.tipo ?? 'Vacuna',
      AplicadaPor: datos.veterinaria ?? null,
    })
    .select('*, Vacuna(*)')
    .single();
  if (error) throw error;
  return mapAplicada(data);
}

/** Marca una vacuna del catálogo como aplicada ("Marcar" en el calendario sugerido). */
export async function marcarVacunaSugerida(petId, vacunaCatalogoId, datos) {
  const { data, error } = await supabase
    .from('MascotaVacuna')
    .insert({
      Id_Mascota: petId,
      Id_Vacuna: vacunaCatalogoId,
      Descripcion: datos.descripcion ?? null,
      FechaAplicacion: datos.fecha_aplicacion,
      ProximaDosis: datos.proximo_refuerzo ?? null,
      Tipo: datos.tipo ?? 'Vacuna',
      AplicadaPor: datos.veterinaria ?? null,
    })
    .select('*, Vacuna(*)')
    .single();
  if (error) throw error;
  return mapAplicada(data);
}

export async function editarVacunaAplicada(id, datos) {
  const { data, error } = await supabase
    .from('MascotaVacuna')
    .update({
      NombreLibre: datos.nombre,
      Descripcion: datos.descripcion ?? null,
      FechaAplicacion: datos.fecha_aplicacion,
      Tipo: datos.tipo ?? 'Vacuna',
      AplicadaPor: datos.veterinaria ?? null,
    })
    .eq('Id', id)
    .select('*, Vacuna(*)')
    .single();
  if (error) throw error;
  return mapAplicada(data);
}

export async function eliminarVacunaAplicada(id) {
  const { error } = await supabase.from('MascotaVacuna').delete().eq('Id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// TRATAMIENTOS
// ─────────────────────────────────────────────

function mapTratamiento(row) {
  return {
    id: row.Id_Tratamiento,
    nombre: row.Nombre,
    descripcion: row.Observaciones,
    fecha_inicio: row.FechaInicio,
    proximo_control: row.FechaFin,
    veterinaria: row.Veterinario,
  };
}

/** Trae mascota + tratamientos aplicados + catálogo de sugeridos según su especie. */
export async function fetchTratamientos(petId) {
  const [mascota, { data: aplicados, error: errAplicados }, { data: catalogo, error: errCatalogo }] = await Promise.all([
    fetchMascota(petId),
    supabase.from('Tratamiento').select('*').eq('Id_Mascota', petId).order('FechaInicio', { ascending: false }),
    supabase.from('tratamientos_catalogo').select('*').eq('activo', true),
  ]);
  if (errAplicados) throw errAplicados;
  if (errCatalogo) throw errCatalogo;

  const especie = mascota?.especie ?? 'perro';
  const perfil = {
    edadMeses: calcularEdadMeses(mascota?.fecha_nacimiento),
    pesoKg: mascota?.peso ?? null,
    raza: mascota?.raza ?? null,
  };

  // "Tratamiento" no tiene una columna que lo vincule al catálogo (a diferencia
  // de MascotaVacuna.Id_Vacuna) — se matchea por nombre para saber si ya está
  // aplicado, igual que hace Vacunas pero sin el id de por medio.
  const sugeridos = (catalogo ?? [])
    .filter((t) => t.especie === especie)
    .filter((t) => aplicaParaMascota({
      edadMinMeses: t.edad_min_meses, edadMaxMeses: t.edad_max_meses,
      pesoMinKg: t.peso_min_kg, pesoMaxKg: t.peso_max_kg, razas: t.razas,
    }, perfil))
    .map((t) => {
      const aplicacion = (aplicados ?? []).find(
        (a) => a.Nombre?.trim().toLowerCase() === t.nombre.trim().toLowerCase()
      );
      return {
        id: t.id,
        nombre: t.nombre,
        frecuencia_descripcion: t.frecuencia_descripcion,
        applied: !!aplicacion,
        tratamiento_aplicado_id: aplicacion?.Id_Tratamiento ?? null,
      };
    });

  return { mascota, aplicados: (aplicados ?? []).map(mapTratamiento), sugeridos };
}

export async function crearTratamiento(petId, datos) {
  const { data, error } = await supabase
    .from('Tratamiento')
    .insert({
      Id_Mascota: petId,
      Nombre: datos.nombre,
      Veterinario: datos.veterinaria ?? null,
      FechaInicio: datos.fecha_inicio,
      FechaFin: datos.proximo_control ?? null,
      Observaciones: datos.descripcion ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapTratamiento(data);
}

export async function eliminarTratamiento(id) {
  const { error } = await supabase.from('Tratamiento').delete().eq('Id_Tratamiento', id);
  if (error) throw error;
}
