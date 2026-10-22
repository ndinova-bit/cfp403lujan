-- =============================================================================
-- PASO 3 — Restablecer contraseñas desde "Usuarios y Roles" (solo administrador)
-- Dónde: Supabase > SQL Editor > New query > pegar TODO > Run
--
-- Crea la función admin_restablecer_clave(usuario, contraseña_nueva).
--   * Solo la puede ejecutar una persona con rol admin y estado ACTIVO.
--   * Exige 8 caracteres como mínimo.
--   * Cierra las sesiones abiertas de esa persona.
-- Se puede ejecutar más de una vez.
-- =============================================================================

create or replace function public.admin_restablecer_clave(p_user_id uuid, p_nueva text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;

  if p_nueva is null or length(p_nueva) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  update auth.users
     set encrypted_password = crypt(p_nueva, gen_salt('bf', 10)),
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  -- Cerrar sesiones abiertas (si la tabla existe en esta versión de Supabase)
  begin
    delete from auth.sessions where user_id = p_user_id;
  exception when others then
    null;
  end;
end;
$$;

revoke all on function public.admin_restablecer_clave(uuid, text) from public, anon;
grant execute on function public.admin_restablecer_clave(uuid, text) to authenticated;

-- Verificación: tiene que devolver una fila con la función creada
select proname, prosecdef as security_definer
from pg_proc
where proname = 'admin_restablecer_clave';
