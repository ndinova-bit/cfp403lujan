-- =====================================================================================
-- 08 · CERTIFICADOS
--   1. Horas del Catálogo en cada trayecto (van en el frente del certificado).
--   2. Fecha de entrega del certificado (frente) guardada junto al acta del trayecto.
--   3. Registro de certificados emitidos (quién, cuándo, a quién).
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede volver a ejecutar sin romper nada.
-- =====================================================================================

alter table public.trayectos     add column if not exists horas integer check (horas is null or horas between 1 and 5000);
alter table public.actas_examen  add column if not exists fecha_entrega date;

create table if not exists public.certificados_emitidos (
  id              bigint generated always as identity primary key,
  inscripcion_id  text,
  trayecto_id     bigint references public.trayectos(id) on delete set null,
  estudiante_user text not null,
  num_egresado    text,
  fecha_egreso    date,
  fecha_entrega   date,
  emitido_por     uuid default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists certificados_emitidos_tray_idx on public.certificados_emitidos (trayecto_id);

alter table public.certificados_emitidos enable row level security;
drop policy if exists certemit_select on public.certificados_emitidos;
drop policy if exists certemit_insert on public.certificados_emitidos;
create policy certemit_select on public.certificados_emitidos for select to authenticated using (public.es_admin());
create policy certemit_insert on public.certificados_emitidos for insert to authenticated with check (public.es_admin());
grant select, insert on public.certificados_emitidos to authenticated;

drop trigger if exists trg_auditoria on public.certificados_emitidos;
create trigger trg_auditoria after insert or update or delete on public.certificados_emitidos
  for each row execute function public.registrar_auditoria();

-- Comprobación: 3 filas con 1
select 'trayectos.horas' as objeto, count(*) from information_schema.columns where table_schema='public' and table_name='trayectos' and column_name='horas'
union all
select 'actas_examen.fecha_entrega', count(*) from information_schema.columns where table_schema='public' and table_name='actas_examen' and column_name='fecha_entrega'
union all
select 'certificados_emitidos', count(*) from information_schema.tables where table_schema='public' and table_name='certificados_emitidos';
