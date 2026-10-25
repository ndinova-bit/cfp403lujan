-- 24. Regencia y preceptoría: restablecer claves y aprobar usuarios nuevos, con límites
--   · restablecer_clave_basica: solo cuentas de ESTUDIANTE o DOCENTE; la clave queda en CFP403_<DNI>
--   · aprobar_pendiente: solo ESTUDIANTES en estado PENDIENTE; pasa a ACTIVO y NO toca el rol
-- Quedan registradas en la auditoría. Roles, altas y bajas de usuarios siguen siendo solo de administración.

create or replace function public.restablecer_clave_basica(p_user_id uuid)
returns text
language plpgsql security definer set search_path = public, extensions as $fn$
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

  begin delete from auth.sessions where user_id = p_user_id; exception when others then null; end;

  insert into public.auditoria (usuario_id, usuario_dni, usuario_rol, tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
  select v_yo, p.dni, p.rol::text, 'auth.users', 'RESTABLECER_CLAVE', p_user_id::text, null,
         jsonb_build_object('dni', v_dni, 'rol', v_rol)
    from public.profiles p where p.id = v_yo;

  return v_clave;
end $fn$;
revoke all on function public.restablecer_clave_basica(uuid) from public, anon;
grant execute on function public.restablecer_clave_basica(uuid) to authenticated;

create or replace function public.aprobar_pendiente(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not (public.es_admin() or public.es_preceptor()) then
    raise exception 'No autorizado';
  end if;
  update public.profiles
     set estado = 'ACTIVO'
   where id = p_user_id
     and lower(rol::text) = 'estudiante'
     and upper(coalesce(estado, '')) = 'PENDIENTE';
  if not found then
    raise exception 'Solo se pueden aprobar estudiantes que estén pendientes.';
  end if;
end $fn$;
revoke all on function public.aprobar_pendiente(uuid) from public, anon;
grant execute on function public.aprobar_pendiente(uuid) to authenticated;
