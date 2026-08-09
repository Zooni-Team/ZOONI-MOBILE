-- migracion_22.sql — Contexto de la mascota para ZooniVet, calculado en el servidor.
--
-- Parte del refactor de seguridad de ZooniVet: la GROQ_API_KEY deja de vivir en
-- el cliente y pasa a una Edge Function (supabase/functions/zoonivet-chat). Esta
-- función SQL es la ÚNICA fuente del contexto de la mascota: la usa la Edge
-- Function para armar el prompt y la app para los chips de sugerencia y para
-- habilitar el input. Todo lo calculable (edad, días de vacunas vencidas,
-- tendencia de peso) se resuelve acá, en SQL, para que el modelo solo redacte.
--
-- Devuelve un jsonb con la misma forma que consumía construirContextoMascota:
--   { id, nombre, especie, raza, edadTexto, edadMeses, etapa, pesoKg,
--     pesoTendencia, vacunasAplicadas[], vacunasPendientes[], consultas[], fechaHoy }
-- Devuelve NULL si la mascota no existe.
--
-- EJECUTAR EN SUPABASE: pegá este archivo en el SQL Editor y corré. No pisa datos.

create or replace function public.get_pet_chat_context(p_pet_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m               record;
  v_hoy             date := current_date;
  v_edad_meses      int;
  v_anios           int;
  v_meses           int;
  v_edad_texto      text;
  v_etapa           text;
  v_es_gato         boolean;
  v_vac_aplicadas   jsonb;
  v_vac_pendientes  jsonb;
  v_consultas       jsonb;
  v_tendencia       text;
  v_peso_reciente   numeric;
  v_peso_previo     numeric;
  v_fecha_reciente  date;
  v_fecha_previo    date;
  v_delta           numeric;
  v_dias            int;
  v_periodo         text;
  v_n_pesos         int;
begin
  select "Id_Mascota"     as id,
         "Nombre"         as nombre,
         "Especie"        as especie,
         "Raza"           as raza,
         "Peso"           as peso,
         "FechaNacimiento" as fnac
    into v_m
  from "Mascota"
  where "Id_Mascota" = p_pet_id;

  if not found then
    return null;
  end if;

  v_es_gato := lower(coalesce(v_m.especie, '')) like '%gato%';

  -- ── Edad (misma cuenta que calcularEdad/calcularEdadMeses en JS) ──────────
  if v_m.fnac is not null then
    v_edad_meses := greatest(
      0,
      (extract(year  from age(v_hoy, v_m.fnac)) * 12
     + extract(month from age(v_hoy, v_m.fnac)))::int
    );
    v_anios := v_edad_meses / 12;
    v_meses := v_edad_meses % 12;

    if v_anios = 0 then
      v_edad_texto := v_meses || case when v_meses = 1 then ' mes' else ' meses' end;
    else
      v_edad_texto :=
        v_anios || case when v_anios = 1 then ' año'  else ' años'  end || ' y ' ||
        v_meses || case when v_meses = 1 then ' mes'  else ' meses' end;
    end if;
  end if;

  -- ── Etapa de vida (flag resuelto para el modelo) ──────────────────────────
  if v_edad_meses is null then
    v_etapa := 'adulto';
  elsif v_edad_meses < 12 then
    v_etapa := 'cachorro';
  elsif (v_es_gato and v_edad_meses >= 132) or (not v_es_gato and v_edad_meses >= 96) then
    v_etapa := 'senior';
  else
    v_etapa := 'adulto';
  end if;

  -- ── Vacunas aplicadas: "Nombre (YYYY-MM-DD)", más recientes primero ───────
  select coalesce(
    jsonb_agg(txt order by fapp desc),
    '[]'::jsonb
  )
    into v_vac_aplicadas
  from (
    select coalesce(mv."NombreLibre", vc."Nombre", 'Vacuna')
             || ' (' || to_char(mv."FechaAplicacion", 'YYYY-MM-DD') || ')' as txt,
           mv."FechaAplicacion" as fapp
    from "MascotaVacuna" mv
    left join "Vacuna" vc on vc."Id_Vacuna" = mv."Id_Vacuna"
    where mv."Id_Mascota" = p_pet_id
      and mv."FechaAplicacion" is not null
  ) s;

  -- ── Vacunas pendientes/vencidas con días exactos (solo <= 30 días o vencidas) ─
  select coalesce(
    jsonb_agg(txt order by prox asc),
    '[]'::jsonb
  )
    into v_vac_pendientes
  from (
    select
      case
        when (mv."ProximaDosis" - v_hoy) < 0 then
          coalesce(mv."NombreLibre", vc."Nombre", 'Vacuna')
            || ': vencida hace ' || (v_hoy - mv."ProximaDosis") || ' días'
        else
          coalesce(mv."NombreLibre", vc."Nombre", 'Vacuna')
            || ': vence en ' || (mv."ProximaDosis" - v_hoy) || ' días'
      end as txt,
      mv."ProximaDosis" as prox
    from "MascotaVacuna" mv
    left join "Vacuna" vc on vc."Id_Vacuna" = mv."Id_Vacuna"
    where mv."Id_Mascota" = p_pet_id
      and mv."ProximaDosis" is not null
      and (mv."ProximaDosis" - v_hoy) <= 30
  ) s;

  -- ── Consultas recientes (hasta 3), motivo recortado a 120 ─────────────────
  select coalesce(
    jsonb_agg(
      jsonb_build_object('fecha', to_char(fecha, 'YYYY-MM-DD'), 'motivo', left(motivo, 120))
      order by fecha desc
    ),
    '[]'::jsonb
  )
    into v_consultas
  from (
    select fecha, motivo
    from consultas_veterinarias
    where mascota_id = p_pet_id
    order by fecha desc
    limit 3
  ) c;

  -- ── Tendencia de peso: más reciente vs más antiguo entre los últimos 12 ────
  with ult as (
    select peso_kg, fecha
    from historial_peso
    where mascota_id = p_pet_id
    order by fecha desc
    limit 12
  )
  select
    count(*),
    (select peso_kg from ult order by fecha desc limit 1),
    (select fecha   from ult order by fecha desc limit 1),
    (select peso_kg from ult order by fecha asc  limit 1),
    (select fecha   from ult order by fecha asc  limit 1)
  into v_n_pesos, v_peso_reciente, v_fecha_reciente, v_peso_previo, v_fecha_previo
  from ult;

  if v_n_pesos >= 2 and v_fecha_reciente is not null and v_fecha_previo is not null then
    v_delta := v_peso_reciente - v_peso_previo;
    v_dias  := v_fecha_reciente - v_fecha_previo;
    if v_delta <> 0 and v_dias > 0 then
      if v_dias >= 30 then
        v_periodo := round(v_dias / 30.0) || ' meses';
      else
        v_periodo := v_dias || ' días';
      end if;
      v_tendencia :=
        case when v_delta > 0 then 'subió ' else 'bajó ' end
        || replace(to_char(abs(v_delta), 'FM990D0'), '.', ',')
        || ' kg en ' || v_periodo;
    end if;
  end if;

  -- ── Ensamblado final ──────────────────────────────────────────────────────
  return jsonb_build_object(
    'id',               v_m.id,
    'nombre',           coalesce(nullif(trim(v_m.nombre), ''), 'tu mascota'),
    'especie',          v_m.especie,
    'raza',             v_m.raza,
    'edadTexto',        v_edad_texto,
    'edadMeses',        v_edad_meses,
    'etapa',            v_etapa,
    'pesoKg',           v_m.peso,
    'pesoTendencia',    v_tendencia,
    'vacunasAplicadas', v_vac_aplicadas,
    'vacunasPendientes', v_vac_pendientes,
    'consultas',        v_consultas,
    'fechaHoy',         to_char(v_hoy, 'YYYY-MM-DD')
  );
end;
$$;

-- La app usa la anon key y las Edge Functions la service_role; ambas necesitan
-- poder ejecutar la función. (RLS sigue deshabilitado en este proyecto.)
grant execute on function public.get_pet_chat_context(bigint) to anon, authenticated, service_role;
