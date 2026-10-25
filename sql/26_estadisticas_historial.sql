-- 26. Estadísticas de trayectos e historial de trayectos de cada estudiante
--  · estadisticas_trayectos(desde, hasta): por especialidad (nombre del trayecto) y por sector,
--    inscriptos, egresados (con N.º de egresado), bajas, y estudiantes que cursan más de un trayecto.
--    Solo administración y regencia.
--  · historial_estudiante(dni): trayectos que cursó (ciclo, estado, N.º de egresado).
--    Administración, regencia, preceptoría y secretaría.
-- Definiciones: certificado = inscripción con N.º de egresado; baja = estado BAJA (manual o automática),
-- sin contar a los reincorporados; "finalizado" = el trayecto ya tiene fecha de cierre pasada.

create or replace function public.estadisticas_trayectos(p_desde integer default null, p_hasta integer default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  res jsonb;
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;

  with base as (
    select i.estudiante_user as dni, t.id as tid, t.nombre as trayecto,
           coalesce(nullif(trim(t.sector), ''), 'Sin sector') as sector,
           t.ciclo_lectivo::integer as ciclo,
           (upper(coalesce(i.estado, 'ACTIVA')) = 'BAJA') as baja,
           (nullif(trim(coalesce(i.num_egresado::text, '')), '') is not null) as egresado,
           (t.fecha_cierre is not null and t.fecha_cierre <= hoy) as finalizado
      from public.inscripciones i
      join public.trayectos t on t.id = i.trayecto_id
     where (p_desde is null or t.ciclo_lectivo::integer >= p_desde)
       and (p_hasta is null or t.ciclo_lectivo::integer <= p_hasta)
  ), por_nombre as (
    select trayecto as k, min(sector) as sector, count(distinct tid) as ediciones, count(*) as inscriptos,
           count(*) filter (where baja) as bajas, count(*) filter (where egresado) as egresados,
           count(*) filter (where finalizado) as inscr_finalizados,
           count(*) filter (where finalizado and egresado) as egr_finalizados
      from base group by trayecto
  ), por_sector as (
    select sector as k, count(distinct tid) as ediciones, count(*) as inscriptos,
           count(*) filter (where baja) as bajas, count(*) filter (where egresado) as egresados,
           count(*) filter (where finalizado) as inscr_finalizados,
           count(*) filter (where finalizado and egresado) as egr_finalizados
      from base group by sector
  ), multi as (
    select b.dni, count(distinct b.tid) as n,
           jsonb_agg(jsonb_build_object('trayecto', b.trayecto, 'ciclo', b.ciclo,
             'estado', case when b.baja then 'Baja' when b.egresado then 'Aprobado' when b.finalizado then 'Finalizado sin certificar' else 'Cursando' end)
             order by b.ciclo, b.trayecto) as detalle
      from base b group by b.dni having count(distinct b.tid) > 1
  )
  select jsonb_build_object(
    'resumen', (select jsonb_build_object('trayectos', count(distinct tid), 'personas', count(distinct dni),
                  'inscripciones', count(*), 'bajas', count(*) filter (where baja), 'egresados', count(*) filter (where egresado),
                  'inscr_finalizados', count(*) filter (where finalizado),
                  'egr_finalizados', count(*) filter (where finalizado and egresado)) from base),
    'por_nombre', coalesce((select jsonb_agg(to_jsonb(p) order by p.inscriptos desc, p.k) from por_nombre p), '[]'::jsonb),
    'por_sector', coalesce((select jsonb_agg(to_jsonb(p) order by p.inscriptos desc, p.k) from por_sector p), '[]'::jsonb),
    'multi_total', (select count(*) from multi),
    'multi', coalesce((select jsonb_agg(jsonb_build_object('dni', m.dni,
                'nombre', coalesce(nullif(trim(coalesce(pr.apellido, '') || ', ' || coalesce(pr.nombre, '')), ','), m.dni),
                'n', m.n, 'detalle', m.detalle) order by m.n desc, pr.apellido)
              from (select * from multi order by n desc limit 100) m
              left join public.profiles pr on pr.dni = m.dni), '[]'::jsonb),
    'ciclos', (select jsonb_build_object('min', min(ciclo_lectivo::integer), 'max', max(ciclo_lectivo::integer)) from public.trayectos)
  ) into res;
  return res;
end $fn$;
revoke all on function public.estadisticas_trayectos(integer, integer) from public, anon;
grant execute on function public.estadisticas_trayectos(integer, integer) to authenticated;

create or replace function public.historial_estudiante(p_dni text)
returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not (public.es_admin() or public.es_preceptor() or public.es_secretaria()) then
    raise exception 'No autorizado';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'trayecto', t.nombre, 'ciclo', t.ciclo_lectivo::integer, 'sede', t.sede,
             'inicio', t.fecha_inicio, 'cierre', t.fecha_cierre,
             'num_egresado', nullif(trim(coalesce(i.num_egresado::text, '')), ''),
             'estado', case when upper(coalesce(i.estado, 'ACTIVA')) = 'BAJA' then 'Baja'
                            when nullif(trim(coalesce(i.num_egresado::text, '')), '') is not null then 'Aprobado'
                            when t.fecha_cierre is not null and t.fecha_cierre <= hoy then 'Finalizado sin certificar'
                            else 'Cursando' end,
             'fecha_baja', i.fecha_baja, 'motivo_baja', i.motivo_baja)
           order by t.ciclo_lectivo desc, t.fecha_inicio desc nulls last, t.nombre)
      from public.inscripciones i
      join public.trayectos t on t.id = i.trayecto_id
     where i.estudiante_user = p_dni), '[]'::jsonb);
end $fn$;
revoke all on function public.historial_estudiante(text) from public, anon;
grant execute on function public.historial_estudiante(text) to authenticated;
