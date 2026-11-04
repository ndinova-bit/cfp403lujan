-- =====================================================================================
-- PASO 57 — PERÍODOS DE CALIFICACIÓN ANUAL DOCENTE Y TOTAL OFICIAL DE DÍAS DE ASISTENCIA
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir sin romper nada).
--
-- Cada año la DGCYE fija (Pautas de Orientación para la Calificación Anual Docente) las
-- fechas de cada período y el total de días de asistencia. Se cargan acá, por año:
--   · ciclo lectivo                     → ciclo_lectivo_config (+ dias_oficiales)
--   · calificación docentes con continuidad / titulares interinos → periodos_calificacion
-- Solo Director, Regente y Secretaría (mismo permiso que sql/56).
-- =====================================================================================
alter table public.ciclo_lectivo_config add column if not exists dias_oficiales integer
  check (dias_oficiales is null or dias_oficiales between 0 and 366);

create table if not exists public.periodos_calificacion (
  anio           integer not null,
  tipo           text    not null check (tipo in ('continuidad', 'interinos')),
  desde          date    not null,
  hasta          date    not null,
  dias_oficiales integer check (dias_oficiales is null or dias_oficiales between 0 and 366),
  updated_at     timestamptz not null default now(),
  primary key (anio, tipo),
  constraint periodos_rango_check check (hasta >= desde)
);

alter table public.periodos_calificacion enable row level security;
drop policy if exists periodos_select on public.periodos_calificacion;
drop policy if exists periodos_insert on public.periodos_calificacion;
drop policy if exists periodos_update on public.periodos_calificacion;
drop policy if exists periodos_delete on public.periodos_calificacion;
create policy periodos_select on public.periodos_calificacion for select to authenticated using (public.puede_gestionar_licencias());
create policy periodos_insert on public.periodos_calificacion for insert to authenticated with check (public.puede_gestionar_licencias());
create policy periodos_update on public.periodos_calificacion for update to authenticated
  using (public.puede_gestionar_licencias()) with check (public.puede_gestionar_licencias());
create policy periodos_delete on public.periodos_calificacion for delete to authenticated using (public.puede_gestionar_licencias());
