-- =====================================================================================
-- 09 · PRECEPTORES, FICHA DE CURSO, OBSERVACIONES Y BAJAS
--   1. Rol "preceptor": ve todos los trayectos y alumnos, toma asistencia en cualquier
--      trayecto, carga alumnos (importador), ve fichas y seguimiento, carga observaciones
--      y puede dar de baja en trayectos sin módulos. NO corrige notas, NO cambia roles,
--      NO emite certificados ni actas.
--   2. Datos personales del estudiante (los de la Ficha de Curso).
--   3. Observaciones del estudiante (salud, módulos aprobados en otros trayectos, etc.).
--   4. Datos de la Ficha de Curso en el trayecto (sede o fuera de sede, fechas, horario…).
--   5. Bajas de inscripción (manuales; las automáticas las calcula la plataforma).
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede volver a ejecutar sin romper nada.
-- =====================================================================================

-- 1. ROL PRECEPTOR -------------------------------------------------------------------
-- Si "rol" tiene una lista cerrada de valores (CHECK), se agrega 'preceptor'.
do $$
declare c record; tipo text;
begin
  select data_type into tipo from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name = 'rol';
  if tipo = 'USER-DEFINED' then
    -- rol es un tipo enumerado
    execute (select format('alter type %I.%I add value if not exists %L', n.nspname, t.typname, 'preceptor')
               from pg_type t join pg_namespace n on n.oid = t.typnamespace
              where t.typname = (select udt_name from information_schema.columns
                                  where table_schema='public' and table_name='profiles' and column_name='rol'));
  end if;
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as def
      from pg_constraint con
     where con.conrelid = 'public.profiles'::regclass and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%rol%' and pg_get_constraintdef(con.oid) ilike '%docente%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
    execute 'alter table public.profiles add constraint profiles_rol_check
             check (lower(rol::text) in (''admin'',''administrador'',''docente'',''estudiante'',''preceptor''))';
  end loop;
end $$;

create or replace function public.es_preceptor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol::text) = 'preceptor'
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  );
$$;
revoke all on function public.es_preceptor() from public, anon;
grant execute on function public.es_preceptor() to authenticated;

-- "Personal": administración o preceptoría
create or replace function public.es_personal()
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.es_preceptor();
$$;
revoke all on function public.es_personal() from public, anon;
grant execute on function public.es_personal() to authenticated;

-- El preceptor ve todos los trayectos (incluso de otros ciclos)
create or replace function public.puede_ver_trayecto(tid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.es_preceptor() or public.es_docente_de(tid) or public.esta_inscripto(tid);
$$;

-- Políticas que se amplían para el preceptor (se reemplazan por nombre)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.es_personal() or public.es_docente_de_alumno(dni));

drop policy if exists padron_select on public.padron_estudiantes;
create policy padron_select on public.padron_estudiantes for select to authenticated
  using (public.es_personal() or public.es_docente_de_alumno(dni));

drop policy if exists inscripciones_select on public.inscripciones;
create policy inscripciones_select on public.inscripciones for select to authenticated
  using (public.es_personal() or estudiante_user = public.mi_dni() or public.es_docente_de(trayecto_id));

-- Bajas: el preceptor y el docente del trayecto pueden modificar la inscripción
-- (la plataforma solo les deja cambiar el estado de baja; el N.º de egresado lo maneja la dirección)
drop policy if exists inscripciones_update on public.inscripciones;
create policy inscripciones_update on public.inscripciones for update to authenticated
  using (public.es_personal() or public.es_docente_de(trayecto_id))
  with check (public.es_personal() or public.es_docente_de(trayecto_id));

drop policy if exists clases_select on public.clases;
create policy clases_select on public.clases for select to authenticated
  using (
    public.es_personal()
    or public.es_docente_de(trayecto_id)
    or (public.esta_inscripto(trayecto_id) and (estudiante_user is null or estudiante_user = public.mi_dni()))
  );

drop policy if exists entregas_select on public.entregas_actividades;
create policy entregas_select on public.entregas_actividades for select to authenticated
  using (public.es_personal() or estudiante_user = public.mi_dni() or public.es_docente_de(public.trayecto_de_clase(clase_id)));

