-- =============================================================================
-- PASO 11 — CLASES Y ACTIVIDADES
-- Tipos de publicación, fecha límite, cuestionarios autocorregibles, lista de
-- cotejo, banco de preguntas y archivo de respuestas viejas.
--
-- Qué hace:
--   1. clases: columnas propias para el tipo, la fecha de publicación, la fecha
--      límite, el link de la actividad y el contenido (preguntas, criterios…).
--      Pasa a esas columnas la fecha y el link que hoy están escritos dentro
--      de la descripción, y los borra del texto.
--   2. claves_actividad: las respuestas correctas, en una tabla aparte que los
--      estudiantes NO pueden leer. La nota la calcula el servidor.
--   3. entregas_actividades: respuestas del alumno (solo las del mejor intento),
--      cantidad de intentos y lista de cotejo del docente. Límite de tamaño.
--   4. Permisos: el alumno ve una clase recién desde su fecha de publicación,
--      y solo puede responder dentro del plazo. Los cuestionarios y casos de
--      diagnóstico solo se envían a través del servidor (no se puede poner nota).
--   5. Auditoría: no guarda copias de las respuestas ni de las preguntas
--      (sí la nota, el comentario y la lista de cotejo del docente).
--   6. banco_preguntas: preguntas guardadas por módulo para reutilizar.
--   7. Cierre de ciclo: funciones para archivar las respuestas detalladas viejas.
--
-- Se puede ejecutar más de una vez.
-- =============================================================================

-- 1. CLASES -------------------------------------------------------------------
alter table public.clases
  add column if not exists tipo text not null default 'material',
  add column if not exists contenido jsonb,
  add column if not exists fecha_publicacion date,
  add column if not exists fecha_limite timestamptz,
  add column if not exists url_actividad text,
  add column if not exists es_evaluacion boolean not null default false,
  add column if not exists calificable boolean not null default true;

alter table public.clases drop constraint if exists clases_tipo_check;
alter table public.clases add constraint clases_tipo_check
  check (tipo in ('material','tp','practica','cuestionario','escrita','diagnostico','presupuesto','bitacora','encuesta'));
alter table public.clases drop constraint if exists clases_contenido_tamano;
alter table public.clases add constraint clases_contenido_tamano
  check (contenido is null or octet_length(contenido::text) <= 200000);

-- 1.b Pasar la fecha y el link que estaban escritos en la descripción
update public.clases
   set fecha_publicacion = coalesce(fecha_publicacion,
         to_date(substring(descripcion from '📅 Fecha de Publicación: (\d{2}/\d{2}/\d{4})'), 'DD/MM/YYYY')),
       url_actividad = coalesce(url_actividad,
         substring(descripcion from '📝 Enlace a Actividad / TP: (https?://\S+)'))
 where descripcion like '%📅 Fecha de Publicación:%'
    or descripcion like '%📝 Enlace a Actividad / TP:%';

update public.clases
   set descripcion = nullif(btrim(
         regexp_replace(
           regexp_replace(descripcion, '📅 Fecha de Publicación: \d{2}/\d{2}/\d{4}\n?', '', 'g'),
           '📝 Enlace a Actividad / TP: https?://\S+\n?', '', 'g'),
         E' \n\r\t'), '')
 where descripcion like '%📅 Fecha de Publicación:%'
    or descripcion like '%📝 Enlace a Actividad / TP:%';

-- Lo que tenía link de actividad o ya recibió entregas pasa a ser "Trabajo práctico"
update public.clases c set tipo = 'tp'
 where c.tipo = 'material'
   and (c.url_actividad is not null
        or exists (select 1 from public.entregas_actividades e where e.clase_id = c.id));
update public.clases set calificable = false where tipo in ('material','encuesta') and calificable;

-- 2. CLAVES (respuestas correctas) ----------------------------------------------
create table if not exists public.claves_actividad (
  clase_id   bigint primary key references public.clases(id) on delete cascade,
  clave      jsonb not null default '{}'::jsonb check (octet_length(clave::text) <= 200000),
  updated_at timestamptz not null default now()
);
alter table public.claves_actividad enable row level security;
drop policy if exists claves_staff on public.claves_actividad;
create policy claves_staff on public.claves_actividad for all to authenticated
  using (public.es_admin() or public.es_docente_de(public.trayecto_de_clase(clase_id)))
  with check (public.es_admin() or public.es_docente_de(public.trayecto_de_clase(clase_id)));
revoke all on public.claves_actividad from anon;

-- 3. ENTREGAS -----------------------------------------------------------------
alter table public.entregas_actividades
  add column if not exists respuestas jsonb,
  add column if not exists intentos integer not null default 0,
  add column if not exists cotejo jsonb,
  add column if not exists updated_at timestamptz;
alter table public.entregas_actividades alter column url_entrega drop not null;

alter table public.entregas_actividades drop constraint if exists entregas_respuestas_tamano;
alter table public.entregas_actividades add constraint entregas_respuestas_tamano
  check (respuestas is null or octet_length(respuestas::text) <= 60000);

-- Una sola entrega por alumno y actividad (si hubiera duplicados viejos, se avisa y se sigue)
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'entregas_una_por_alumno') then
    begin
      create unique index entregas_una_por_alumno on public.entregas_actividades (clase_id, estudiante_user);
    exception when unique_violation then
      raise notice 'Hay entregas duplicadas (mismo alumno y actividad): no se creó el índice único. La plataforma igual funciona.';
    end;
  end if;
end $$;

