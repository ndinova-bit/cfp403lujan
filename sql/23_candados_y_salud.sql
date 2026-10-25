-- ==========================================================================
-- 23 · Candados de seguridad y ficha de salud visible para el docente
-- 1) Segunda llave sobre los roles: aunque una regla de permisos quedara mal
--    configurada, nadie que no sea administrador total puede cambiar el rol
--    ni el estado (ACTIVO / PENDIENTE / INACTIVO) de una cuenta.
--    Los procesos del servidor (importación, funciones internas) no tienen
--    sesión de usuario y siguen pudiendo hacerlo.
-- 2) El docente ve siempre, solo lectura, las observaciones de salud de los
--    estudiantes de sus trayectos. Las demás observaciones las ve solo si se
--    marcaron "Visible para el docente".
-- ==========================================================================

create or replace function public.proteger_cambio_rol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;  -- proceso del servidor (sin sesión de usuario)
  end if;
  if (old.rol is distinct from new.rol or old.estado is distinct from new.estado)
     and not public.es_admin_total() then
    raise exception 'No tenés permisos para modificar el rol o el estado de una cuenta.';
  end if;
  return new;
end $$;

revoke execute on function public.proteger_cambio_rol() from public, anon, authenticated;

drop trigger if exists trg_proteger_cambio_rol on public.profiles;
create trigger trg_proteger_cambio_rol
  before update on public.profiles
  for each row execute function public.proteger_cambio_rol();

drop policy if exists obs_select on public.observaciones_estudiante;
create policy obs_select on public.observaciones_estudiante
  for select to authenticated
  using (
    public.es_personal()
    or (public.es_docente_de_alumno(estudiante_user)
        and (tipo = 'salud' or visible_docente))
  );
