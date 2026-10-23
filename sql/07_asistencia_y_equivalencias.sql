-- =====================================================================================
-- 07 · ASISTENCIA Y EQUIVALENCIAS
--   1. Trayectos que NO computan asistencia (por ejemplo, virtuales).
--   2. Estado "tarde" en asistencia (cuenta como presente).
--   3. Guardado seguro de asistencia: por fecha + módulo, todo o nada (no pisa otros módulos).
--   4. Módulos acreditados por equivalencia (ej.: técnico electromecánico que no cursa
--      "Circuitos eléctricos y mediciones").
--   5. Datos del acta de examen (fecha y comisión examinadora) por trayecto.
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede volver a ejecutar sin romper nada.
-- =====================================================================================

-- 1. Trayectos que no computan asistencia -------------------------------------------------
alter table public.trayectos add column if not exists computa_asistencia boolean not null default true;

-- 2. Estado "tarde": se reemplaza cualquier restricción vieja sobre "estado" ----------------
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.asistencias'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%estado%'
  loop
    execute format('alter table public.asistencias drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.asistencias
  add constraint asistencias_estado_check
  check (lower(estado) in ('presente','tarde','ausente','justificado')) not valid;
-- (not valid = se controla en las cargas nuevas, sin rechazar datos viejos)

-- 3. Guardado seguro de asistencia --------------------------------------------------------
-- Borra y vuelve a escribir SOLO la fecha + módulo indicados, en una sola operación.
-- Corre con los permisos de quien la llama (security invoker): el docente solo puede
-- tocar sus trayectos y el admin todos, igual que hoy.
create or replace function public.guardar_asistencia(
  p_trayecto bigint,
  p_modulo   bigint,
  p_fecha    date,
  p_registros jsonb          -- [{ "estudiante_user": "12345678", "estado": "presente" }, ...]
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare n integer;
begin
  if not (public.es_admin() or public.es_docente_de(p_trayecto)) then
    raise exception 'No tenés permiso para cargar asistencia en este trayecto';
  end if;

  delete from public.asistencias
   where trayecto_id = p_trayecto
     and fecha = p_fecha
     and modulo_id is not distinct from p_modulo;

  insert into public.asistencias (trayecto_id, modulo_id, estudiante_user, fecha, estado)
  select p_trayecto, p_modulo, r->>'estudiante_user', p_fecha, lower(r->>'estado')
  from jsonb_array_elements(p_registros) r
  where coalesce(r->>'estudiante_user', '') <> '';

  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.guardar_asistencia(bigint, bigint, date, jsonb) from public, anon;
grant execute on function public.guardar_asistencia(bigint, bigint, date, jsonb) to authenticated;

-- 4. Módulos acreditados por equivalencia ---------------------------------------------------
create table if not exists public.modulos_acreditados (
  id              bigint generated always as identity primary key,
  trayecto_id     bigint not null references public.trayectos(id) on delete cascade,
  modulo_id       bigint not null references public.modulos(id) on delete cascade,
  estudiante_user text   not null,
  motivo          text   check (char_length(motivo) <= 300),
  creado_por      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  unique (modulo_id, estudiante_user)
);
create index if not exists modulos_acreditados_tray_idx on public.modulos_acreditados (trayecto_id);

alter table public.modulos_acreditados enable row level security;

drop policy if exists acreditados_select on public.modulos_acreditados;
drop policy if exists acreditados_insert on public.modulos_acreditados;
drop policy if exists acreditados_update on public.modulos_acreditados;
drop policy if exists acreditados_delete on public.modulos_acreditados;

-- Lo ven: administración, el docente del trayecto y el propio estudiante
create policy acreditados_select on public.modulos_acreditados for select to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id) or estudiante_user = public.mi_dni());
-- Lo decide solo la administración (Dirección)
create policy acreditados_insert on public.modulos_acreditados for insert to authenticated
  with check (public.es_admin());
create policy acreditados_update on public.modulos_acreditados for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy acreditados_delete on public.modulos_acreditados for delete to authenticated
  using (public.es_admin());

grant select, insert, update, delete on public.modulos_acreditados to authenticated;

drop trigger if exists trg_auditoria on public.modulos_acreditados;
create trigger trg_auditoria after insert or update or delete on public.modulos_acreditados
  for each row execute function public.registrar_auditoria();

-- 5. Datos del acta de examen por trayecto ---------------------------------------------------
create table if not exists public.actas_examen (
  id            bigint generated always as identity primary key,
  trayecto_id   bigint not null unique references public.trayectos(id) on delete cascade,
  fecha_examen  date,
  presidente    text check (char_length(presidente) <= 120),
  vocal         text check (char_length(vocal) <= 120),
  director      text check (char_length(director) <= 120),
  inspector     text check (char_length(inspector) <= 120),
  ajustes       jsonb not null default '{}'::jsonb,   -- correcciones manuales de la vista previa
  actualizado   timestamptz not null default now()
);

alter table public.actas_examen enable row level security;
drop policy if exists actas_select on public.actas_examen;
drop policy if exists actas_write on public.actas_examen;
create policy actas_select on public.actas_examen for select to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id));
create policy actas_write on public.actas_examen for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
grant select, insert, update, delete on public.actas_examen to authenticated;

drop trigger if exists trg_auditoria on public.actas_examen;
create trigger trg_auditoria after insert or update or delete on public.actas_examen
  for each row execute function public.registrar_auditoria();

-- Comprobación final: debe listar las 3 cosas nuevas sin errores
select 'trayectos.computa_asistencia' as objeto, count(*) from information_schema.columns
 where table_schema='public' and table_name='trayectos' and column_name='computa_asistencia'
union all
select 'modulos_acreditados', count(*) from information_schema.tables where table_schema='public' and table_name='modulos_acreditados'
union all
select 'actas_examen', count(*) from information_schema.tables where table_schema='public' and table_name='actas_examen';
