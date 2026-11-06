-- 59. Auditoría del restablecimiento de claves hecho por el administrador
-- admin_restablecer_clave ahora deja registro en public.auditoria
-- (operación RESTABLECER_CLAVE_ADMIN, quién lo hizo y a quién; nunca la clave).
-- Ya aplicada en Supabase como migración «auditar_admin_restablecer_clave».

create or replace function public.admin_restablecer_clave(p_user_id uuid, p_nueva text)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
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

  begin
    delete from auth.sessions where user_id = p_user_id;
  exception when others then
    null;
  end;

  insert into public.auditoria (usuario_id, usuario_dni, usuario_rol, tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
  select v_yo, p.dni, p.rol::text, 'auth.users', 'RESTABLECER_CLAVE_ADMIN', p_user_id::text, null,
         jsonb_build_object('dni', v_dni_obj, 'rol', v_rol_obj)
    from public.profiles p where p.id = v_yo;
end;
$function$;
