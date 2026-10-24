-- =====================================================================================
-- PASO 14 — REGENTE, SECRETARÍA, PANEL DE CIFRAS Y ALERTAS DE INASISTENCIAS
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
--   1. Roles nuevos: "regente" y "secretaria".
--   2. Regente = casi como administración (trayectos, módulos, docentes y suplentes,
--      actas, certificados, fichas, bajas, novedades, auditoría, importar estudiantes).
--      NO puede: crear cuentas ni cambiar roles/claves, eliminar usuarios, cierre de ciclo,
--      respaldos ni el panel de espacio de la base: eso queda solo para la administración.
--   3. Género en los datos del estudiante (para las cifras de Secretaría).
--   4. Panel de cifras por trayecto (solo números, sin datos personales).
--   5. Alertas de inasistencias (faltas seguidas o porcentaje bajo).
-- =====================================================================================

-- 1. ROLES -------------------------------------------------------------------------------
do $$
declare c record; tipo text; nombre_tipo text;
begin
  select data_type, udt_name into tipo, nombre_tipo from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name = 'rol';
  if tipo = 'USER-DEFINED' then
    execute format('alter type public.%I add value if not exists %L', nombre_tipo, 'regente');
    execute format('alter type public.%I add value if not exists %L', nombre_tipo, 'secretaria');
  end if;
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.profiles'::regclass and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%rol%' and pg_get_constraintdef(con.oid) ilike '%docente%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
    execute 'alter table public.profiles add constraint profiles_rol_check
             check (lower(rol::text) in (''admin'',''administrador'',''docente'',''estudiante'',''preceptor'',''regente'',''secretaria''))';
  end loop;
end $$;

-- 2. FUNCIONES DE ROL ----------------------------------------------------------------------
-- es_admin_total(): SOLO la administración (la definición de siempre de es_admin).
create or replace function public.es_admin_total()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol::text) in ('admin', 'administrador')
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  );
$$;

create or replace function public.es_regente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol::text) = 'regente'
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  );
$$;

create or replace function public.es_secretaria()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol::text) in ('secretaria', 'secretario')
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  );
$$;

-- es_admin() pasa a significar "dirección": administración o regencia.
-- Todas las políticas que ya usaban es_admin() quedan abiertas también para el regente.
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin_total() or public.es_regente();
$$;

revoke all on function public.es_admin_total() from public, anon;
revoke all on function public.es_regente()     from public, anon;
revoke all on function public.es_secretaria()  from public, anon;
grant execute on function public.es_admin_total() to authenticated;
grant execute on function public.es_regente()     to authenticated;
grant execute on function public.es_secretaria()  to authenticated;

-- 3. LO QUE QUEDA SOLO PARA LA ADMINISTRACIÓN -------------------------------------------------
-- 3.1 Funciones: restablecer claves, espacio de la base, resumen y archivo de respuestas
do $$
declare r record; def text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('admin_restablecer_clave', 'uso_base', 'resumen_respuestas', 'archivar_respuestas')
  loop
    def := pg_get_functiondef(r.oid);
    if def like '%public.es_admin()%' then
      execute replace(def, 'public.es_admin()', 'public.es_admin_total()');
    end if;
  end loop;
end $$;

-- 3.2 Perfiles: solo la administración crea, cambia (rol, estado) o borra cuentas
do $$
declare r record; usa text; chequea text; sql text;
begin
  for r in
    select policyname, qual, with_check from pg_policies
     where schemaname = 'public' and tablename = 'profiles' and cmd <> 'SELECT'
  loop
    usa := case when r.qual is null then null
                else regexp_replace(r.qual, '(public\.)?es_admin\(\)', 'public.es_admin_total()', 'g') end;
    chequea := case when r.with_check is null then null
                    else regexp_replace(r.with_check, '(public\.)?es_admin\(\)', 'public.es_admin_total()', 'g') end;
    sql := format('alter policy %I on public.profiles', r.policyname)
           || coalesce(' using (' || usa || ')', '')
           || coalesce(' with check (' || chequea || ')', '');
    execute sql;
  end loop;
end $$;

-- 4. GÉNERO ---------------------------------------------------------------------------------
alter table public.datos_estudiante add column if not exists genero text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'datos_estudiante_genero_check') then
    alter table public.datos_estudiante
      add constraint datos_estudiante_genero_check check (genero is null or genero in ('F', 'M', 'X'));
  end if;
end $$;

-- 5. PANEL DE CIFRAS PARA SECRETARÍA ---------------------------------------------------------------
-- Devuelve solo números por trayecto: inscriptos, bajas, género y % de asistencia.
create or replace function public.panel_cifras(p_ciclo integer default null)
returns table (
  trayecto_id bigint, trayecto text, ciclo integer, sede text,
  inscriptos integer, activos integer, bajas integer,
  ins_mujeres integer, ins_varones integer, ins_otros integer, ins_sin_dato integer,
  act_mujeres integer, act_varones integer, act_otros integer, act_sin_dato integer,
  dias_clase integer, registros integer, presentes integer, pct_asistencia numeric
)
language plpgsql stable security definer set search_path = public as $$
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
revoke all on function public.panel_cifras(integer) from public, anon;
grant execute on function public.panel_cifras(integer) to authenticated;

-- 6. ALERTAS DE INASISTENCIAS ------------------------------------------------------------------
-- Un día cuenta como falta si el estudiante figura "ausente" en todo lo cargado ese día
-- (el "justificado" corta la racha). Alerta si lleva p_seguidas faltas seguidas contando
-- desde la última clase, o si su asistencia está por debajo de p_pct % (con 3 clases o más).
create or replace function public.alertas_inasistencias(
  p_trayecto bigint default null, p_seguidas integer default 3, p_pct integer default 70
)
returns table (
  trayecto_id bigint, trayecto text, dni text, nombre text,
  seguidas integer, ultima_presencia date, registros integer, pct integer
)
language sql stable security definer set search_path = public as $$
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
revoke all on function public.alertas_inasistencias(bigint, integer, integer) from public, anon;
grant execute on function public.alertas_inasistencias(bigint, integer, integer) to authenticated;

-- Verificación (solo lectura): debe devolver 5 filas
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('es_admin_total', 'es_regente', 'es_secretaria', 'panel_cifras', 'alertas_inasistencias')
 order by 1;
