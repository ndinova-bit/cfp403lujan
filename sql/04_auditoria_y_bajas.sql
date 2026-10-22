-- =============================================================================
-- PASO 4 — Auditoría de cambios + estado "INHABILITADO"
-- Dónde: Supabase > SQL Editor > New query > pegar TODO > Run
--
-- Qué hace:
--   1. Crea la tabla `auditoria`: guarda QUIÉN cambió QUÉ y CUÁNDO (altas, cambios
--      y bajas) en perfiles/roles, inscripciones, entregas y notas, asistencias,
--      clases, trayectos y módulos. Los datos anteriores quedan guardados, así
--      que una nota o un rol modificado/borrado siempre se puede recuperar.
--   2. Solo el administrador puede leerla. Nadie puede modificarla ni borrarla
--      desde la plataforma.
--   3. Permite el estado INHABILITADO en profiles (baja lógica: la persona no
--      entra, pero conserva su historial).
-- Se puede ejecutar más de una vez.
-- =============================================================================

-- 1. Tabla -------------------------------------------------------------------
create table if not exists public.auditoria (
  id               bigint generated always as identity primary key,
  fecha            timestamptz not null default now(),
  usuario_id       uuid,
  usuario_dni      text,
  usuario_rol      text,
  tabla            text not null,
  operacion        text not null,      -- INSERT / UPDATE / DELETE
  registro_id      text,
  datos_anteriores jsonb,
  datos_nuevos     jsonb
);

create index if not exists auditoria_fecha_idx on public.auditoria (fecha desc);
create index if not exists auditoria_tabla_idx on public.auditoria (tabla, fecha desc);

alter table public.auditoria enable row level security;

drop policy if exists auditoria_leer_admin on public.auditoria;
create policy auditoria_leer_admin on public.auditoria
  for select to authenticated
  using (public.es_admin());

-- Nadie escribe ni borra directamente: solo lo hace el disparador (SECURITY DEFINER)
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

-- 2. Función disparadora -----------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_dni   text;
  v_rol   text;
  v_ant   jsonb;
  v_nue   jsonb;
  v_id    text;
begin
  if v_uid is not null then
    select p.dni, p.rol::text into v_dni, v_rol from public.profiles p where p.id = v_uid;
  else
    v_dni := 'sistema';   -- funciones del servidor o SQL Editor
  end if;

  if tg_op = 'INSERT' then
    v_nue := to_jsonb(new);
    v_id  := v_nue->>'id';
  elsif tg_op = 'DELETE' then
    v_ant := to_jsonb(old);
    v_id  := v_ant->>'id';
  else
    -- UPDATE: solo se guardan los campos que cambiaron
    select jsonb_object_agg(n.key, n.value) into v_nue
      from jsonb_each(to_jsonb(new)) n
     where to_jsonb(old)->n.key is distinct from n.value;
    if v_nue is null then
      return new;   -- no cambió nada
    end if;
    select jsonb_object_agg(o.key, o.value) into v_ant
      from jsonb_each(to_jsonb(old)) o
     where o.key in (select jsonb_object_keys(v_nue));
    v_id := to_jsonb(new)->>'id';
  end if;

  insert into public.auditoria (usuario_id, usuario_dni, usuario_rol, tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
  values (v_uid, v_dni, v_rol, tg_table_name, tg_op, v_id, v_ant, v_nue);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.registrar_auditoria() from public, anon, authenticated;

-- 3. Conectar el disparador a las tablas que existan --------------------------
do $$
declare
  t text;
  conectadas text[] := '{}';
  omitidas   text[] := '{}';
begin
  foreach t in array array[
    'profiles','inscripciones','entregas_actividades','asistencias',
    'clases','trayectos','modulos','excepciones_modulos'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_auditoria on public.%I', t);
      execute format('create trigger trg_auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
      conectadas := conectadas || t;
    else
      omitidas := omitidas || t;
    end if;
  end loop;
  raise notice 'Auditoría conectada en: %', conectadas;
  raise notice 'Tablas que no existen (ignoradas): %', omitidas;
end $$;

-- 4. Baja lógica: permitir estado INHABILITADO -------------------------------
-- Si profiles tiene una restricción (CHECK) que limita los valores de "estado", se reemplaza.
do $$
declare r record;
begin
  for r in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.profiles'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%estado%'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_estado_check
  check (upper(estado::text) in ('ACTIVO','PENDIENTE','INHABILITADO'));

-- 5. Vista legible para consultar desde el SQL Editor o la plataforma --------
create or replace view public.auditoria_legible
with (security_invoker = true) as
select a.id, a.fecha at time zone 'America/Argentina/Buenos_Aires' as fecha_local,
       coalesce(a.usuario_dni, '—') as hecho_por_dni, a.usuario_rol as hecho_por_rol,
       a.tabla, a.operacion, a.registro_id, a.datos_anteriores, a.datos_nuevos
  from public.auditoria a
 order by a.fecha desc;

-- Verificación: tiene que listar las tablas con su disparador
select event_object_table as tabla, count(*) as disparadores
from information_schema.triggers
where trigger_name = 'trg_auditoria'
group by 1 order by 1;
