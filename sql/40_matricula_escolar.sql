-- =====================================================================================
-- PASO 40 — MATRÍCULA ESCOLAR (cuadro 1.1 del Relevamiento Anual)
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- Devuelve, por trayecto del ciclo lectivo: total de alumnos, varones y alumnos por
-- edad en años cumplidos al 30 de junio del ciclo, con los mismos tramos del formulario
-- (menos de 13, 13 … 24, 25 a 29, 30 a 34, 35 a 39, 40 a 44, 45 a 49, 50 a 54, 55 y más).
-- Solo números y datos del curso: no muestra datos personales de nadie.
-- La edad sale de la fecha de nacimiento de la Ficha de Curso (datos_estudiante).
--
-- Mismo permiso que panel_cifras() en Luján (es_admin, es_preceptor o es_secretaria): no
-- se cambia nada ahí. Luján no tiene la columna trayectos.certificacion_oficial (tiene
-- "certificacion"); el campo "N.º de sección" usa esa, gracias al coalesce vía to_jsonb.
-- =====================================================================================

create or replace function public.matricula_escolar(
  p_ciclo integer default null, p_solo_activos boolean default true
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  ciclo integer;
  corte date;
  res   jsonb;
begin
  if not (public.es_admin() or public.es_preceptor() or public.es_secretaria()) then
    raise exception 'No autorizado';
  end if;
  ciclo := coalesce(p_ciclo, extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::integer);
  corte := make_date(ciclo, 6, 30);

  with t as (
    select tr.id, to_jsonb(tr) as j
      from public.trayectos tr
     where nullif(to_jsonb(tr)->>'ciclo_lectivo', '')::integer = ciclo
  ), base as (
    select i.trayecto_id,
           coalesce(d.genero, '?') as g,
           case when d.fecha_nacimiento is null then null
                else (case
                        when extract(year from age(corte, d.fecha_nacimiento)) < 13 then 0
                        when extract(year from age(corte, d.fecha_nacimiento)) <= 24 then extract(year from age(corte, d.fecha_nacimiento))::integer - 12
                        when extract(year from age(corte, d.fecha_nacimiento)) <= 29 then 13
                        when extract(year from age(corte, d.fecha_nacimiento)) <= 34 then 14
                        when extract(year from age(corte, d.fecha_nacimiento)) <= 39 then 15
                        when extract(year from age(corte, d.fecha_nacimiento)) <= 44 then 16
                        when extract(year from age(corte, d.fecha_nacimiento)) <= 49 then 17
                        when extract(year from age(corte, d.fecha_nacimiento)) <= 54 then 18
                        else 19 end)
           end as b
      from public.inscripciones i
      join t on t.id = i.trayecto_id
      left join public.datos_estudiante d on d.dni = i.estudiante_user
     where (not p_solo_activos) or upper(coalesce(i.estado, 'ACTIVA')) <> 'BAJA'
  ), tot as (
    select trayecto_id,
           count(*)::integer                           as total,
           count(*) filter (where g = 'M')::integer    as varones,
           count(*) filter (where g = 'F')::integer    as mujeres,
           count(*) filter (where g = 'X')::integer    as otros,
           count(*) filter (where g = '?')::integer    as sin_genero,
           count(*) filter (where b is null)::integer  as sin_edad
      from base group by trayecto_id
  ), eda as (
    select trayecto_id, b, count(*)::integer as n
      from base where b is not null group by trayecto_id, b
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', t.id,
             'nombre', t.j->>'nombre',
             'nro', coalesce(nullif(t.j->>'certificacion_oficial', ''), nullif(t.j->>'certificacion', '')),
             'codigo', t.j->>'codigo_catalogo',
             'tipo', t.j->>'tipo_certificacion',
             'requisitos', t.j->>'requisitos',
             'horas', nullif(t.j->>'horas', '')::integer,
             'horas_catedra', nullif(t.j->>'horas_catedra', '')::integer,
             'sede', coalesce(t.j->>'sede', 'sede'),
             'total', coalesce(tot.total, 0),
             'varones', coalesce(tot.varones, 0),
             'mujeres', coalesce(tot.mujeres, 0),
             'otros', coalesce(tot.otros, 0),
             'sin_genero', coalesce(tot.sin_genero, 0),
             'sin_edad', coalesce(tot.sin_edad, 0),
             'edades', (select jsonb_agg(coalesce((select e.n from eda e where e.trayecto_id = t.id and e.b = k), 0) order by k)
                          from generate_series(0, 19) k)
           )
           order by nullif(regexp_replace(coalesce(t.j->>'certificacion_oficial', t.j->>'certificacion', ''), '\D', '', 'g'), '')::bigint nulls last,
                    t.j->>'nombre'
         ), '[]'::jsonb)
    into res
    from t left join tot on tot.trayecto_id = t.id;

  return res;
end $$;

revoke all on function public.matricula_escolar(integer, boolean) from public, anon;
grant execute on function public.matricula_escolar(integer, boolean) to authenticated;

-- Verificación: debe devolver 1 fila
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = 'matricula_escolar';
