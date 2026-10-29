-- =====================================================================================
-- PASO 54 — N.º DE EGRESADO: lo asignan Director, Regente y Secretaría
--   · asignar_num_egresado(inscripcion, numero, forzar): único camino para Secretaría.
--     Avisa si el número ya está en otra inscripción (se puede forzar).
--   · proteger_inscripcion(): Secretaría puede cambiar SOLO el N.º de egresado (no el
--     trayecto ni el estudiante). Preceptores y docentes siguen sin poder cambiarlo.
--   Lo VEN Director, Regente, Secretaría y Preceptoría (ficha del estudiante / fichas de curso).
-- =====================================================================================
create or replace function public.proteger_inscripcion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_admin() then return new; end if;
  if public.es_secretaria()
     and new.trayecto_id is not distinct from old.trayecto_id
     and new.estudiante_user is not distinct from old.estudiante_user then
    return new;   -- Secretaría: solo puede haber cambiado el N.º de egresado
  end if;
  if new.num_egresado is distinct from old.num_egresado
     or new.trayecto_id is distinct from old.trayecto_id
     or new.estudiante_user is distinct from old.estudiante_user then
    raise exception 'Solo la dirección puede modificar esos datos de la inscripción';
  end if;
  return new;
end $$;

create or replace function public.asignar_num_egresado(p_inscripcion bigint, p_num text, p_forzar boolean default false)
returns text
language plpgsql security definer set search_path = public as $$
declare v text := nullif(trim(coalesce(p_num, '')), ''); otro text;
begin
  if not (public.es_admin() or public.es_secretaria()) then raise exception 'No autorizado'; end if;
  if v is not null and length(v) > 30 then raise exception 'El N.º de egresado es demasiado largo'; end if;
  if not exists (select 1 from public.inscripciones where id = p_inscripcion) then raise exception 'Inscripción inexistente'; end if;
  if v is not null and not coalesce(p_forzar, false) then
    select estudiante_user into otro from public.inscripciones where num_egresado = v and id <> p_inscripcion limit 1;
    if otro is not null then return 'duplicado:' || otro; end if;
  end if;
  update public.inscripciones set num_egresado = v where id = p_inscripcion;
  return 'ok';
end $$;
revoke all on function public.asignar_num_egresado(bigint, text, boolean) from public, anon;
grant execute on function public.asignar_num_egresado(bigint, text, boolean) to authenticated;
