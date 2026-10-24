-- =====================================================================================
-- PASO 20 — SEDES Y SUBSEDES
-- Ejecutar UNA vez en Supabase → SQL Editor (se puede repetir).
--   • Lista de sedes/subsedes (nombre + dirección) que administran dirección y regencia.
--   • Cada trayecto puede elegir una; la planilla de matrícula escribe «Subsede Nombre - Dirección».
--   • Si se cambia la dirección en la lista, se actualiza en todos los trayectos que la usan.
-- =====================================================================================
create table if not exists public.sedes (
  id         bigint generated always as identity primary key,
  tipo       text not null default 'subsede' check (tipo in ('sede', 'subsede')),
  nombre     text not null,
  direccion  text not null,
  created_at timestamptz not null default now()
);
alter table public.sedes enable row level security;
drop policy if exists sedes_select on public.sedes;
drop policy if exists sedes_insert on public.sedes;
drop policy if exists sedes_update on public.sedes;
drop policy if exists sedes_delete on public.sedes;
create policy sedes_select on public.sedes for select to authenticated using (true);
create policy sedes_insert on public.sedes for insert to authenticated with check (public.es_admin());
create policy sedes_update on public.sedes for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy sedes_delete on public.sedes for delete to authenticated using (public.es_admin());
grant select, insert, update, delete on public.sedes to authenticated;

drop trigger if exists trg_auditoria on public.sedes;
create trigger trg_auditoria after insert or update or delete on public.sedes
  for each row execute function public.registrar_auditoria();

-- La sede principal (solo si todavía no hay ninguna)
insert into public.sedes (tipo, nombre, direccion)
select 'sede', 'CFP N.º 403', 'LAVALLE 740' where not exists (select 1 from public.sedes);

alter table public.trayectos add column if not exists sede_id bigint references public.sedes(id) on delete set null;

-- Mantiene al día los datos que ya usan la planilla y el panel (sede / lugar_dictado)
create or replace function public.sincronizar_sede_trayecto()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare s record;
begin
  if new.sede_id is not null then
    select * into s from public.sedes where id = new.sede_id;
    if found then
      new.sede := case when s.tipo = 'subsede' then 'fuera' else 'sede' end;
      new.lugar_dictado := case when s.tipo = 'subsede' then 'Subsede ' || s.nombre || ' - ' || s.direccion else s.direccion end;
    end if;
  end if;
  return new;
end $fn$;
drop trigger if exists trg_sincronizar_sede on public.trayectos;
create trigger trg_sincronizar_sede before insert or update on public.trayectos
  for each row execute function public.sincronizar_sede_trayecto();

create or replace function public.propagar_cambio_sede()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  update public.trayectos set sede_id = sede_id where sede_id = new.id;
  return new;
end $fn$;
drop trigger if exists trg_propagar_sede on public.sedes;
create trigger trg_propagar_sede after update on public.sedes
  for each row execute function public.propagar_cambio_sede();

-- Verificación: debe devolver 4 filas
select 'tabla sedes' from pg_tables where schemaname = 'public' and tablename = 'sedes'
union all select 'columna sede_id' from information_schema.columns where table_schema = 'public' and table_name = 'trayectos' and column_name = 'sede_id'
union all select tgname from pg_trigger where tgname in ('trg_sincronizar_sede', 'trg_propagar_sede');
