-- =============================================================================
-- PASO 13 — REVISIÓN TÉCNICA Y LIMPIEZA
--
-- 1. Guarda en un "archivo" las tablas viejas que la plataforma ya no usa.
--    No se borra nada: se mueven al esquema "archivo", que no se ve desde la
--    plataforma ni desde internet. Si alguna vez hiciera falta, se puede volver
--    a traer con:   alter table archivo.NOMBRE set schema public;
-- 2. Revisión de seguridad: al final muestra una lista de controles.
--    Lo ideal es que todos digan "OK".
--
-- Se puede ejecutar más de una vez.
-- =============================================================================

-- 1. ARCHIVO DE TABLAS VIEJAS ------------------------------------------------------
create schema if not exists archivo;
revoke all on schema archivo from public, anon, authenticated;

do $$
declare
  t text;
  movidas text[] := '{}';
begin
  foreach t in array array[
    'usuarios_legacy', 'profiles_respaldo_20261021', 'notas_modulares',
    'contenidos', 'entregas', 'actividades', 'excepciones_modulos'
  ] loop
    if to_regclass('public.' || t) is not null and to_regclass('archivo.' || t) is null then
      execute format('alter table public.%I set schema archivo', t);
      movidas := movidas || t;
    end if;
  end loop;
  raise notice 'Tablas pasadas al archivo: %', movidas;
end $$;

-- 2. REVISIÓN DE SEGURIDAD -------------------------------------------------------------
-- Funciones "security definer" sin search_path fijo (riesgo de que alguien las engañe)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', r.f);
    raise notice 'Se fijó search_path en %', r.f;
  end loop;
end $$;

-- Lista de controles (tiene que salir todo "OK")
with
sin_rls as (
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
),
anon_escribe as (
  select tablename || ' (' || policyname || ')' as x from pg_policies
   where schemaname = 'public' and 'anon' = any(roles) and cmd <> 'SELECT'
),
anon_lee as (
  select distinct tablename from pg_policies
   where schemaname = 'public' and 'anon' = any(roles) and cmd = 'SELECT'
     and tablename not in ('trayectos', 'modulos', 'novedades')
),
admins as (
  select count(*) as n from public.profiles
   where lower(rol) in ('admin', 'administrador') and upper(coalesce(estado, 'ACTIVO')) = 'ACTIVO'
)
select '1. Todas las tablas tienen permisos (RLS) activados' as control,
       case when (select count(*) from sin_rls) = 0 then 'OK'
            else 'REVISAR: ' || (select string_agg(relname, ', ') from sin_rls) end as resultado
union all
select '2. Visitantes sin sesión no pueden modificar nada',
       case when (select count(*) from anon_escribe) = 0 then 'OK'
            else 'REVISAR: ' || (select string_agg(x, ', ') from anon_escribe) end
union all
select '3. Visitantes sin sesión solo ven trayectos, módulos y novedades',
       case when (select count(*) from anon_lee) = 0 then 'OK'
            else 'REVISAR: ' || (select string_agg(tablename, ', ') from anon_lee) end
union all
select '4. Hay al menos una cuenta de administración activa (y no demasiadas)',
       case when (select n from admins) between 1 and 4 then 'OK (' || (select n from admins) || ')'
            else 'REVISAR: hay ' || (select n from admins) || ' cuentas de administración' end
union all
select '5. Tablas viejas en el archivo',
       coalesce((select string_agg(c.relname, ', ') from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'archivo' and c.relkind = 'r'), 'ninguna');
