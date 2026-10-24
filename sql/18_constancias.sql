-- =====================================================================================
-- PASO 18 — CONSTANCIAS (alumno regular / examen)
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir).
-- Pueden emitirlas: administración, regencia, preceptoría y secretaría.
-- =====================================================================================
create table if not exists public.constancias_emitidas (
  id              bigint generated always as identity primary key,
  tipo            text not null check (tipo in ('regular', 'examen')),
  estudiante_user text not null,
  trayecto_id     bigint references public.trayectos(id) on delete set null,
  fecha_examen    date,
  instancia       text,
  asignatura      text,
  emitido_por     uuid default auth.uid(),
  created_at      timestamptz not null default now()
);
alter table public.constancias_emitidas add column if not exists instancia text;
alter table public.constancias_emitidas add column if not exists asignatura text;
alter table public.constancias_emitidas enable row level security;
drop policy if exists constemit_select on public.constancias_emitidas;
create policy constemit_select on public.constancias_emitidas for select to authenticated using (public.es_personal() or public.es_secretaria());
grant select on public.constancias_emitidas to authenticated;   -- se escribe solo con registrar_constancia()

drop trigger if exists trg_auditoria on public.constancias_emitidas;
create trigger trg_auditoria after insert or update or delete on public.constancias_emitidas
  for each row execute function public.registrar_auditoria();

-- Búsqueda por DNI (desde el inicio) o por apellido/nombre (mínimo 3 caracteres)
drop function if exists public.buscar_para_constancia(text);
create or replace function public.buscar_para_constancia(p_texto text)
returns table (dni text, apellido text, nombre text, trayecto_id bigint, trayecto text, ciclo integer,
               resolucion text, estado text, fecha_baja date, horario_dias jsonb)
language plpgsql stable security definer set search_path = public as $$
declare q text := upper(trim(coalesce(p_texto, '')));
begin
  if not (public.es_personal() or public.es_secretaria()) then raise exception 'No autorizado'; end if;
  if length(q) < 3 then return; end if;
  return query
  select i.estudiante_user::text,
         upper(coalesce(nullif(trim(pa.apellido), ''), nullif(trim(pf.apellido), ''), '')),
         initcap(coalesce(nullif(trim(pa.nombre), ''), nullif(trim(pf.nombre), ''), '')),
         t.id, t.nombre::text, nullif(to_jsonb(t)->>'ciclo_lectivo', '')::integer,
         nullif(to_jsonb(t)->>'resolucion', ''),
         upper(coalesce(i.estado, 'ACTIVA'))::text, i.fecha_baja, t.horario_dias
    from public.inscripciones i
    join public.trayectos t on t.id = i.trayecto_id
    left join public.padron_estudiantes pa on pa.dni = i.estudiante_user
    left join public.profiles pf on pf.dni = i.estudiante_user
   where i.estudiante_user::text like q || '%'
      or upper(coalesce(pa.apellido, pf.apellido, '') || ' ' || coalesce(pa.nombre, pf.nombre, '')) like '%' || q || '%'
   order by 6 desc nulls last, 2, 3
   limit 60;
end $$;
revoke all on function public.buscar_para_constancia(text) from public, anon;
grant execute on function public.buscar_para_constancia(text) to authenticated;

-- Deja registro de cada constancia emitida
drop function if exists public.registrar_constancia(text, text, bigint, date);
create or replace function public.registrar_constancia(p_tipo text, p_dni text, p_trayecto bigint, p_fecha date default null, p_instancia text default null, p_asignatura text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.es_personal() or public.es_secretaria()) then raise exception 'No autorizado'; end if;
  insert into public.constancias_emitidas (tipo, estudiante_user, trayecto_id, fecha_examen, instancia, asignatura)
  values (p_tipo, p_dni, p_trayecto, p_fecha, left(p_instancia, 20), left(p_asignatura, 160));
end $$;
revoke all on function public.registrar_constancia(text, text, bigint, date, text, text) from public, anon;
grant execute on function public.registrar_constancia(text, text, bigint, date, text, text) to authenticated;

-- Verificación: debe devolver 3 filas
select proname from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('buscar_para_constancia', 'registrar_constancia')
union all
select tablename from pg_tables where schemaname = 'public' and tablename = 'constancias_emitidas';
