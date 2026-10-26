-- =====================================================================================
-- PASO 34 — Días sin clase (licencia del instructor, jornada institucional, paro, otro)
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede volver a ejecutar sin romper nada.
--
-- Hasta ahora, tomar asistencia solo permitía marcar a cada estudiante como presente,
-- tarde, ausente o justificado — no había forma de registrar que, directamente, no hubo
-- clase ese día (sin que eso cuente como falta para nadie).
--
--   1. Nuevo estado 'sin_clase' en asistencias.estado (no cuenta ni como presente ni
--      como ausente en ningún cálculo: porcentaje de asistencia, alertas de inasistencias
--      ni panel de cifras).
--   2. Columna asistencias.motivo (texto libre: "Licencia del instructor", "Jornada
--      institucional", "Paro", "Otro: ...").
--   3. guardar_asistencia() ahora también guarda el motivo cuando viene en el registro.
--   4. alertas_inasistencias() y panel_cifras() excluyen los días 'sin_clase'.
-- =====================================================================================

-- 1 y 2. Estado y columna nuevos
alter table public.asistencias add column if not exists motivo text;

do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.asistencias'::regclass and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%estado%'
  loop
    execute format('alter table public.asistencias drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.asistencias add constraint asistencias_estado_check
  check (lower(estado) in ('presente', 'tarde', 'ausente', 'justificado', 'sin_clase'));

-- 3. guardar_asistencia(): ahora también guarda el motivo
create or replace function public.guardar_asistencia(p_trayecto bigint, p_modulo bigint, p_fecha date, p_registros jsonb)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare n integer;
begin
  if not (public.es_admin() or public.es_preceptor() or public.es_docente_de(p_trayecto)) then
    raise exception 'No tenés permiso para cargar asistencia en este trayecto';
  end if;
  delete from public.asistencias
   where trayecto_id = p_trayecto and fecha = p_fecha and modulo_id is not distinct from p_modulo;
  insert into public.asistencias (trayecto_id, modulo_id, estudiante_user, fecha, estado, motivo)
  select p_trayecto, p_modulo, r->>'estudiante_user', p_fecha, lower(r->>'estado'), nullif(r->>'motivo', '')
    from jsonb_array_elements(p_registros) r
   where coalesce(r->>'estudiante_user', '') <> '';
  get diagnostics n = row_count;
  return n;
end $$;

-- 4.1 alertas_inasistencias(): los días 'sin_clase' no cuentan ni suman ni cortan racha
create or replace function public.alertas_inasistencias(p_trayecto bigint default null::bigint, p_seguidas integer default 3, p_pct integer default 70)
returns table(trayecto_id bigint, trayecto text, dni text, nombre text, seguidas integer, ultima_presencia date, registros integer, pct integer)
language sql stable security definer set search_path to 'public'
as $$
  with permitidos as (
    select t.id, t.nombre::text as nombre from public.trayectos t
     where (p_trayecto is null or t.id = p_trayecto)
       and (public.es_personal() or public.es_docente_de(t.id))
  ), activos as (
    select i.trayecto_id, i.estudiante_user from public.inscripciones i
      join permitidos p on p.id = i.trayecto_id
     where upper(coalesce(i.estado, 'ACTIVA')) <> 'BAJA'
  ), dias as (
    select s.trayecto_id, s.estudiante_user, s.fecha::date as fecha,
           bool_or(lower(s.estado) in ('presente', 'tarde')) as presente,
           bool_and(lower(s.estado) = 'ausente') as ausente_total
      from public.asistencias s
      join activos a on a.trayecto_id = s.trayecto_id and a.estudiante_user = s.estudiante_user
     where lower(s.estado) <> 'sin_clase'
     group by s.trayecto_id, s.estudiante_user, s.fecha::date
  ), ordenados as (
    select d.*, row_number() over (partition by d.trayecto_id, d.estudiante_user order by d.fecha desc) as rn
      from dias d
  ), racha as (
    select o.trayecto_id, o.estudiante_user,
           (coalesce(min(o.rn) filter (where not o.ausente_total), count(*) + 1) - 1)::integer as seguidas,
           max(o.fecha) filter (where o.presente) as ultima_presencia,
           count(*)::integer as registros,
           round(100.0 * count(*) filter (where o.presente) / count(*))::integer as pct
      from ordenados o
     group by o.trayecto_id, o.estudiante_user
  )
  select r.trayecto_id, p.nombre, r.estudiante_user,
         coalesce(nullif(upper(trim(coalesce(pf.apellido, ''))) || ', ' || trim(coalesce(pf.nombre, '')), ', '), 'DNI ' || r.estudiante_user),
         r.seguidas, r.ultima_presencia, r.registros, r.pct
    from racha r
    join permitidos p on p.id = r.trayecto_id
    left join public.profiles pf on pf.dni = r.estudiante_user
   where r.seguidas >= p_seguidas or (r.registros >= 3 and r.pct < p_pct)
   order by r.seguidas desc, r.pct asc, 4;
$$;

-- 4.2 panel_cifras(): los días 'sin_clase' no suman a "días de clase" ni a los registros
create or replace function public.panel_cifras(p_ciclo integer default null::integer)
returns table(trayecto_id bigint, trayecto text, ciclo integer, sede text, inscriptos integer, activos integer, bajas integer, ins_mujeres integer, ins_varones integer, ins_otros integer, ins_sin_dato integer, act_mujeres integer, act_varones integer, act_otros integer, act_sin_dato integer, dias_clase integer, registros integer, presentes integer, pct_asistencia numeric)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not (public.es_admin() or public.es_preceptor() or public.es_secretaria()) then
    raise exception 'No autorizado';
  end if;
  return query
  with t as (
    select tr.id, tr.nombre::text as nombre, tr.ciclo_lectivo::integer as ciclo, coalesce(tr.sede, 'sede')::text as sede
      from public.trayectos tr
     where p_ciclo is null or tr.ciclo_lectivo::integer = p_ciclo
  ), ins as (
    select i.trayecto_id, i.estudiante_user,
           upper(coalesce(i.estado, 'ACTIVA')) = 'BAJA' as es_baja,
           coalesce(d.genero, '?') as g
      from public.inscripciones i
      join t on t.id = i.trayecto_id
      left join public.datos_estudiante d on d.dni = i.estudiante_user
  ), a as (
    select s.trayecto_id,
           count(distinct s.fecha) as dias,
           count(*) as regs,
           count(*) filter (where lower(s.estado) in ('presente', 'tarde')) as pres
      from public.asistencias s
      join ins on ins.trayecto_id = s.trayecto_id and ins.estudiante_user = s.estudiante_user and not ins.es_baja
     where lower(s.estado) <> 'sin_clase'
     group by s.trayecto_id
  )
  select t.id, t.nombre, t.ciclo, t.sede,
         count(ins.estudiante_user)::integer,
         count(ins.estudiante_user) filter (where not ins.es_baja)::integer,
         count(ins.estudiante_user) filter (where ins.es_baja)::integer,
         count(*) filter (where ins.g = 'F')::integer,
         count(*) filter (where ins.g = 'M')::integer,
         count(*) filter (where ins.g = 'X')::integer,
         count(*) filter (where ins.g = '?')::integer,
         count(*) filter (where ins.g = 'F' and not ins.es_baja)::integer,
         count(*) filter (where ins.g = 'M' and not ins.es_baja)::integer,
         count(*) filter (where ins.g = 'X' and not ins.es_baja)::integer,
         count(*) filter (where ins.g = '?' and not ins.es_baja)::integer,
         coalesce(max(a.dias), 0)::integer,
         coalesce(max(a.regs), 0)::integer,
         coalesce(max(a.pres), 0)::integer,
         case when coalesce(max(a.regs), 0) = 0 then null
              else round(100.0 * max(a.pres) / max(a.regs), 1) end
    from t
    left join ins on ins.trayecto_id = t.id
    left join a on a.trayecto_id = t.id
   group by t.id, t.nombre, t.ciclo, t.sede
   order by t.nombre;
end $$;

-- Verificación
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.asistencias'::regclass and contype = 'c';
