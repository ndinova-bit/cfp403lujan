-- 32. Libro de temas del docente: fecha + tema + actividad por clase dictada.
--   * Lo carga el docente del trayecto (o el administrador).
--   * Director y Regente, al abrir el libro, quedan "visados" automáticamente (se registra
--     fecha + quién), sin botón: es la prueba de que lo vieron. Pueden dejar observaciones
--     puntuales (sobre un tema) o generales (sobre el libro).
--   * Versión imprimible: la arma el frontend con los mismos datos (no hace falta nada acá).
create table if not exists public.libro_temas (
  id              bigint generated always as identity primary key,
  trayecto_id     bigint not null references public.trayectos(id) on delete cascade,
  modulo_id       bigint references public.modulos(id) on delete set null,
  fecha           date not null,
  tema            text not null check (char_length(tema) between 1 and 300),
  actividad       text check (char_length(actividad) <= 2000),
  creado_por      uuid default auth.uid(),
  creado_por_nombre text,
  created_at      timestamptz not null default now(),
  editado_at      timestamptz
);
create index if not exists libro_temas_tray_idx on public.libro_temas (trayecto_id, fecha);

create table if not exists public.libro_temas_visados (
  id              bigint generated always as identity primary key,
  trayecto_id     bigint not null references public.trayectos(id) on delete cascade,
  visado_por      uuid not null,
  visado_por_nombre text not null,
  visado_por_rol  text not null,
  created_at      timestamptz not null default now()
);
create index if not exists libro_temas_vis_idx on public.libro_temas_visados (trayecto_id, created_at desc);

create table if not exists public.libro_temas_comentarios (
  id              bigint generated always as identity primary key,
  trayecto_id     bigint not null references public.trayectos(id) on delete cascade,
  tema_id         bigint references public.libro_temas(id) on delete cascade,  -- null = comentario general del libro
  autor_id        uuid not null,
  autor_nombre    text not null,
  autor_rol       text not null,
  texto           text not null check (char_length(texto) between 1 and 1500),
  created_at      timestamptz not null default now()
);
create index if not exists libro_temas_com_idx on public.libro_temas_comentarios (trayecto_id, tema_id);

alter table public.libro_temas enable row level security;
alter table public.libro_temas_visados enable row level security;
alter table public.libro_temas_comentarios enable row level security;

-- Lo ven: el docente del trayecto, Director y Regente
drop policy if exists libro_temas_select on public.libro_temas;
create policy libro_temas_select on public.libro_temas for select to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id));
-- Lo carga/edita/borra: el docente del trayecto o el administrador (no la regencia: es quien visa)
drop policy if exists libro_temas_insert on public.libro_temas;
create policy libro_temas_insert on public.libro_temas for insert to authenticated
  with check (public.es_admin_total() or public.es_docente_de(trayecto_id));
drop policy if exists libro_temas_update on public.libro_temas;
create policy libro_temas_update on public.libro_temas for update to authenticated
  using (public.es_admin_total() or public.es_docente_de(trayecto_id))
  with check (public.es_admin_total() or public.es_docente_de(trayecto_id));
drop policy if exists libro_temas_delete on public.libro_temas;
create policy libro_temas_delete on public.libro_temas for delete to authenticated
  using (public.es_admin_total() or public.es_docente_de(trayecto_id));

drop policy if exists libro_temas_vis_select on public.libro_temas_visados;
create policy libro_temas_vis_select on public.libro_temas_visados for select to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id));
drop policy if exists libro_temas_vis_insert on public.libro_temas_visados;
create policy libro_temas_vis_insert on public.libro_temas_visados for insert to authenticated
  with check (public.es_admin_total() or public.es_regente());

drop policy if exists libro_temas_com_select on public.libro_temas_comentarios;
create policy libro_temas_com_select on public.libro_temas_comentarios for select to authenticated
  using (public.es_admin() or public.es_docente_de(trayecto_id));
drop policy if exists libro_temas_com_insert on public.libro_temas_comentarios;
create policy libro_temas_com_insert on public.libro_temas_comentarios for insert to authenticated
  with check (public.es_admin_total() or public.es_regente());
drop policy if exists libro_temas_com_delete on public.libro_temas_comentarios;
create policy libro_temas_com_delete on public.libro_temas_comentarios for delete to authenticated
  using (public.es_admin_total() or (public.es_regente() and autor_id = auth.uid()));

grant select, insert, update, delete on public.libro_temas to authenticated;
grant select, insert on public.libro_temas_visados to authenticated;
grant select, insert, delete on public.libro_temas_comentarios to authenticated;

drop trigger if exists trg_auditoria on public.libro_temas;
create trigger trg_auditoria after insert or update or delete on public.libro_temas
  for each row execute function public.registrar_auditoria();
drop trigger if exists trg_auditoria on public.libro_temas_comentarios;
create trigger trg_auditoria after insert or update or delete on public.libro_temas_comentarios
  for each row execute function public.registrar_auditoria();

-- Registra el visado de Director/Regente al abrir el libro (una vez por día alcanza; no spamea)
create or replace function public.visar_libro_temas(p_trayecto bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare yo record;
begin
  if not (public.es_admin_total() or public.es_regente()) then return; end if;
  select p.id, trim(coalesce(p.apellido,'') || ', ' || coalesce(p.nombre,'')) as nombre, lower(p.rol::text) as rol
    into yo from public.profiles p where p.id = auth.uid();
  if yo.id is null then return; end if;
  if exists (select 1 from public.libro_temas_visados v
              where v.trayecto_id = p_trayecto and v.visado_por = yo.id
                and v.created_at::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date) then
    return;   -- ya quedó registrado hoy
  end if;
  insert into public.libro_temas_visados (trayecto_id, visado_por, visado_por_nombre, visado_por_rol)
  values (p_trayecto, yo.id, yo.nombre, yo.rol);
end $fn$;
revoke all on function public.visar_libro_temas(bigint) from public, anon;
grant execute on function public.visar_libro_temas(bigint) to authenticated;
