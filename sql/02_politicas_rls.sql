-- =============================================================================
-- PASO 2 — POLÍTICAS DE SEGURIDAD (RLS): quién puede ver y modificar qué
-- Ejecutar DESPUÉS de: (a) correr el paso 1, (b) subir el código nuevo a GitHub
-- y (c) comprobar que podés entrar como administrador.
--
-- Qué hace:
--   * Visitante sin sesión ........ ve solo los trayectos del ciclo lectivo vigente
--   * Estudiante .................. ve solo sus trayectos, sus clases, sus entregas y su asistencia;
--                                   puede responder actividades (no ponerse nota)
--   * Docente ..................... gestiona clases, entregas, asistencia y notas de SUS trayectos
--   * Administrador ............... ve y modifica todo
--
-- IMPORTANTE: borra todas las políticas anteriores de `public` y las vuelve a
-- crear. Es repetible. Tiene que ejecutarse completo.
-- =============================================================================

-- 2.0  Borrar políticas anteriores ------------------------------------------------
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 2.1  Activar RLS en todas las tablas ---------------------------------------------
alter table public.profiles                enable row level security;
alter table public.trayectos               enable row level security;
alter table public.modulos                 enable row level security;
alter table public.inscripciones           enable row level security;
alter table public.clases                  enable row level security;
alter table public.actividades             enable row level security;
alter table public.entregas_actividades    enable row level security;
alter table public.asistencias             enable row level security;
alter table public.excepciones_estudiantes enable row level security;
alter table public.notificaciones          enable row level security;
alter table public.padron_estudiantes      enable row level security;
alter table public.contenidos              enable row level security;
alter table public.entregas                enable row level security;
alter table public.notas_modulares         enable row level security;
do $$ begin
  if to_regclass('public.usuarios_legacy') is not null then
    execute 'alter table public.usuarios_legacy enable row level security';
  end if;
end $$;

-- 2.2  profiles -----------------------------------------------------------------------
-- Cada persona ve su propio perfil; el admin ve todos; el docente ve a sus alumnos.
-- Nadie (salvo el admin) puede modificar perfiles: así nadie se cambia el rol.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.es_admin() or public.es_docente_de_alumno(dni));
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using (public.es_admin());

-- 2.3  trayectos y módulos -------------------------------------------------------------
-- Públicos: solo el ciclo vigente. Quien está inscripto o dicta ve también los de otros ciclos.
create policy trayectos_select on public.trayectos for select to anon, authenticated
  using (
    ciclo_lectivo = extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::int
    or public.puede_ver_trayecto(id)
  );
create policy trayectos_insert on public.trayectos for insert to authenticated
  with check (public.es_admin());
create policy trayectos_update on public.trayectos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy trayectos_delete on public.trayectos for delete to authenticated
  using (public.es_admin());

create policy modulos_select on public.modulos for select to anon, authenticated
  using (true);
create policy modulos_insert on public.modulos for insert to authenticated
  with check (public.es_admin());
create policy modulos_update on public.modulos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy modulos_delete on public.modulos for delete to authenticated
  using (public.es_admin());

-- 2.4  inscripciones ----------------------------------------------------------------------
create policy inscripciones_select on public.inscripciones for select to authenticated
  using (public.es_admin() or estudiante_user = public.mi_dni() or public.es_docente_de(trayecto_id));
create policy inscripciones_insert on public.inscripciones for insert to authenticated
  with check (public.es_admin());
create policy inscripciones_update on public.inscripciones for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy inscripciones_delete on public.inscripciones for delete to authenticated
  using (public.es_admin());

-- 2.5  clases y actividades ---------------------------------------------------------------
create policy clases_select on public.clases for select to authenticated
  using (
    public.es_admin()
    or public.es_docente_de(trayecto_id)
    or (public.esta_inscripto(trayecto_id)
        and (estudiante_user is null or estudiante_user = public.mi_dni()))
  );
create policy clases_insert on public.clases for insert to authenticated
  with check (public.es_admin() or public.es_docente_de(trayecto_id));
create policy clases_update on public.clases for update to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id))
  with check (public.es_admin() or public.es_docente_de(trayecto_id));
create policy clases_delete on public.clases for delete to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id));

create policy actividades_select on public.actividades for select to authenticated
  using (public.puede_ver_trayecto(coalesce(trayecto_id, public.trayecto_de_clase(clase_id))));
create policy actividades_insert on public.actividades for insert to authenticated
  with check (public.es_admin() or public.es_docente_de(coalesce(trayecto_id, public.trayecto_de_clase(clase_id))));
create policy actividades_update on public.actividades for update to authenticated
  using (public.es_admin() or public.es_docente_de(coalesce(trayecto_id, public.trayecto_de_clase(clase_id))))
  with check (public.es_admin() or public.es_docente_de(coalesce(trayecto_id, public.trayecto_de_clase(clase_id))));
