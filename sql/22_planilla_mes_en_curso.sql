-- 22. Planilla: el mes en curso se muestra por adelantado (matrícula a la fecha de hoy)

create or replace function public.planilla_matricula(p_ciclo integer default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hoy    date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  ciclo  integer;
  res    jsonb := '[]'::jsonb;
  t      record;
  tj     jsonb;
  ini    date;
  fin    date;
  meses  jsonb;
  m      integer;
  d_ini  date;
  d_fin  date;
  ref    date;
  cnt    jsonb;
  inscr  jsonb;
  aprob  jsonb;
begin
  if not (public.es_personal() or public.es_secretaria() or public.es_docente()) then
    raise exception 'No autorizado';
  end if;
  ciclo := coalesce(p_ciclo, extract(year from hoy)::integer);

  for t in
    select tr.id, to_jsonb(tr) as j,
           (select upper(coalesce(p.apellido, '')) || ', ' || trim(coalesce(p.nombre, ''))
              from public.profiles p where p.dni = tr.docente_user limit 1) as docente
      from public.trayectos tr
     where nullif(to_jsonb(tr)->>'ciclo_lectivo', '')::integer = ciclo
  loop
    tj  := t.j;
    ini := nullif(tj->>'fecha_inicio', '')::date;
    fin := nullif(tj->>'fecha_cierre', '')::date;

    -- Cantidad de inscriptos: todos los inscriptos del trayecto (aunque luego se hayan dado de baja)
    select jsonb_build_object(
             'v', count(*) filter (where d.genero = 'M'), 'm', count(*) filter (where d.genero = 'F'),
             'x', count(*) filter (where d.genero = 'X'), 's', count(*) filter (where d.genero is null))
      into inscr
      from public.inscripciones i
      left join public.datos_estudiante d on d.dni = i.estudiante_user
     where i.trayecto_id = t.id;

    -- Matrícula de cada fin de mes (31/03 … 31/12)
    meses := '[]'::jsonb;
    for m in 3..12 loop
      d_ini := make_date(ciclo, m, 1);
      d_fin := (d_ini + interval '1 month' - interval '1 day')::date;
      if ini is null or ini > d_fin then
        meses := meses || jsonb_build_array(null);                        -- todavía no empezó
      else
        -- El mes en curso se muestra por adelantado, con la matrícula a hoy
        -- (la inspección lo pide unos días antes del cierre del mes).
        ref := least(d_fin, coalesce(fin, d_fin), hoy);
        if d_ini > hoy then
          meses := meses || jsonb_build_array(null);                      -- el mes todavía no empezó
        elsif fin is not null and fin < d_ini then
          meses := meses || jsonb_build_array(jsonb_build_object('z', true));   -- el curso ya finalizó: 0
        else
          cnt := public._matricula_en(t.id, ref);
          meses := meses || jsonb_build_array(cnt);
        end if;
      end if;
    end loop;

    -- Aprobados: estudiantes con número de egresado cargado (solo cursos ya finalizados)
    if fin is not null and fin <= hoy then
      select jsonb_build_object(
               'v', count(*) filter (where d.genero = 'M'), 'm', count(*) filter (where d.genero = 'F'),
               'x', count(*) filter (where d.genero = 'X'))
        into aprob
        from public.inscripciones i
        left join public.datos_estudiante d on d.dni = i.estudiante_user
       where i.trayecto_id = t.id and nullif(to_jsonb(i)->>'num_egresado', '') is not null;
    else
      aprob := null;
    end if;

    res := res || jsonb_build_array(jsonb_build_object(
      'id', t.id,
      'nro', coalesce(nullif(tj->>'certificacion_oficial', ''), nullif(tj->>'certificacion', '')),
      'nombre', tj->>'nombre',
      'sede', coalesce(tj->>'sede', 'sede'),
      'lugar', tj->>'lugar_dictado',
      'docente', t.docente,
      'horas', nullif(tj->>'horas', '')::integer,
      'horas_catedra', nullif(tj->>'horas_catedra', '')::integer,
      'horario_dias', tj->'horario_dias',
      'inicio', ini,
      'cierre', fin,
      'obs', tj->>'obs_planilla',
      'inscriptos', inscr,
      'mat_inicio', case when ini is not null and ini <= hoy then public._matricula_en(t.id, ini) else null end,
      'meses', meses,
      'aprobados', aprob
    ));
  end loop;

  return res;
end $$;
revoke all on function public.planilla_matricula(integer) from public, anon;
grant execute on function public.planilla_matricula(integer) to authenticated;
