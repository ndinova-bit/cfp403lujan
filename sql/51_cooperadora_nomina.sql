-- =====================================================================================
-- PASO 51 — NÓMINA DE AUTORIDADES DE LA COMISIÓN DIRECTIVA (Cooperadora)
-- Réplica del formulario "Nómina y firma de la actual Comisión Directiva" (Dirección de
-- Cooperación y Participación Comunitaria): cabecera (año, distrito, escuela, asociación) y
-- 17 renglones (13 cargos libres + Rev. de Cuentas Doc./Tit./Sup. + Asesor).
--   · La ven y la descargan todos los usuarios con sesión iniciada.
--   · La cargan Director, Regente y Preceptores (es_personal), solo con guardar_nomina_coop().
-- =====================================================================================
create table if not exists public.cooperadora_nomina_datos (
  id              integer primary key default 1 check (id = 1),
  anio            integer,
  distrito        text,
  escuela         text,
  asociacion      text,
  actualizado     timestamptz not null default now(),
  actualizado_por uuid
);
insert into public.cooperadora_nomina_datos (id, anio, distrito, escuela)
values (1, extract(year from now())::integer, 'Luján', 'CFP N.º 403 "Oscar Smith"')
on conflict (id) do nothing;

create table if not exists public.cooperadora_nomina (
  id              bigint generated always as identity primary key,
  orden           integer not null,
  cargo           text,
  apellido_nombre text,
  documento       text,
  domicilio       text,
  localidad       text,
  vencimiento     text
);

alter table public.cooperadora_nomina_datos enable row level security;
alter table public.cooperadora_nomina enable row level security;
drop policy if exists coop_nomina_datos_select on public.cooperadora_nomina_datos;
drop policy if exists coop_nomina_select on public.cooperadora_nomina;
create policy coop_nomina_datos_select on public.cooperadora_nomina_datos for select to authenticated using (true);
create policy coop_nomina_select on public.cooperadora_nomina for select to authenticated using (true);
-- (sin políticas de escritura: se guarda solo con guardar_nomina_coop)

create or replace function public.guardar_nomina_coop(p_datos jsonb, p_filas jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare f jsonb; i integer := 0;
begin
  if not public.es_personal() then raise exception 'No autorizado'; end if;
  if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) > 40 then raise exception 'Datos inválidos'; end if;

  update public.cooperadora_nomina_datos set
    anio = nullif(p_datos->>'anio', '')::integer,
    distrito = left(nullif(trim(p_datos->>'distrito'), ''), 120),
    escuela = left(nullif(trim(p_datos->>'escuela'), ''), 160),
    asociacion = left(nullif(trim(p_datos->>'asociacion'), ''), 200),
    actualizado = now(), actualizado_por = auth.uid()
  where id = 1;

  delete from public.cooperadora_nomina where true;
  for f in select * from jsonb_array_elements(p_filas) loop
    i := i + 1;
    insert into public.cooperadora_nomina (orden, cargo, apellido_nombre, documento, domicilio, localidad, vencimiento)
    values (i,
      left(nullif(trim(f->>'cargo'), ''), 80), left(nullif(trim(f->>'apellido_nombre'), ''), 120),
      left(nullif(trim(f->>'documento'), ''), 30), left(nullif(trim(f->>'domicilio'), ''), 160),
      left(nullif(trim(f->>'localidad'), ''), 80), left(nullif(trim(f->>'vencimiento'), ''), 40));
  end loop;
end $$;
revoke all on function public.guardar_nomina_coop(jsonb, jsonb) from public, anon;
grant execute on function public.guardar_nomina_coop(jsonb, jsonb) to authenticated;
