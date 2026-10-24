-- =====================================================================================
-- PASO 15 — PLANILLA DE INFORMACIÓN BÁSICA (MATRÍCULA MENSUAL POF/POFA)
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
--   1. Datos nuevos del trayecto: horario por día, horas cátedra y observaciones de la planilla.
--   2. Fecha de inscripción en cada inscripción (para calcular la matrícula de cada mes).
--   3. Función que arma todos los números de la planilla de un ciclo lectivo.
-- =====================================================================================

-- 1. TRAYECTOS ---------------------------------------------------------------------------
alter table public.trayectos add column if not exists horario_dias  jsonb;   -- {"L":"17:45 A 21:30","M":"...","X":"...","J":"...","V":"...","S":"..."}
alter table public.trayectos add column if not exists horas_catedra integer; -- si queda vacío se calcula: horas reloj x 1,5
alter table public.trayectos add column if not exists obs_planilla  text;    -- ej.: "Proviene de 2025"

-- 2. INSCRIPCIONES -----------------------------------------------------------------------
alter table public.inscripciones add column if not exists fecha_inscripcion date;
-- Las inscripciones que ya existen se toman como inscriptas desde el primer día de clases
update public.inscripciones i
   set fecha_inscripcion = coalesce(
         (select nullif(to_jsonb(t)->>'fecha_inicio', '')::date from public.trayectos t where t.id = i.trayecto_id),
         nullif(to_jsonb(i)->>'created_at', '')::timestamptz::date,
         current_date)
 where i.fecha_inscripcion is null;
alter table public.inscripciones alter column fecha_inscripcion set default current_date;

-- 3. MATRÍCULA A UNA FECHA ----------------------------------------------------------------
-- Estudiantes inscriptos a esa fecha y no dados de baja todavía, por género.
create or replace function public._matricula_en(p_trayecto bigint, p_fecha date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'v', count(*) filter (where d.genero = 'M'),
    'm', count(*) filter (where d.genero = 'F'),
    'x', count(*) filter (where d.genero = 'X'),
    's', count(*) filter (where d.genero is null))
    from public.inscripciones i
    left join public.datos_estudiante d on d.dni = i.estudiante_user
   where i.trayecto_id = p_trayecto
     and coalesce(i.fecha_inscripcion, p_fecha) <= p_fecha
     and (upper(coalesce(i.estado, 'ACTIVA')) <> 'BAJA'
          or coalesce(i.fecha_baja, i.fecha_inscripcion, p_fecha) > p_fecha);
$$;
revoke all on function public._matricula_en(bigint, date) from public, anon, authenticated;

-- 4. DATOS DE LA PLANILLA --------------------------------------------------------------------
-- Una entrada por trayecto del ciclo. Solo números y datos del curso (sin datos personales).
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

    -- Cantidad de inscriptos: los inscriptos hasta el primer día de clases (todos, aunque luego se hayan dado de baja)
    select jsonb_build_object(
             'v', count(*) filter (where d.genero = 'M'), 'm', count(*) filter (where d.genero = 'F'),
             'x', count(*) filter (where d.genero = 'X'), 's', count(*) filter (where d.genero is null))
      into inscr
      from public.inscripciones i
      left join public.datos_estudiante d on d.dni = i.estudiante_user
     where i.trayecto_id = t.id and (ini is null or coalesce(i.fecha_inscripcion, ini) <= ini);

    -- Matrícula de cada fin de mes (31/03 … 31/12)
    meses := '[]'::jsonb;
    for m in 3..12 loop
      d_ini := make_date(ciclo, m, 1);
      d_fin := (d_ini + interval '1 month' - interval '1 day')::date;
      if ini is null or ini > d_fin then
        meses := meses || jsonb_build_array(null);                        -- todavía no empezó
      else
        ref := least(d_fin, coalesce(fin, d_fin));
        if ref > hoy then
          meses := meses || jsonb_build_array(null);                      -- el mes todavía no cerró
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

-- Verificación (solo lectura): debe devolver 2 filas
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('planilla_matricula', '_matricula_en')
 order by 1;
