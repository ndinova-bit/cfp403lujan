-- 27. Observaciones institucionales (administrativas y pedagógicas) con seguimiento
--
-- Jerarquía: Director (admin) > Regente > Secretaría > Preceptores y Docentes.
-- Cada uno puede observar solo a quienes están por debajo. Preceptores y docentes no observan.
-- Quién las ve: la persona observada, quien la hizo, y el Director y el Regente (ven todas).
-- La persona observada puede leerla y registrar "tomé conocimiento", pero no modificarla.
-- Seguimientos: los agrega quien hizo la observación o alguien de rango superior a la persona observada.
-- Todo se escribe por funciones (no hay escritura directa a las tablas) y queda en la auditoría.

create or replace function public.rango_rol(p_rol text)
returns integer language sql immutable as $fn$
  select case lower(coalesce(p_rol, ''))
    when 'admin' then 4 when 'regente' then 3 when 'secretaria' then 2
    when 'preceptor' then 1 when 'docente' then 1 else 0 end
$fn$;

create table if not exists public.observaciones_institucionales (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  autor_id uuid not null,
  autor_nombre text not null,
  autor_rol text not null,
  destinatario_id uuid not null,
  destinatario_nombre text not null,
  destinatario_rol text not null,
  tipo text not null check (tipo in ('pedagogica', 'administrativa', 'otra')),
  fecha date not null,
  titulo text not null check (char_length(titulo) between 1 and 200),
  texto text not null check (char_length(texto) between 1 and 8000),
  link_documento text check (link_documento is null or link_documento ~* '^https://'),
  texto_documento text check (texto_documento is null or char_length(texto_documento) <= 20000),
  trayecto_id bigint references public.trayectos(id) on delete set null,
  conocimiento_at timestamptz,
  conocimiento_comentario text check (conocimiento_comentario is null or char_length(conocimiento_comentario) <= 2000),
  editada_at timestamptz
);
create index if not exists obs_inst_dest_idx on public.observaciones_institucionales (destinatario_id, fecha desc);
create index if not exists obs_inst_autor_idx on public.observaciones_institucionales (autor_id, fecha desc);

create table if not exists public.observaciones_seguimiento (
  id bigint generated always as identity primary key,
  observacion_id bigint not null references public.observaciones_institucionales(id) on delete cascade,
  created_at timestamptz not null default now(),
  autor_id uuid not null,
  autor_nombre text not null,
  autor_rol text not null,
  texto text not null check (char_length(texto) between 1 and 4000),
  link_documento text check (link_documento is null or link_documento ~* '^https://')
);
create index if not exists obs_seg_obs_idx on public.observaciones_seguimiento (observacion_id, created_at);

alter table public.observaciones_institucionales enable row level security;
alter table public.observaciones_seguimiento enable row level security;

drop policy if exists obs_inst_select on public.observaciones_institucionales;
create policy obs_inst_select on public.observaciones_institucionales for select to authenticated
  using (destinatario_id = auth.uid() or autor_id = auth.uid() or public.es_admin());

drop policy if exists obs_seg_select on public.observaciones_seguimiento;
create policy obs_seg_select on public.observaciones_seguimiento for select to authenticated
  using (exists (select 1 from public.observaciones_institucionales o where o.id = observacion_id));

revoke all on public.observaciones_institucionales from anon, authenticated;
revoke all on public.observaciones_seguimiento from anon, authenticated;
grant select on public.observaciones_institucionales to authenticated;
grant select on public.observaciones_seguimiento to authenticated;

drop trigger if exists auditoria_obs_inst on public.observaciones_institucionales;
create trigger auditoria_obs_inst after insert or update or delete on public.observaciones_institucionales
  for each row execute function public.registrar_auditoria();
drop trigger if exists auditoria_obs_seg on public.observaciones_seguimiento;
create trigger auditoria_obs_seg after insert or update or delete on public.observaciones_seguimiento
  for each row execute function public.registrar_auditoria();

-- Datos de quien llama
create or replace function public._yo_obs(out p_id uuid, out p_nombre text, out p_rol text)
language sql stable security definer set search_path = public as $fn$
  select p.id, trim(coalesce(p.apellido, '') || ', ' || coalesce(p.nombre, '')), lower(p.rol::text)
    from public.profiles p where p.id = auth.uid()
$fn$;
revoke all on function public._yo_obs() from public, anon, authenticated;

-- Personas a las que puedo observar (rango menor al mío)
create or replace function public.destinatarios_observacion()
returns table (id uuid, nombre text, rol text)
language plpgsql stable security definer set search_path = public as $fn$
declare yo record;
begin
  select * into yo from public._yo_obs();
  if yo.p_id is null or public.rango_rol(yo.p_rol) < 2 then return; end if;
  return query
    select p.id, trim(coalesce(p.apellido, '') || ', ' || coalesce(p.nombre, '')), lower(p.rol::text)
      from public.profiles p
     where public.rango_rol(p.rol::text) between 1 and public.rango_rol(yo.p_rol) - 1
       and upper(coalesce(p.estado, 'ACTIVO')) not in ('INHABILITADO', 'PENDIENTE')
     order by public.rango_rol(p.rol::text) desc, 2;
end $fn$;
revoke all on function public.destinatarios_observacion() from public, anon;
grant execute on function public.destinatarios_observacion() to authenticated;

