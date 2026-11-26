import { supabase } from '../lib/supabase';

export async function datosDeClientePorMascota(ids) {
  const lista = [...new Set((ids ?? []).filter(Boolean))];
  if (!lista.length) return {};
  try {
    const { data, error } = await supabase.from('mascota_de_cliente')
      .select('Id_Mascota, Peso, FechaNacimiento')
      .in('Id_Mascota', lista);
    if (error) return {};
    return Object.fromEntries((data ?? []).map((m) => [m.Id_Mascota, {
      peso: m.Peso != null ? Number(m.Peso) : null,
      nacimiento: m.FechaNacimiento ?? null,
    }]));
  } catch {
    return {};
  }
}
