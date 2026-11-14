-- 63 · Cierre de permisos del rol anónimo y corrección de nomina_cooperadora
-- 1) Rol anónimo (sin sesión): solo lectura de lo que muestra la web pública.
--    Las políticas RLS ya lo limitaban; esto agrega una segunda barrera.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.trayectos, public.modulos, public.novedades to anon;

-- Lo que se cree de acá en adelante NO queda abierto al rol anónimo por defecto.
-- (Una función pública nueva necesita: grant execute on function ... to anon;)
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
do $$
begin
  begin execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon'; exception when others then null; end;
  begin execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from anon'; exception when others then null; end;
  begin execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from anon'; exception when others then null; end;
end $$;

-- 2) Usuarios con sesión: no necesitan TRUNCATE, TRIGGER ni REFERENCES.
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- 3) nomina_cooperadora devolvía DNI y domicilio de la comisión a cualquier usuario que no fuera
--    estudiante (docentes incluidos), saltándose la RLS de cooperadora_comision.
--    Ahora exige el mismo rol que esa tabla: dirección/regencia, preceptoría o secretaría.
do $$
declare
  v_def text;
  v_nuevo text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'nomina_cooperadora';

  v_nuevo := regexp_replace(
    v_def,
    'if exists \(select 1 from public\.profiles p where p\.id = auth\.uid\(\) and lower\(p\.rol\) = ''estudiante''\) then\s+raise exception ''No autorizado'';\s+end if;',
    'if not (public.es_admin() or public.es_preceptor() or public.es_secretaria()) then raise exception ''No autorizado''; end if;'
  );

  if v_nuevo = v_def then
    raise exception 'No se encontró la guardia a reemplazar en nomina_cooperadora';
  end if;
  execute v_nuevo;
end $$;
