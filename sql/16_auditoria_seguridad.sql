-- =====================================================================================
-- PASO 16 — CONTROL DE SEGURIDAD (SOLO LECTURA, no cambia nada)
-- Pegar en Supabase → SQL Editor y ejecutar. Cada fila del resultado es un PROBLEMA POSIBLE.
-- Si no devuelve ninguna fila: no se encontraron grietas de este tipo.
-- =====================================================================================
with
-- 1. Tablas de la app sin RLS (cualquiera con la clave pública podría leer/escribir)
a as (
  select '1. Tabla SIN RLS' as control, c.relname::text as objeto, 'Activar: alter table ... enable row level security' as detalle
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity
),
-- 2. RLS activado pero sin ninguna política (nadie puede usarla: probablemente un error)
b as (
  select '2. RLS sin políticas', c.relname::text, 'Nadie podrá leerla desde la app'
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
),
-- 3. Políticas abiertas a todos ("true"), sobre todo para escribir
c as (
  select '3. Política abierta (true)', p.tablename || ' · ' || p.policyname,
         p.cmd || ' · roles ' || p.roles::text || ' · using=' || coalesce(p.qual,'-') || ' · check=' || coalesce(p.with_check,'-')
    from pg_policies p
   where p.schemaname = 'public'
     and (lower(replace(coalesce(p.qual,''),' ','')) in ('true','(true)')
          or lower(replace(coalesce(p.with_check,''),' ','')) in ('true','(true)'))
),
-- 4. Funciones SECURITY DEFINER que puede ejecutar un visitante sin cuenta (anon)
d as (
  select '4. Función ejecutable SIN iniciar sesión', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'SECURITY DEFINER: corre con permisos de administrador. Revocar a anon si no hace falta'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
     and has_function_privilege('anon', p.oid, 'execute')
),
-- 5. Funciones SECURITY DEFINER sin search_path fijo (riesgo de suplantación)
e as (
  select '5. SECURITY DEFINER sin search_path', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'Agregar: set search_path = public'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) cfg where cfg like 'search_path=%')
),
-- 6. Vistas que se saltan la RLS (leen con permisos del dueño)
f as (
  select '6. Vista que ignora RLS', c.relname::text, 'Crear con security_invoker = true, o quitar el acceso a anon/authenticated'
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('v','m')
     and not coalesce('security_invoker=true' = any(c.reloptions), false)
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select'))
),
-- 7. Buckets de archivos públicos
g as (
  select '7. Bucket de archivos público', b.id::text, 'Cualquiera con el enlace puede descargar'
    from storage.buckets b where b.public
),
-- 8. Quién puede ESCRIBIR sin sesión: tablas donde anon tiene insert/update/delete Y existe una política que lo incluye
h as (
  select '8. Anon puede escribir (revisar política)', p.tablename || ' · ' || p.policyname,
         p.cmd || ' · using=' || coalesce(p.qual,'-') || ' · check=' || coalesce(p.with_check,'-')
    from pg_policies p
   where p.schemaname = 'public' and p.cmd in ('INSERT','UPDATE','DELETE','ALL')
     and (p.roles::text ~ 'anon' or p.roles::text ~ 'public')
     and coalesce(p.qual,'') !~ 'auth\.uid|auth\.jwt|es_|current_setting'
     and coalesce(p.with_check,'') !~ 'auth\.uid|auth\.jwt|es_|current_setting'
)
select * from a union all select * from b union all select * from c union all select * from d
union all select * from e union all select * from f union all select * from g union all select * from h
order by 1, 2;
