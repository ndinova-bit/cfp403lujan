-- 23. Panel de cifras: procedencia y perfil de los estudiantes (solo cantidades, sin nombres)
-- p_ciclo = null  → todos los ciclos lectivos juntos
-- p_solo_activos  → true: no cuenta a los dados de baja
-- Cuenta personas (no inscripciones): quien cursó dos trayectos figura una sola vez.
create or replace function public.panel_demografia(p_ciclo integer default null, p_solo_activos boolean default true)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  res jsonb;
begin
  if not (public.es_admin() or public.es_preceptor() or public.es_secretaria()) then
    raise exception 'No autorizado';
  end if;

  with est as (
    select distinct i.estudiante_user as dni
      from public.inscripciones i
      join public.trayectos t on t.id = i.trayecto_id
     where (p_ciclo is null or t.ciclo_lectivo::integer = p_ciclo)
       and (not p_solo_activos or upper(coalesce(i.estado, 'ACTIVA')) <> 'BAJA')
  ), d as (
    select e.dni,
           nullif(upper(trim(x.localidad)), '') as localidad,
           nullif(upper(trim(x.lugar_nacimiento)), '') as lugar_nac,
           nullif(trim(x.estudios), '') as estudios,
           case when x.fecha_nacimiento is null then null
                else extract(year from age(hoy, x.fecha_nacimiento))::integer end as edad
      from est e
      left join public.datos_estudiante x on x.dni = e.dni
  )
  select jsonb_build_object(
    'total', (select count(*) from d),
    'localidad', coalesce((select jsonb_agg(jsonb_build_object('k', localidad, 'n', n) order by n desc, localidad)
                             from (select localidad, count(*) n from d where localidad is not null group by 1) q), '[]'::jsonb),
    'lugar_nacimiento', coalesce((select jsonb_agg(jsonb_build_object('k', lugar_nac, 'n', n) order by n desc, lugar_nac)
                             from (select lugar_nac, count(*) n from d where lugar_nac is not null group by 1) q), '[]'::jsonb),
    'estudios', coalesce((select jsonb_agg(jsonb_build_object('k', estudios, 'n', n) order by n desc, estudios)
                             from (select estudios, count(*) n from d where estudios is not null group by 1) q), '[]'::jsonb),
    'edad', (select jsonb_build_array(
               jsonb_build_object('k', 'Menos de 18', 'n', count(*) filter (where edad < 18)),
               jsonb_build_object('k', '18 a 24', 'n', count(*) filter (where edad between 18 and 24)),
               jsonb_build_object('k', '25 a 34', 'n', count(*) filter (where edad between 25 and 34)),
               jsonb_build_object('k', '35 a 44', 'n', count(*) filter (where edad between 35 and 44)),
               jsonb_build_object('k', '45 a 54', 'n', count(*) filter (where edad between 45 and 54)),
               jsonb_build_object('k', '55 o más', 'n', count(*) filter (where edad >= 55))) from d),
    'sin_dato', jsonb_build_object(
      'localidad', (select count(*) from d where localidad is null),
      'lugar_nacimiento', (select count(*) from d where lugar_nac is null),
      'estudios', (select count(*) from d where estudios is null),
      'edad', (select count(*) from d where edad is null))
  ) into res;
  return res;
end $$;
revoke all on function public.panel_demografia(integer, boolean) from public, anon;
grant execute on function public.panel_demografia(integer, boolean) to authenticated;