-- 4. PERMISOS -----------------------------------------------------------------
create or replace function public.hoy_ar()
returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- ¿El alumno puede responder directamente esta actividad? (publicada, en plazo y de un tipo
-- que no se corrige solo). Los cuestionarios y diagnósticos pasan por el servidor.
create or replace function public.alumno_puede_responder(cid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clases c
     where c.id = cid
       and c.tipo in ('tp','escrita','presupuesto','bitacora','encuesta')
       and (c.fecha_publicacion is null or c.fecha_publicacion <= public.hoy_ar())
       and (c.fecha_limite is null or now() <= c.fecha_limite)
  );
$$;
revoke all on function public.alumno_puede_responder(bigint) from public, anon;
grant execute on function public.alumno_puede_responder(bigint) to authenticated;

-- El alumno ve la clase recién desde su fecha de publicación
drop policy if exists clases_select on public.clases;
create policy clases_select on public.clases for select to authenticated
  using (
    public.es_personal()
    or public.es_docente_de(trayecto_id)
    or (public.esta_inscripto(trayecto_id)
        and (estudiante_user is null or estudiante_user = public.mi_dni())
        and (fecha_publicacion is null or fecha_publicacion <= public.hoy_ar()))
  );

drop policy if exists entregas_insert_estudiante on public.entregas_actividades;
create policy entregas_insert_estudiante on public.entregas_actividades for insert to authenticated
  with check (
    estudiante_user = public.mi_dni()
    and nota is null and comentario_docente is null and cotejo is null
    and coalesce(intentos, 0) = 0
    and (respuestas is null or not (respuestas ? 'd'))
    and public.esta_inscripto(public.trayecto_de_clase(clase_id))
    and public.alumno_puede_responder(clase_id)
  );

drop policy if exists entregas_update_estudiante on public.entregas_actividades;
create policy entregas_update_estudiante on public.entregas_actividades for update to authenticated
  using (estudiante_user = public.mi_dni() and nota is null and coalesce(intentos, 0) = 0)
  with check (
    estudiante_user = public.mi_dni()
    and nota is null and comentario_docente is null and cotejo is null
    and coalesce(intentos, 0) = 0
    and (respuestas is null or not (respuestas ? 'd'))
    and public.alumno_puede_responder(clase_id)
  );

drop policy if exists entregas_delete on public.entregas_actividades;
create policy entregas_delete on public.entregas_actividades for delete to authenticated
  using (
    public.es_admin()
    or public.es_docente_de(public.trayecto_de_clase(clase_id))
    or (estudiante_user = public.mi_dni() and nota is null and coalesce(intentos, 0) = 0)
  );

-- 5. AUDITORÍA sin copias de respuestas ni de preguntas ------------------------------
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

  -- No se guardan copias de las respuestas de los alumnos ni del contenido de las actividades
  v_nue := v_nue - 'respuestas' - 'contenido' - 'updated_at';
  v_ant := v_ant - 'respuestas' - 'contenido' - 'updated_at';
  if tg_op = 'UPDATE' and (v_nue is null or v_nue = '{}'::jsonb) then
    return new;
  end if;

  insert into public.auditoria (usuario_id, usuario_dni, usuario_rol, tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
  values (v_uid, v_dni, v_rol, tg_table_name, tg_op, v_id, v_ant, v_nue);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.registrar_auditoria() from public, anon, authenticated;

-- 6. BANCO DE PREGUNTAS ----------------------------------------------------------
create table if not exists public.banco_preguntas (
  id              bigint generated always as identity primary key,
  modulo_nombre   text,
  trayecto_nombre text,
  tipo            text not null,
  enunciado       text,
  pregunta        jsonb not null check (octet_length(pregunta::text) <= 30000),
  creado_por      text default public.mi_dni(),
  created_at      timestamptz not null default now()
);
alter table public.banco_preguntas enable row level security;
drop policy if exists banco_select on public.banco_preguntas;
drop policy if exists banco_insert on public.banco_preguntas;
drop policy if exists banco_delete on public.banco_preguntas;
create policy banco_select on public.banco_preguntas for select to authenticated
  using (public.es_admin() or public.es_docente());
create policy banco_insert on public.banco_preguntas for insert to authenticated
  with check (public.es_admin() or public.es_docente());
create policy banco_delete on public.banco_preguntas for delete to authenticated
  using (public.es_admin() or creado_por = public.mi_dni());
revoke all on public.banco_preguntas from anon;

-- 7. CIERRE DE CICLO: archivar respuestas detalladas viejas ---------------------------
-- Conserva la nota, el comentario y la lista de cotejo; solo vacía el detalle de respuestas.
create or replace function public.resumen_respuestas(p_antes date)
returns table (cantidad bigint, bytes bigint)
language sql stable security definer set search_path = public as $$
  select count(*), coalesce(sum(pg_column_size(e.respuestas)), 0)::bigint
    from public.entregas_actividades e
   where public.es_admin()
     and e.respuestas is not null
     and not (e.respuestas ? 'archivado')
     and coalesce(e.updated_at, e.created_at) < p_antes;
$$;
revoke all on function public.resumen_respuestas(date) from public, anon;
grant execute on function public.resumen_respuestas(date) to authenticated;

create or replace function public.archivar_respuestas(p_antes date)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.es_admin() then
    raise exception 'Solo la dirección puede archivar respuestas';
  end if;
  if p_antes > (public.hoy_ar() - 365) then
    raise exception 'Solo se archivan respuestas de más de un año';
  end if;
  update public.entregas_actividades
     set respuestas = jsonb_build_object('archivado', to_char(public.hoy_ar(), 'YYYY-MM-DD'))
   where respuestas is not null
     and not (respuestas ? 'archivado')
     and coalesce(updated_at, created_at) < p_antes;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.archivar_respuestas(date) from public, anon;
grant execute on function public.archivar_respuestas(date) to authenticated;

-- Control
select tipo, count(*) as clases from public.clases group by tipo order by tipo;
