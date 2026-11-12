-- =====================================================================================
-- PASO 62 — LIBRO MATRIZ: registro de N.º de curso, N.º de egresado y trayectos realizados
--   · libro_matriz(ciclo): devuelve, solo lectura, los cursos (con su N.º de curso oficial,
--     inscriptos y egresados) y los egresados (N.º de egresado, estudiante y trayecto cursado).
--   · No guarda nada nuevo: se arma con lo que ya se carga en trayectos (N.º de curso oficial)
--     y en inscripciones (N.º de egresado), así que se actualiza solo cuando se modifica algo.
--   · Lo ven Director, Regente, Secretaría y Preceptoría. Docentes y estudiantes no.
-- =====================================================================================
create or replace function public.libro_matriz(p_ciclo integer default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_cursos jsonb; v_egresados jsonb;
begin
  if not (public.es_admin() or public.es_regente() or public.es_secretaria() or public.es_preceptor()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.ciclo desc nulls last, length(coalesce(r.nro_curso, '')), r.nro_curso nulls last, r.id), '[]'::jsonb)
    into v_cursos
  from (
    select t.id,
           nullif(trim(t.certificacion), '') as nro_curso,
           t.nombre, t.sector,
           t.ciclo_lectivo::text as ciclo,
           t.resolucion, t.acto_administrativo, t.codigo_catalogo, t.horas,
           t.fecha_inicio, t.fecha_cierre, t.sede,
           (select count(*) from public.inscripciones i where i.trayecto_id = t.id) as inscriptos,
           (select count(*) from public.inscripciones i
             where i.trayecto_id = t.id and nullif(trim(i.num_egresado), '') is not null) as egresados
    from public.trayectos t
    where p_ciclo is null or t.ciclo_lectivo::text = p_ciclo::text
  ) r;

  select coalesce(jsonb_agg(to_jsonb(r) order by length(r.num_egresado), r.num_egresado, r.inscripcion_id), '[]'::jsonb)
    into v_egresados
  from (
    select i.id as inscripcion_id,
           trim(i.num_egresado) as num_egresado,
           i.estudiante_user as dni,
           u.apellido, u.nombre,
           t.id as trayecto_id, t.nombre as trayecto,
           nullif(trim(t.certificacion), '') as nro_curso,
           t.ciclo_lectivo::text as ciclo,
           ce.fecha_egreso, ce.fecha_entrega
    from public.inscripciones i
    join public.trayectos t on t.id = i.trayecto_id
    left join public.usuarios u on u.usuario = i.estudiante_user
    left join lateral (
      select c.fecha_egreso, c.fecha_entrega from public.certificados_emitidos c
      where c.inscripcion_id = i.id::text order by c.created_at desc limit 1
    ) ce on true
    where nullif(trim(i.num_egresado), '') is not null
      and (p_ciclo is null or t.ciclo_lectivo::text = p_ciclo::text)
  ) r;

  return jsonb_build_object('cursos', v_cursos, 'egresados', v_egresados);
end $$;

revoke all on function public.libro_matriz(integer) from public, anon;
grant execute on function public.libro_matriz(integer) to authenticated;
