-- =============================================================================
-- PASO 1 — BASE: roles, alta automática de perfiles, padrón y compatibilidad
-- Dónde: Supabase > SQL Editor > New query > pegar TODO > Run
-- Se puede ejecutar más de una vez sin romper nada.
--
-- ANTES de ejecutar, corré estas dos consultas SOLAS (son de lectura) y guardá
-- lo que devuelven por si hay que revisar algo:
--
--   select distinct rol, estado, count(*) from public.profiles group by 1, 2;
--   select tgname, pg_get_triggerdef(oid) from pg_trigger
--     where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
-- Si la segunda devuelve un trigger que NO se llama on_auth_user_created,
-- pasame el resultado antes de seguir (puede duplicar la creación de perfiles).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1.1  Funciones de rol. Son "security definer" para poder consultar `profiles`
--      desde las políticas de seguridad sin que se queden en un bucle.
-- -----------------------------------------------------------------------------

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol) in ('admin', 'administrador')
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  );
$$;

create or replace function public.es_docente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(p.rol) = 'docente'
      and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  );
$$;

-- DNI de quien está logueado (null si no hay sesión o la cuenta no está activa)
create or replace function public.mi_dni()
returns text language sql stable security definer set search_path = public as $$
  select p.dni from public.profiles p
  where p.id = auth.uid()
    and upper(coalesce(p.estado, 'ACTIVO')) = 'ACTIVO'
  limit 1;
$$;

-- ¿Soy el docente asignado a este trayecto?
create or replace function public.es_docente_de(tid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_docente() and exists (
    select 1 from public.trayectos t
    where t.id = tid and t.docente_user = public.mi_dni()
  );
$$;

-- ¿Estoy inscripto en este trayecto?
create or replace function public.esta_inscripto(tid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.inscripciones i
    where i.trayecto_id = tid and i.estudiante_user = public.mi_dni()
  );
$$;

-- Administrador, docente del trayecto o estudiante inscripto
create or replace function public.puede_ver_trayecto(tid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.es_docente_de(tid) or public.esta_inscripto(tid);
$$;

-- ¿Este DNI está inscripto en algún trayecto que yo dicto?
create or replace function public.es_docente_de_alumno(p_dni text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_docente() and exists (
    select 1
    from public.inscripciones i
    join public.trayectos t on t.id = i.trayecto_id
    where i.estudiante_user = p_dni
      and t.docente_user = public.mi_dni()
  );
$$;

-- Trayecto al que pertenece una clase
create or replace function public.trayecto_de_clase(cid bigint)
returns bigint language sql stable security definer set search_path = public as $$
  select c.trayecto_id from public.clases c where c.id = cid;
$$;


-- -----------------------------------------------------------------------------
-- 1.2  Padrón de estudiantes (lo llena el importador CSV). No es una cuenta.
-- -----------------------------------------------------------------------------

create table if not exists public.padron_estudiantes (
  dni        text primary key,
  nombre     text,
  apellido   text,
  email      text,
  created_at timestamptz default now()
);


-- -----------------------------------------------------------------------------
-- 1.3  Alta automática del perfil cuando alguien se registra en Supabase Auth.
--      SIEMPRE nace como ESTUDIANTE / PENDIENTE: nadie se da un rol a sí mismo.
--      La administración aprueba y cambia el rol desde "Usuarios y Roles".
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dni text;
  v_pad record;
begin
  v_dni := regexp_replace(
             coalesce(new.raw_user_meta_data ->> 'dni', split_part(new.email, '@', 1)),
             '\D', '', 'g');

  select * into v_pad from public.padron_estudiantes where dni = v_dni;

  insert into public.profiles (id, dni, nombre, apellido, email, rol, estado)
  values (
    new.id,
    v_dni,
    coalesce(nullif(v_pad.nombre, ''),   nullif(new.raw_user_meta_data ->> 'nombre', ''),   'SIN NOMBRE'),
    coalesce(nullif(v_pad.apellido, ''), nullif(new.raw_user_meta_data ->> 'apellido', ''), ''),
    lower(new.email),
    'estudiante',
    'PENDIENTE'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 1.4  Compatibilidad: `usuarios` pasa a ser una VISTA sobre `profiles` (+ padrón).
--      Así clases, asistencias, actas y reportes siguen funcionando sin tocarlos.
--      La tabla vieja NO se borra: queda como `usuarios_legacy`.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'usuarios' and c.relkind = 'r'
  ) then
    alter table public.usuarios rename to usuarios_legacy;
  end if;
end $$;

create or replace view public.usuarios
with (security_invoker = true) as
  select p.id, p.dni as usuario, p.dni, p.nombre, p.apellido, p.email,
         p.rol::text as rol, p.estado::text as estado
  from public.profiles p
  union all
  select null::uuid, d.dni, d.dni, d.nombre, d.apellido, d.email,
         'estudiante'::text, 'SIN CUENTA'::text
  from public.padron_estudiantes d
  where not exists (select 1 from public.profiles p where p.dni = d.dni);

grant select on public.usuarios to authenticated;


-- -----------------------------------------------------------------------------
-- 1.5  TU CUENTA DE ADMINISTRADOR
--      Reemplazá '12345678', 'TU NOMBRE' y 'TU APELLIDO' por tus datos reales
--      y ejecutá SOLO este bloque. Requiere que ya exista tu usuario en
--      Authentication > Users con el email ndinova@abc.gob.ar.
-- -----------------------------------------------------------------------------

insert into public.profiles (id, dni, nombre, apellido, email, rol, estado)
select u.id, '92828993', 'NICOLAS', 'DINOVA', lower(u.email), 'admin', 'ACTIVO'
from auth.users u
where lower(u.email) = 'ndinova@abc.gob.ar'
on conflict (id) do update
  set rol = 'admin', estado = 'ACTIVO';

-- Verificación: tiene que devolver UNA fila con rol admin y estado ACTIVO
select p.id, p.email, p.dni, p.rol, p.estado
from public.profiles p
where lower(p.email) = 'ndinova@abc.gob.ar';