create or replace function public.crear_observacion(
  p_destinatario uuid, p_tipo text, p_fecha date, p_titulo text, p_texto text,
  p_link text default null, p_texto_doc text default null, p_trayecto bigint default null)
returns bigint
language plpgsql security definer set search_path = public as $fn$
declare yo record; d record; nuevo bigint;
begin
  select * into yo from public._yo_obs();
  if yo.p_id is null or public.rango_rol(yo.p_rol) < 2 then raise exception 'No autorizado'; end if;
  select p.id, trim(coalesce(p.apellido, '') || ', ' || coalesce(p.nombre, '')) as nombre, lower(p.rol::text) as rol
    into d from public.profiles p where p.id = p_destinatario;
  if not found then raise exception 'La persona elegida no existe'; end if;
  if d.id = yo.p_id then raise exception 'No podés dejarte una observación a vos mismo'; end if;
  if public.rango_rol(d.rol) < 1 or public.rango_rol(d.rol) >= public.rango_rol(yo.p_rol) then
    raise exception 'Solo podés observar a personas de rango inferior al tuyo';
  end if;
  insert into public.observaciones_institucionales
    (autor_id, autor_nombre, autor_rol, destinatario_id, destinatario_nombre, destinatario_rol,
     tipo, fecha, titulo, texto, link_documento, texto_documento, trayecto_id)
  values (yo.p_id, yo.p_nombre, yo.p_rol, d.id, d.nombre, d.rol,
     p_tipo, p_fecha, btrim(p_titulo), btrim(p_texto), nullif(btrim(coalesce(p_link, '')), ''),
     nullif(btrim(coalesce(p_texto_doc, '')), ''), p_trayecto)
  returning id into nuevo;
  return nuevo;
end $fn$;
revoke all on function public.crear_observacion(uuid, text, date, text, text, text, text, bigint) from public, anon;
grant execute on function public.crear_observacion(uuid, text, date, text, text, text, text, bigint) to authenticated;

-- La puede corregir quien la hizo, mientras la persona observada no haya tomado conocimiento
create or replace function public.editar_observacion(
  p_id bigint, p_tipo text, p_fecha date, p_titulo text, p_texto text,
  p_link text default null, p_texto_doc text default null, p_trayecto bigint default null)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  update public.observaciones_institucionales
     set tipo = p_tipo, fecha = p_fecha, titulo = btrim(p_titulo), texto = btrim(p_texto),
         link_documento = nullif(btrim(coalesce(p_link, '')), ''),
         texto_documento = nullif(btrim(coalesce(p_texto_doc, '')), ''),
         trayecto_id = p_trayecto, editada_at = now()
   where id = p_id and autor_id = auth.uid() and conocimiento_at is null;
  if not found then
    raise exception 'No se puede modificar: no es tuya o la persona ya tomó conocimiento. Agregá un seguimiento.';
  end if;
end $fn$;
revoke all on function public.editar_observacion(bigint, text, date, text, text, text, text, bigint) from public, anon;
grant execute on function public.editar_observacion(bigint, text, date, text, text, text, text, bigint) to authenticated;

create or replace function public.tomar_conocimiento(p_id bigint, p_comentario text default null)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  update public.observaciones_institucionales
     set conocimiento_at = now(), conocimiento_comentario = nullif(btrim(coalesce(p_comentario, '')), '')
   where id = p_id and destinatario_id = auth.uid() and conocimiento_at is null;
  if not found then raise exception 'No se pudo registrar: no es tuya o ya figura como leída.'; end if;
end $fn$;
revoke all on function public.tomar_conocimiento(bigint, text) from public, anon;
grant execute on function public.tomar_conocimiento(bigint, text) to authenticated;

create or replace function public.agregar_seguimiento_obs(p_id bigint, p_texto text, p_link text default null)
returns bigint
language plpgsql security definer set search_path = public as $fn$
declare yo record; o record; nuevo bigint;
begin
  select * into yo from public._yo_obs();
  select * into o from public.observaciones_institucionales where id = p_id;
  if yo.p_id is null or not found then raise exception 'No autorizado'; end if;
  if not (o.autor_id = yo.p_id
          or (public.rango_rol(yo.p_rol) >= 2 and public.rango_rol(yo.p_rol) > public.rango_rol(o.destinatario_rol))) then
    raise exception 'Solo quien hizo la observación o una persona de rango superior puede agregar seguimiento';
  end if;
  insert into public.observaciones_seguimiento (observacion_id, autor_id, autor_nombre, autor_rol, texto, link_documento)
  values (p_id, yo.p_id, yo.p_nombre, yo.p_rol, btrim(p_texto), nullif(btrim(coalesce(p_link, '')), ''))
  returning id into nuevo;
  return nuevo;
end $fn$;
revoke all on function public.agregar_seguimiento_obs(bigint, text, text) from public, anon;
grant execute on function public.agregar_seguimiento_obs(bigint, text, text) to authenticated;

-- Solo el Director puede eliminar (por ejemplo, una observación cargada por error)
create or replace function public.eliminar_observacion(p_id bigint)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.es_admin_total() then raise exception 'No autorizado'; end if;
  delete from public.observaciones_institucionales where id = p_id;
end $fn$;
revoke all on function public.eliminar_observacion(bigint) from public, anon;
grant execute on function public.eliminar_observacion(bigint) to authenticated;
