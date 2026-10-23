-- =============================================================================
-- PASO 12 — INSTRUCTORES SUPLENTES Y AUDITORÍA MÁS LEGIBLE
--
-- 1. trayecto_docentes: suplentes de un trayecto (además del instructor titular).
--    Pueden tener fecha de inicio y de fin; fuera de ese período no tienen acceso.
--    Mientras dura la suplencia hacen lo mismo que el titular: clases, asistencia,
--    correcciones. El titular no pierde el acceso.
-- 2. es_docente_de / es_docente_de_alumno: tienen en cuenta a los suplentes.
-- 3. Auditoría: índices para filtrar rápido por persona y por rol.
--
-- Se puede ejecutar más de una vez.
-- =============================================================================

-- 1. SUPLENTES ------------------------------------------------------------------
create table if not exists public.trayecto_docentes (
  id           bigint generated always as identity primary key,
  trayecto_id  bigint not null references public.trayectos(id) on delete cascade,
  docente_user text not null,
  desde        date,
  hasta        date,
  motivo       text check (motivo is null or length(motivo) <= 200),
  created_at   timestamptz not null default now(),
  unique (trayecto_id, docente_user),
  check (hasta is null or desde is null or hasta >= desde)
);

-- ¿El usuario actual es suplente vigente de ese trayecto?
create or replace function public.es_suplente_de(tid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_docente() and exists (
    select 1 from public.trayecto_docentes s
     where s.trayecto_id = tid
       and s.docente_user = public.mi_dni()
       and (s.desde is null or s.desde <= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
       and (s.hasta is null or s.hasta >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
  );
$$;
revoke all on function public.es_suplente_de(bigint) from public, anon;
grant execute on function public.es_suplente_de(bigint) to authenticated;

-- 2. "Docente de este trayecto" = titular o suplente vigente
create or replace function public.es_docente_de(tid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_docente() and (
    exists (select 1 from public.trayectos t where t.id = tid and t.docente_user = public.mi_dni())
    or public.es_suplente_de(tid)
  );
$$;

create or replace function public.es_docente_de_alumno(p_dni text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_docente() and exists (
    select 1
      from public.inscripciones i
      join public.trayectos t on t.id = i.trayecto_id
     where i.estudiante_user = p_dni
       and (t.docente_user = public.mi_dni() or public.es_suplente_de(t.id))
  );
$$;

alter table public.trayecto_docentes enable row level security;
drop policy if exists suplentes_select on public.trayecto_docentes;
drop policy if exists suplentes_admin on public.trayecto_docentes;
create policy suplentes_select on public.trayecto_docentes for select to authenticated
  using (public.es_personal() or docente_user = public.mi_dni() or public.es_docente_de(trayecto_id));
create policy suplentes_admin on public.trayecto_docentes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
revoke all on public.trayecto_docentes from anon;

drop trigger if exists trg_auditoria on public.trayecto_docentes;
create trigger trg_auditoria after insert or update or delete on public.trayecto_docentes
  for each row execute function public.registrar_auditoria();

-- 3. AUDITORÍA: búsquedas por persona y por rol ------------------------------------
create index if not exists auditoria_usuario_idx on public.auditoria (usuario_dni, fecha desc);
create index if not exists auditoria_rol_idx on public.auditoria (usuario_rol, fecha desc);

-- Control: tiene que aparecer la tabla nueva
select count(*) as suplentes_cargados from public.trayecto_docentes;