drop policy if exists asistencias_select on public.asistencias;
drop policy if exists asistencias_insert on public.asistencias;
drop policy if exists asistencias_update on public.asistencias;
drop policy if exists asistencias_delete on public.asistencias;
create policy asistencias_select on public.asistencias for select to authenticated
  using (public.es_personal() or public.es_docente_de(trayecto_id) or estudiante_user = public.mi_dni());
create policy asistencias_insert on public.asistencias for insert to authenticated
  with check (public.es_personal() or public.es_docente_de(trayecto_id));
create policy asistencias_update on public.asistencias for update to authenticated
  using (public.es_personal() or public.es_docente_de(trayecto_id))
  with check (public.es_personal() or public.es_docente_de(trayecto_id));
create policy asistencias_delete on public.asistencias for delete to authenticated
  using (public.es_personal() or public.es_docente_de(trayecto_id));

drop policy if exists excepciones_select on public.excepciones_estudiantes;
create policy excepciones_select on public.excepciones_estudiantes for select to authenticated
  using (public.es_personal() or public.es_docente_de(trayecto_id) or estudiante_user = public.mi_dni());

do $$ begin
  if to_regclass('public.modulos_acreditados') is not null then
    execute 'drop policy if exists acreditados_select on public.modulos_acreditados';
    execute 'create policy acreditados_select on public.modulos_acreditados for select to authenticated
             using (public.es_personal() or public.es_docente_de(trayecto_id) or estudiante_user = public.mi_dni())';
  end if;
end $$;

-- Asistencia: el preceptor también puede usar el guardado seguro
create or replace function public.guardar_asistencia(
  p_trayecto bigint, p_modulo bigint, p_fecha date, p_registros jsonb
) returns integer
language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  if not (public.es_admin() or public.es_preceptor() or public.es_docente_de(p_trayecto)) then
    raise exception 'No tenés permiso para cargar asistencia en este trayecto';
  end if;
  delete from public.asistencias
   where trayecto_id = p_trayecto and fecha = p_fecha and modulo_id is not distinct from p_modulo;
  insert into public.asistencias (trayecto_id, modulo_id, estudiante_user, fecha, estado)
  select p_trayecto, p_modulo, r->>'estudiante_user', p_fecha, lower(r->>'estado')
    from jsonb_array_elements(p_registros) r
   where coalesce(r->>'estudiante_user', '') <> '';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.guardar_asistencia(bigint, bigint, date, jsonb) from public, anon;
grant execute on function public.guardar_asistencia(bigint, bigint, date, jsonb) to authenticated;

-- 2. DATOS PERSONALES DEL ESTUDIANTE (Ficha de Curso) ----------------------------------
create table if not exists public.datos_estudiante (
  dni                text primary key,
  tipo_documento     text default 'DNI' check (char_length(tipo_documento) <= 10),
  fecha_nacimiento   date,
  lugar_nacimiento   text check (char_length(lugar_nacimiento) <= 120),
  domicilio          text check (char_length(domicilio) <= 160),
  localidad          text check (char_length(localidad) <= 80),
  codigo_postal      text check (char_length(codigo_postal) <= 12),
  telefono           text check (char_length(telefono) <= 40),
  estudios           text check (char_length(estudios) <= 120),
  actualizado        timestamptz not null default now(),
  actualizado_por    uuid default auth.uid()
);
alter table public.datos_estudiante enable row level security;
drop policy if exists datos_est_select on public.datos_estudiante;
drop policy if exists datos_est_write on public.datos_estudiante;
-- Los ven: la administración, preceptoría, el docente de sus alumnos y el propio estudiante
create policy datos_est_select on public.datos_estudiante for select to authenticated
  using (public.es_personal() or public.es_docente_de_alumno(dni) or dni = public.mi_dni());
-- Los cargan y corrigen: administración y preceptoría
create policy datos_est_write on public.datos_estudiante for all to authenticated
  using (public.es_personal()) with check (public.es_personal());
grant select, insert, update, delete on public.datos_estudiante to authenticated;
drop trigger if exists trg_auditoria on public.datos_estudiante;
create trigger trg_auditoria after insert or update or delete on public.datos_estudiante
  for each row execute function public.registrar_auditoria();

