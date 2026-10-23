-- =====================================================================================
-- 10 · USO DE LA BASE DE DATOS (solo administración)
-- Devuelve cuánto ocupa la base y sus tablas más grandes, para el indicador de
-- "Base de Datos" de la plataforma. El plan gratuito de Supabase permite 500 MB.
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- =====================================================================================
create or replace function public.uso_base()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare res jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo la administración puede ver el uso de la base';
  end if;
  select jsonb_build_object(
    'total_bytes', pg_database_size(current_database()),
    'tablas', coalesce((
      select jsonb_agg(t order by t.bytes desc)
      from (
        select c.relname as tabla,
               pg_total_relation_size(c.oid) as bytes,
               greatest(c.reltuples, 0)::bigint as filas
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc
        limit 12
      ) t), '[]'::jsonb)
  ) into res;
  return res;
end $$;

revoke all on function public.uso_base() from public, anon;
grant execute on function public.uso_base() to authenticated;

-- Comprobación: tiene que aparecer una fila con "uso_base".
-- (La función en sí solo responde a un administrador conectado a la plataforma;
--  desde el SQL Editor no hay usuario, por eso se prueba en Base de Datos.)
select proname as funcion_creada from pg_proc where proname = 'uso_base';
