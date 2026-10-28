-- =====================================================================================
-- PASO 49 — CAMBIAR EL CORREO DE ACCESO DEL PERSONAL
-- Editar el "correo de contacto" en Usuarios solo cambiaba el perfil, no el correo con el que
-- la persona ingresa (Supabase Auth). Esta función cambia los dos a la vez.
--   · Solo personal (docente, preceptor, regente, secretaria, administrador). Los estudiantes
--     ingresan siempre con DNI@cfp403.ar y no se tocan.
--   · Puede hacerlo el administrador; la regencia, salvo sobre administrador/regente.
-- =====================================================================================
create or replace function public.cambiar_email_acceso(p_user_id uuid, p_email text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  rol_obj text;
  mail text := lower(trim(coalesce(p_email, '')));
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  select lower(coalesce(rol, '')) into rol_obj from public.profiles where id = p_user_id;
  if rol_obj is null then raise exception 'Usuario no encontrado'; end if;
  if rol_obj = 'estudiante' then raise exception 'Los estudiantes ingresan con su DNI: el correo de acceso no se cambia'; end if;
  if not public.es_admin_total() and rol_obj in ('admin', 'administrador', 'regente') then
    raise exception 'Solo el administrador puede cambiar el acceso de dirección o regencia';
  end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El correo no es válido'; end if;
  if exists (select 1 from auth.users where lower(email) = mail and id <> p_user_id) then
    raise exception 'Ya existe otra cuenta con ese correo';
  end if;

  update auth.users set email = mail, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = p_user_id;
  update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(mail)), updated_at = now()
   where user_id = p_user_id and provider = 'email';
  update public.profiles set email = mail where id = p_user_id;
end $$;

revoke all on function public.cambiar_email_acceso(uuid, text) from public, anon;
grant execute on function public.cambiar_email_acceso(uuid, text) to authenticated;
