-- 66 · Verificación en dos pasos del administrador.
-- Mientras el admin NO haya activado el factor, nada cambia (no se lo deja afuera).
-- Cuando lo activa, solo una sesión verificada con el código (aal2) cuenta como administrador.
--
-- Si el admin pierde el celular: desactivar el factor desde la base (SQL Editor):
--   delete from auth.mfa_factors where user_id = (select id from public.profiles where dni = '<DNI>');

create or replace function public.tiene_segundo_paso(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.mfa_factors f
     where f.user_id = p_user and f.status = 'verified'
  );
$$;

revoke all on function public.tiene_segundo_paso(uuid) from public, anon, authenticated;
grant execute on function public.tiene_segundo_paso(uuid) to service_role;

create or replace function public.es_admin_total()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol::text) in ('admin', 'administrador')
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  )
  and (
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not public.tiene_segundo_paso(auth.uid())
  );
$$;

-- Las observaciones institucionales leían el rol directo del perfil: ahora también respetan el segundo paso
do $$
declare
  v_def text;
  v_nuevo text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = '_yo_obs';

  v_nuevo := regexp_replace(
    v_def,
    'where p\.id = auth\.uid\(\)',
    'where p.id = auth.uid() and (lower(p.rol::text) not in (''admin'', ''administrador'') or public.es_admin_total())'
  );

  if v_nuevo = v_def then
    raise exception 'No se encontró la condición a reemplazar en _yo_obs';
  end if;
  execute v_nuevo;
end $$;