create policy actividades_delete on public.actividades for delete to authenticated
  using (public.es_admin() or public.es_docente_de(coalesce(trayecto_id, public.trayecto_de_clase(clase_id))));

-- 2.6  entregas_actividades: el estudiante responde; solo el docente/admin corrige ----------
create policy entregas_select on public.entregas_actividades for select to authenticated
  using (
    public.es_admin()
    or estudiante_user = public.mi_dni()
    or public.es_docente_de(public.trayecto_de_clase(clase_id))
  );
-- Estudiante: entrega solo a su nombre, en un trayecto donde está inscripto, y sin nota
create policy entregas_insert_estudiante on public.entregas_actividades for insert to authenticated
  with check (
    estudiante_user = public.mi_dni()
    and nota is null
    and comentario_docente is null
    and public.esta_inscripto(public.trayecto_de_clase(clase_id))
  );
create policy entregas_insert_staff on public.entregas_actividades for insert to authenticated
  with check (public.es_admin() or public.es_docente_de(public.trayecto_de_clase(clase_id)));
-- Estudiante: puede reenviar mientras no esté corregida
create policy entregas_update_estudiante on public.entregas_actividades for update to authenticated
  using (estudiante_user = public.mi_dni() and nota is null)
  with check (estudiante_user = public.mi_dni() and nota is null and comentario_docente is null);
create policy entregas_update_staff on public.entregas_actividades for update to authenticated
  using (public.es_admin() or public.es_docente_de(public.trayecto_de_clase(clase_id)))
  with check (public.es_admin() or public.es_docente_de(public.trayecto_de_clase(clase_id)));
create policy entregas_delete on public.entregas_actividades for delete to authenticated
  using (
    public.es_admin()
    or public.es_docente_de(public.trayecto_de_clase(clase_id))
    or (estudiante_user = public.mi_dni() and nota is null)
  );

-- 2.7  asistencias y excepciones ---------------------------------------------------------------
create policy asistencias_select on public.asistencias for select to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id) or estudiante_user = public.mi_dni());
create policy asistencias_insert on public.asistencias for insert to authenticated
  with check (public.es_admin() or public.es_docente_de(trayecto_id));
create policy asistencias_update on public.asistencias for update to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id))
  with check (public.es_admin() or public.es_docente_de(trayecto_id));
create policy asistencias_delete on public.asistencias for delete to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id));

create policy excepciones_select on public.excepciones_estudiantes for select to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id) or estudiante_user = public.mi_dni());
create policy excepciones_insert on public.excepciones_estudiantes for insert to authenticated
  with check (public.es_admin() or public.es_docente_de(trayecto_id));
create policy excepciones_update on public.excepciones_estudiantes for update to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id))
  with check (public.es_admin() or public.es_docente_de(trayecto_id));
create policy excepciones_delete on public.excepciones_estudiantes for delete to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id));

-- 2.8  notificaciones --------------------------------------------------------------------------
create policy notificaciones_select on public.notificaciones for select to authenticated
  using (estudiante_user = public.mi_dni() or public.es_admin() or public.es_docente_de(trayecto_id));
create policy notificaciones_insert on public.notificaciones for insert to authenticated
  with check (public.es_admin() or public.es_docente_de(trayecto_id));
create policy notificaciones_update on public.notificaciones for update to authenticated
  using (estudiante_user = public.mi_dni() or public.es_admin())
  with check (estudiante_user = public.mi_dni() or public.es_admin());
create policy notificaciones_delete on public.notificaciones for delete to authenticated
  using (estudiante_user = public.mi_dni() or public.es_admin());

-- 2.9  padrón -----------------------------------------------------------------------------------
create policy padron_select on public.padron_estudiantes for select to authenticated
  using (public.es_admin() or public.es_docente_de_alumno(dni));
create policy padron_insert on public.padron_estudiantes for insert to authenticated
  with check (public.es_admin());
create policy padron_update on public.padron_estudiantes for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy padron_delete on public.padron_estudiantes for delete to authenticated
  using (public.es_admin());

-- 2.10 Tablas viejas que la plataforma actual no usa: solo administrador ----------------------
create policy contenidos_admin      on public.contenidos      for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy entregas_old_admin    on public.entregas        for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy notas_modulares_admin on public.notas_modulares for all to authenticated using (public.es_admin()) with check (public.es_admin());
do $$ begin
  if to_regclass('public.usuarios_legacy') is not null then
    execute 'create policy usuarios_legacy_admin on public.usuarios_legacy for all to authenticated using (public.es_admin()) with check (public.es_admin())';
  end if;
end $$;

-- 2.11 Verificación: todas las tablas deben figurar con rls_activo = true y policies > 0 ------
select c.relname as tabla,
       c.relrowsecurity as rls_activo,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by c.relname;
