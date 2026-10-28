-- =====================================================================================
-- PASO 53 — CIERRE DE AÑO: estudiantes INACTIVOS (sin borrar nada)
--   · Nuevo estado de perfil: INACTIVO (sin acceso al login; su ficha, inscripciones, notas,
--     asistencias y certificados quedan intactos). INHABILITADO sigue siendo el bloqueo manual.
--   · cierre_estudiantes_inactivables(ciclo): estudiantes ACTIVOS sin inscripción vigente
--     (sin baja) en trayectos de un ciclo POSTERIOR al que se cierra.
--   · cierre_inactivar_estudiantes(ciclo, dnis): pasa a INACTIVO solo a los DNI indicados que
--     sigan cumpliendo esa condición. Solo Director y Regente.
--   · Reactivación automática: al inscribirlos de nuevo (o reincorporarlos), un INACTIVO vuelve
--     a ACTIVO. Un INHABILITADO nunca se reactiva solo.
-- =====================================================================================
alter table public.profiles drop constraint if exists profiles_estado_check;
alter table public.profiles add constraint profiles_estado_check
  check (upper(estado) = any (array['ACTIVO', 'PENDIENTE', 'INHABILITADO', 'INACTIVO']));

create or replace function public.cierre_estudiantes_inactivables(p_ciclo integer)
returns table (id uuid, dni text, apellido text, nombre text, ultimo_ciclo integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  return query
  select p.id, p.dni, p.apellido, p.nombre,
         (select max(t.ciclo_lectivo) from public.inscripciones i join public.trayectos t on t.id = i.trayecto_id
           where i.estudiante_user = p.dni)::integer
    from public.profiles p
   where lower(p.rol) = 'estudiante' and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
     and not exists (
       select 1 from public.inscripciones i join public.trayectos t on t.id = i.trayecto_id
        where i.estudiante_user = p.dni and upper(coalesce(i.estado, '')) <> 'BAJA' and t.ciclo_lectivo > p_ciclo)
   order by p.apellido, p.nombre;
end $$;

create or replace function public.cierre_inactivar_estudiantes(p_ciclo integer, p_dnis text[])
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.es_admin() then raise exception 'No autorizado'; end if;
  update public.profiles p set estado = 'INACTIVO'
   where p.dni = any (p_dnis)
     and p.id in (select x.id from public.cierre_estudiantes_inactivables(p_ciclo) x);
  get diagnostics n = row_count;
  return n;
end $$;

-- Reactivación al inscribir o reincorporar (cualquier camino: plataforma, importación, etc.)
create or replace function public.reactivar_estudiante_inscripto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if upper(coalesce(new.estado, '')) <> 'BAJA' then
    update public.profiles set estado = 'ACTIVO'
     where dni = new.estudiante_user and lower(rol) = 'estudiante' and upper(estado) = 'INACTIVO';
  end if;
  return new;
end $$;
drop trigger if exists trg_reactivar_estudiante on public.inscripciones;
create trigger trg_reactivar_estudiante after insert or update of estado on public.inscripciones
  for each row execute function public.reactivar_estudiante_inscripto();

revoke all on function public.cierre_estudiantes_inactivables(integer) from public, anon;
revoke all on function public.cierre_inactivar_estudiantes(integer, text[]) from public, anon;
grant execute on function public.cierre_estudiantes_inactivables(integer) to authenticated;
grant execute on function public.cierre_inactivar_estudiantes(integer, text[]) to authenticated;
