-- 65 · Docentes: deben cambiar la clave inicial antes de usar la plataforma.
-- Se aplica en el servidor: mientras el indicador esté activo, los permisos de docente no rigen.

alter table public.profiles add column if not exists debe_cambiar_clave boolean not null default false;

-- Un docente nuevo (o una persona que pasa a ser docente) arranca con el cambio pendiente
create or replace function public.marcar_cambio_clave_docente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.rol::text, '')) = 'docente'
     and (tg_op = 'INSERT' or lower(coalesce(old.rol::text, '')) <> 'docente') then
    new.debe_cambiar_clave := true;
  end if;
  return new;
end $$;

create or replace trigger profiles_marcar_cambio_clave
  before insert or update of rol on public.profiles
  for each row execute function public.marcar_cambio_clave_docente();

revoke all on function public.marcar_cambio_clave_docente() from public, anon, authenticated;

-- Quien tiene el cambio pendiente lo confirma acá. Solo se apaga si la clave YA NO es la inicial
create or replace function public.confirmar_cambio_clave()
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_dni text;
  v_enc text;
begin
  select p.dni into v_dni from public.profiles p where p.id = auth.uid() and p.debe_cambiar_clave;
  if not found then return; end if;

  select u.encrypted_password into v_enc from auth.users u where u.id = auth.uid();
  if v_enc is null
     or v_enc = crypt('CFP403_' || trim(v_dni), v_enc)
     or v_enc = crypt(trim(v_dni), v_enc) then
    raise exception 'Todavía tenés la contraseña inicial. Elegí una contraseña nueva y distinta.';
  end if;

  update public.profiles set debe_cambiar_clave = false where id = auth.uid();
end $$;

revoke all on function public.confirmar_cambio_clave() from public, anon;
grant execute on function public.confirmar_cambio_clave() to authenticated;

-- Los permisos de docente no rigen mientras el cambio esté pendiente
create or replace function public.es_docente()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol) = 'docente'
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
      and not p.debe_cambiar_clave
  );
$$;

create or replace function public.es_docente_de(p_trayecto text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.trayectos t
    join public.profiles p on p.id = auth.uid() and p.rol = 'docente' and not p.debe_cambiar_clave
    where t.id::text = p_trayecto
      and p.dni = any (
        select trim(x) from unnest(string_to_array(coalesce(t.docente_user, ''), ',')) x
      )
  )
$$;

-- Si alguien restablece la clave de un docente, vuelve a quedar con el cambio pendiente
create or replace function public.restablecer_clave_basica(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_rol  text;
  v_dni  text;
  v_clave text;
  v_yo   uuid := auth.uid();
begin
  if not (public.es_admin() or public.es_preceptor()) then
    raise exception 'No autorizado';
  end if;

  select lower(p.rol::text), p.dni into v_rol, v_dni from public.profiles p where p.id = p_user_id;
  if not found then raise exception 'Usuario no encontrado'; end if;
  if v_rol not in ('estudiante', 'docente') then
    raise exception 'Solo se pueden restablecer claves de estudiantes y docentes. Para otras cuentas, consultá a administración.';
  end if;
  if v_dni is null or length(trim(v_dni)) = 0 then raise exception 'La cuenta no tiene DNI cargado'; end if;

  v_clave := 'CFP403_' || trim(v_dni);
  update auth.users set encrypted_password = crypt(v_clave, gen_salt('bf', 10)), updated_at = now() where id = p_user_id;
  if not found then raise exception 'Usuario no encontrado'; end if;

  if v_rol = 'docente' then
    update public.profiles set debe_cambiar_clave = true where id = p_user_id;
  end if;

  begin delete from auth.sessions where user_id = p_user_id; exception when others then null; end;

  insert into public.auditoria (usuario_id, usuario_dni, usuario_rol, tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
  select v_yo, p.dni, p.rol::text, 'auth.users', 'RESTABLECER_CLAVE', p_user_id::text, null,
         jsonb_build_object('dni', v_dni, 'rol', v_rol)
    from public.profiles p where p.id = v_yo;

  return v_clave;
end $$;

create or replace function public.admin_restablecer_clave(p_user_id uuid, p_nueva text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_yo uuid := auth.uid();
  v_rol_obj text;
  v_dni_obj text;
begin
  if not public.es_admin_total() then
    raise exception 'No autorizado';
  end if;

  if p_nueva is null or length(p_nueva) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  select lower(p.rol::text), p.dni into v_rol_obj, v_dni_obj
    from public.profiles p where p.id = p_user_id;

  update auth.users
     set encrypted_password = crypt(p_nueva, gen_salt('bf', 10)),
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  if v_rol_obj = 'docente' then
    update public.profiles set debe_cambiar_clave = true where id = p_user_id;
  end if;

  -- Cerrar sesiones abiertas (si la tabla existe en esta versión de Supabase)
  begin
    delete from auth.sessions where user_id = p_user_id;
  exception when others then
    null;
  end;

  -- Auditoría: queda registrado quién restableció la clave y a quién (nunca la clave en sí)
  insert into public.auditoria (usuario_id, usuario_dni, usuario_rol, tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
  select v_yo, p.dni, p.rol::text, 'auth.users', 'RESTABLECER_CLAVE_ADMIN', p_user_id::text, null,
         jsonb_build_object('dni', v_dni_obj, 'rol', v_rol_obj)
    from public.profiles p where p.id = v_yo;
end;
$$;

-- Docentes que ya existían: quedan con el cambio pendiente (aplicado aparte, una sola vez)
update public.profiles set debe_cambiar_clave = true where lower(rol::text) = 'docente' and not debe_cambiar_clave;
