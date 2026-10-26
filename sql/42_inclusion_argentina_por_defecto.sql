-- =====================================================================================
-- PASO 42 — PAÍS DE ORIGEN: ARGENTINA POR DEFECTO (A CORROBORAR)
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS del paso 41 (reemplaza la función).
--
-- Quien no tiene país de origen cargado se cuenta como argentino, pero queda marcado como
-- "sin confirmar". Además se señalan "para revisar" los que no tienen país cargado y cuyo
-- LUGAR DE NACIMIENTO (Ficha de Curso) parece de otro país. Es solo una pista: esas personas
-- NO se cuentan como extranjeras hasta que se confirme en la ficha.
--
-- Mismo permiso que el paso 41 en Luján: public.es_personal() (Dirección + Preceptoría).
-- =====================================================================================

create or replace function public.relevamiento_inclusion(
  p_ciclo integer default null, p_solo_activos boolean default true
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  ciclo integer;
  res   jsonb;
  -- palabras (sin tildes, en minúscula) que sugieren un lugar de nacimiento fuera del país
  patron constant text :=
    '(^|[^a-z])(bolivia|boliviano|boliviana|brasil|brazil|brasilero|brasilera|chile|chileno|chilena|colombia|colombiano|colombiana|bogota|'
    || 'ecuador|ecuatoriano|ecuatoriana|quito|paraguay|paraguayo|paraguaya|asuncion|peru|peruano|peruana|uruguay|uruguayo|uruguaya|montevideo|'
    || 'venezuela|venezolano|venezolana|caracas|cuba|cubano|cubana|mexico|mexicano|mexicana|haiti|dominicana|nicaragua|honduras|guatemala|panama|'
    || 'costa rica|el salvador|espana|espanol|espanola|italia|italiano|italiana|francia|alemania|portugal|polonia|ucrania|rusia|china|japon|corea|'
    || 'senegal|nigeria|africa|europa|asia)([^a-z]|$)';
begin
  if not public.es_personal() then
    raise exception 'No autorizado';
  end if;
  ciclo := coalesce(p_ciclo, extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::integer);

  with personas as (
    select distinct i.estudiante_user as dni
      from public.inscripciones i
      join public.trayectos tr on tr.id = i.trayecto_id
     where nullif(to_jsonb(tr)->>'ciclo_lectivo', '')::integer = ciclo
       and ((not p_solo_activos) or upper(coalesce(i.estado, 'ACTIVA')) <> 'BAJA')
  ), x as (
    select p.dni, d.pais_origen, d.discapacidad, d.con_cud, d.apoyo,
           e.lugar_nacimiento,
           lower(translate(coalesce(e.lugar_nacimiento, ''), 'áéíóúüÁÉÍÓÚÜñÑ', 'aeiouuAEIOUUnN')) as lugar_norm
      from personas p
      left join public.datos_inclusion d on d.dni = p.dni
      left join public.datos_estudiante e on e.dni = p.dni
  ), revisar as (
    select x.dni, x.lugar_nacimiento,
           coalesce(nullif(upper(trim(coalesce(pf.apellido, ''))) || ', ' || trim(coalesce(pf.nombre, '')), ', '), 'DNI ' || x.dni) as nombre
      from x
      left join public.profiles pf on pf.dni = x.dni
     where x.pais_origen is null
       and x.lugar_norm ~ patron
       and x.lugar_norm !~ 'argentina'
  )
  select jsonb_build_object(
    'personas', (select count(*) from x),
    'extranjeros', jsonb_build_object(
      'paises', coalesce((select jsonb_object_agg(pais_origen, n) from (
                  select pais_origen, count(*)::integer as n from x
                   where pais_origen is not null and pais_origen <> 'Argentina' group by pais_origen) q), '{}'::jsonb),
      'argentinos', (select count(*) from x where pais_origen = 'Argentina'),
      'sin_dato', (select count(*) from x where pais_origen is null),           -- se toman como argentinos (sin confirmar)
      'revisar', (select count(*) from revisar),
      'revisar_lista', coalesce((select jsonb_agg(jsonb_build_object('dni', dni, 'nombre', nombre, 'lugar', lugar_nacimiento) order by nombre)
                                   from (select * from revisar order by nombre limit 60) r), '[]'::jsonb)),
    'discapacidad', jsonb_build_object(
      'total', (select count(*) from x where discapacidad is true),
      'apoyo_docente', (select count(*) from x where discapacidad is true and apoyo = 'docente'),
      'apoyo_no_docente', (select count(*) from x where discapacidad is true and apoyo = 'no_docente'),
      'sin_apoyo', (select count(*) from x where discapacidad is true and apoyo = 'sin_apoyo'),
      'apoyo_sin_dato', (select count(*) from x where discapacidad is true and apoyo is null),
      'con_cud', (select count(*) from x where discapacidad is true and con_cud is true),
      'sin_cud', (select count(*) from x where discapacidad is true and con_cud is false),
      'cud_sin_dato', (select count(*) from x where discapacidad is true and con_cud is null),
      'sin_dato', (select count(*) from x where discapacidad is null))
  ) into res;

  return res;
end $$;

revoke all on function public.relevamiento_inclusion(integer, boolean) from public, anon;
grant execute on function public.relevamiento_inclusion(integer, boolean) to authenticated;

-- Verificación: debe devolver 1 fila
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = 'relevamiento_inclusion';