-- 3. OBSERVACIONES DEL ESTUDIANTE ------------------------------------------------------
create table if not exists public.observaciones_estudiante (
  id               bigint generated always as identity primary key,
  estudiante_user  text not null,
  trayecto_id      bigint references public.trayectos(id) on delete set null,
  tipo             text not null default 'general'
                   check (tipo in ('general','salud','modulos_previos','documentacion','asistencia','convivencia')),
  texto            text not null check (char_length(texto) between 2 and 2000),
  visible_docente  boolean not null default false,
  creado_por       uuid default auth.uid(),
  creado_por_nombre text,
  created_at       timestamptz not null default now()
);
create index if not exists observaciones_est_idx on public.observaciones_estudiante (estudiante_user);
alter table public.observaciones_estudiante enable row level security;
drop policy if exists obs_select on public.observaciones_estudiante;
drop policy if exists obs_insert on public.observaciones_estudiante;
drop policy if exists obs_update on public.observaciones_estudiante;
drop policy if exists obs_delete on public.observaciones_estudiante;
-- Administración y preceptoría ven todas. El docente ve solo las marcadas "visible para el docente"
-- de sus alumnos (nunca las de salud).
create policy obs_select on public.observaciones_estudiante for select to authenticated
  using (public.es_personal()
         or (visible_docente and tipo <> 'salud' and public.es_docente_de_alumno(estudiante_user)));
create policy obs_insert on public.observaciones_estudiante for insert to authenticated
  with check (public.es_personal());
create policy obs_update on public.observaciones_estudiante for update to authenticated
  using (public.es_admin() or (public.es_preceptor() and creado_por = auth.uid()))
  with check (public.es_personal());
create policy obs_delete on public.observaciones_estudiante for delete to authenticated
  using (public.es_admin() or (public.es_preceptor() and creado_por = auth.uid()));
grant select, insert, update, delete on public.observaciones_estudiante to authenticated;
drop trigger if exists trg_auditoria on public.observaciones_estudiante;
create trigger trg_auditoria after insert or update or delete on public.observaciones_estudiante
  for each row execute function public.registrar_auditoria();

-- 4. DATOS DE LA FICHA DE CURSO EN EL TRAYECTO -------------------------------------------
alter table public.trayectos add column if not exists sede                text default 'sede';   -- 'sede' | 'fuera'
alter table public.trayectos add column if not exists lugar_dictado       text;                   -- dirección o institución si es fuera de sede
alter table public.trayectos add column if not exists localidad           text default 'Luján';
alter table public.trayectos add column if not exists fecha_inicio        date;
alter table public.trayectos add column if not exists fecha_cierre        date;
alter table public.trayectos add column if not exists horario             text;
alter table public.trayectos add column if not exists tipo_certificacion  text;                   -- ej.: Nivel II de FP inicial
alter table public.trayectos add column if not exists codigo_catalogo     text;                   -- ej.: EE21
alter table public.trayectos add column if not exists acto_administrativo text;

-- 5. BAJAS DE INSCRIPCIÓN ------------------------------------------------------------------
alter table public.inscripciones add column if not exists estado      text not null default 'ACTIVA';
alter table public.inscripciones add column if not exists fecha_baja  date;
alter table public.inscripciones add column if not exists motivo_baja text;
alter table public.inscripciones add column if not exists baja_por    uuid;

-- Solo la administración puede tocar el N.º de egresado y el trayecto/alumno de una inscripción;
-- preceptor y docente solo pueden cambiar los datos de baja.
create or replace function public.proteger_inscripcion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.es_admin() then return new; end if;
  if new.num_egresado is distinct from old.num_egresado
     or new.trayecto_id is distinct from old.trayecto_id
     or new.estudiante_user is distinct from old.estudiante_user then
    raise exception 'Solo la dirección puede modificar esos datos de la inscripción';
  end if;
  return new;
end $$;
drop trigger if exists trg_proteger_inscripcion on public.inscripciones;
create trigger trg_proteger_inscripcion before update on public.inscripciones
  for each row execute function public.proteger_inscripcion();

-- Comprobación final: todas las filas tienen que dar 1
select 'es_preceptor' as objeto, count(*) from pg_proc where proname = 'es_preceptor'
union all select 'datos_estudiante', count(*) from information_schema.tables where table_schema='public' and table_name='datos_estudiante'
union all select 'observaciones_estudiante', count(*) from information_schema.tables where table_schema='public' and table_name='observaciones_estudiante'
union all select 'trayectos.sede', count(*) from information_schema.columns where table_schema='public' and table_name='trayectos' and column_name='sede'
union all select 'inscripciones.estado', count(*) from information_schema.columns where table_schema='public' and table_name='inscripciones' and column_name='estado';
