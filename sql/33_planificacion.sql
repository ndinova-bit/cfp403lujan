-- 33. Planificación del docente por trayecto (y por módulo, si el trayecto tiene módulos).
--   * La carga el docente del trayecto (o el administrador).
--   * Director y Regente la pueden ver (seguimiento pedagógico), no editarla.
--   Campos genéricos por ahora (fundamentación, objetivos, contenidos, metodología,
--   evaluación, bibliografía, cronograma); se pueden ajustar cuando haya un modelo definido.
create table if not exists public.planificaciones (
  id                bigint generated always as identity primary key,
  trayecto_id       bigint not null references public.trayectos(id) on delete cascade,
  modulo_id         bigint references public.modulos(id) on delete cascade,
  fundamentacion    text check (char_length(fundamentacion) <= 6000),
  objetivos         text check (char_length(objetivos) <= 6000),
  contenidos        text check (char_length(contenidos) <= 10000),
  metodologia       text check (char_length(metodologia) <= 6000),
  evaluacion        text check (char_length(evaluacion) <= 6000),
  bibliografia      text check (char_length(bibliografia) <= 4000),
  cronograma        text check (char_length(cronograma) <= 6000),
  actualizado_por   uuid,
  actualizado_por_nombre text,
  updated_at        timestamptz not null default now(),
  unique (trayecto_id, modulo_id)
);
create index if not exists planificaciones_tray_idx on public.planificaciones (trayecto_id);

alter table public.planificaciones enable row level security;

drop policy if exists planificaciones_select on public.planificaciones;
create policy planificaciones_select on public.planificaciones for select to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id));
drop policy if exists planificaciones_insert on public.planificaciones;
create policy planificaciones_insert on public.planificaciones for insert to authenticated
  with check (public.es_admin_total() or public.es_docente_de(trayecto_id));
drop policy if exists planificaciones_update on public.planificaciones;
create policy planificaciones_update on public.planificaciones for update to authenticated
  using (public.es_admin_total() or public.es_docente_de(trayecto_id))
  with check (public.es_admin_total() or public.es_docente_de(trayecto_id));
drop policy if exists planificaciones_delete on public.planificaciones;
create policy planificaciones_delete on public.planificaciones for delete to authenticated
  using (public.es_admin_total());

grant select, insert, update, delete on public.planificaciones to authenticated;

drop trigger if exists trg_auditoria on public.planificaciones;
create trigger trg_auditoria after insert or update or delete on public.planificaciones
  for each row execute function public.registrar_auditoria();
