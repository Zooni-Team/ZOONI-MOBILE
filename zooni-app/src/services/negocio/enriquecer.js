import { supabase } from '../../lib/supabase';
import { resolveMascotaVisual } from '../../constants/petImages';
import { perfilesPorId } from '../perfilesPublicos';
import { mapNegocio } from './perfil';
import { datosDeClientePorMascota } from '../mascotasDeClientes';

export async function mascotasPorId(ids) {
  const lista = [...new Set(ids.filter(Boolean))];
  if (!lista.length) return {};
  const [{ data }, clientes] = await Promise.all([
    supabase.from('mascota_publica')
      .select('Id_Mascota, Id_User, Nombre, Especie, Raza, Tamano, Foto, ImagenAsset, MostrarFoto, EdadAnios')
      .in('Id_Mascota', lista),
    datosDeClientePorMascota(lista),
  ]);
  return Object.fromEntries((data ?? []).map((m) => [m.Id_Mascota, {
    id: m.Id_Mascota,
    nombre: m.Nombre ?? 'Mascota',
    especie: m.Especie,
    raza: m.Raza,
    tamano: m.Tamano ?? null,
    peso: clientes[m.Id_Mascota]?.peso ?? null,
    edadAnios: m.EdadAnios ?? null,
    nacimiento: clientes[m.Id_Mascota]?.nacimiento ?? null,
    visual: resolveMascotaVisual({
      fotoUrl: m.Foto, imagenAsset: m.ImagenAsset, especie: m.Especie, raza: m.Raza, mostrarFoto: m.MostrarFoto,
    }),
  }]));
}

export async function usuariosPorId(ids) {
  const lista = [...new Set(ids.filter(Boolean))];
  if (!lista.length) return {};
  const data = await perfilesPorId(lista, 'Id_User, Nombre, Apellido, FotoPerfil, Telefono');
  return Object.fromEntries(data.map((u) => [u.Id_User, {
    id: u.Id_User,
    nombre: `${u.Nombre ?? ''} ${u.Apellido ?? ''}`.trim() || 'Cliente',
    foto: u.FotoPerfil ?? null,
    telefono: u.Telefono ?? null,
  }]));
}

export async function negociosPorId(ids) {
  const lista = [...new Set(ids.filter(Boolean))];
  if (!lista.length) return {};
  const [{ data }, { data: pines }] = await Promise.all([
    supabase.from('negocio_perfil').select('*').in('id', lista),
    supabase.from('servicios').select('id, id_negocio').in('id_negocio', lista),
  ]);
  const pinDe = Object.fromEntries((pines ?? []).map((p) => [p.id_negocio, p.id]));
  return Object.fromEntries((data ?? []).map((n) => [n.id, mapNegocio(n, pinDe[n.id] ?? null)]));
}
