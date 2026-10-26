-- =====================================================================================
-- PASO 41 — PAÍS DE ORIGEN Y DISCAPACIDAD (cuadros 1.2 y 1.3 del Relevamiento Anual)
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- Los datos se guardan en una tabla APARTE de la Ficha de Curso, porque la discapacidad es un
-- dato sensible. En Luján lo ven y lo cargan Dirección y Preceptoría (public.es_personal()):
-- el mismo grupo que ya edita los datos personales de la Ficha de Curso (datos_estudiante).
-- Secretaría NO tiene acceso (en Luján es_admin() no la incluye, a diferencia de Giles).
-- Docentes y estudiantes no los leen. El panel de Matrícula escolar muestra únicamente totales.
-- =====================================================================================

create table if not exists public.datos_inclusion (
  dni              text primary key,
  pais_origen      text check (pais_origen is null or pais_origen in (
                     'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Ecuador', 'Paraguay', 'Perú',
                     'Uruguay', 'Venezuela', 'Otros países de América', 'Europa', 'Asia', 'África', 'Oceanía')),
  discapacidad     boolean,                                   -- null = sin dato
  con_cud          boolean,                                   -- Certificado Único de Discapacidad
  apoyo            text check (apoyo is null or apoyo in ('docente', 'no_docente', 'sin_apoyo')),
  actualizado      timestamptz not null default now(),
  actualizado_por  uuid default auth.uid()
);

alter table public.datos_inclusion enable row level security;

drop policy if exists datos_inclusion_select on public.datos_inclusion;
drop policy if exists datos_inclusion_insert on public.datos_inclusion;
drop policy if exists datos_inclusion_update on public.datos_inclusion;
drop policy if exists datos_inclusion_delete on public.datos_inclusion;
create policy datos_inclusion_select on public.datos_inclusion for select to authenticated using (public.es_personal());
create policy datos_inclusion_insert on public.datos_inclusion for insert to authenticated with check (public.es_personal());
create policy datos_inclusion_update on public.datos_inclusion for update to authenticated using (public.es_personal()) with check (public.es_personal());
create policy datos_inclusion_delete on public.datos_inclusion for delete to authenticated using (public.es_personal());

-- Totales para los cuadros 1.2 (extranjeros por país/continente) y 1.3 (discapacidad).
-- Cuenta personas (no inscripciones) de los trayectos del ciclo. Solo números.
create or replace function public.relevamiento_inclusion(
  p_ciclo integer default null, p_solo_activos boolean default true
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  ciclo integer;
  res   jsonb;
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
    select p.dni, d.pais_origen, d.discapacidad, d.con_cud, d.apoyo
      from personas p left join public.datos_inclusion d on d.dni = p.dni
  )
  select jsonb_build_object(
    'personas', (select count(*) from x),
    'extranjeros', jsonb_build_object(
      'paises', coalesce((select jsonb_object_agg(pais_origen, n) from (
                  select pais_origen, count(*)::integer as n from x
                   where pais_origen is not null and pais_origen <> 'Argentina' group by pais_origen) q), '{}'::jsonb),
      'argentinos', (select count(*) from x where pais_origen = 'Argentina'),
      'sin_dato', (select count(*) from x where pais_origen is null)),
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

-- Verificación: tienen que aparecer la tabla y la función
select 'tabla' as tipo, tablename::text as nombre from pg_tables where tablename = 'datos_inclusion'
union all
select 'función', proname::text from pg_proc where proname = 'relevamiento_inclusion';
