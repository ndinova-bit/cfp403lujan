-- =====================================================================================
-- 06 · NOVEDADES Y CALENDARIO
-- Avisos que publica la administración. Pueden ser:
--   * públicos (se ven en la web, sin iniciar sesión), o
--   * internos para un trayecto (solo los ven quienes cursan o dictan ese trayecto).
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede volver a ejecutar sin romper nada.
-- =====================================================================================

create table if not exists public.novedades (
  id              bigint generated always as identity primary key,
  titulo          text not null check (char_length(titulo) between 3 and 120),
  cuerpo          text check (char_length(cuerpo) <= 1500),
  tipo            text not null default 'aviso'
                  check (tipo in ('aviso','inscripcion','inicio','feriado','examen','acto')),
  fecha_evento    date,                       -- fecha del evento (opcional, para el calendario)
  vence           date,                       -- deja de mostrarse después de esta fecha (opcional)
  publica         boolean not null default true,   -- true = se ve en la web pública
  trayecto_id     bigint references public.trayectos(id) on delete cascade, -- null = para todos
  publicado       boolean not null default true,   -- false = borrador / oculto
  creado_por      uuid default auth.uid(),
  created_at      timestamptz not null default now()
);

create index if not exists novedades_fecha_idx on public.novedades (fecha_evento);
create index if not exists novedades_trayecto_idx on public.novedades (trayecto_id);

alter table public.novedades enable row level security;

drop policy if exists novedades_select_anon on public.novedades;
drop policy if exists novedades_select_auth on public.novedades;
drop policy if exists novedades_insert on public.novedades;
drop policy if exists novedades_update on public.novedades;
drop policy if exists novedades_delete on public.novedades;

-- Web pública: solo lo publicado, público, general y no vencido
create policy novedades_select_anon on public.novedades for select to anon
  using (publicado and publica and trayecto_id is null
         and (vence is null or vence >= (now() at time zone 'America/Argentina/Buenos_Aires')::date));

-- Usuarios con sesión: lo general + lo de sus trayectos. El admin ve todo (incluso borradores).
create policy novedades_select_auth on public.novedades for select to authenticated
  using (
    public.es_admin()
    or (publicado
        and (vence is null or vence >= (now() at time zone 'America/Argentina/Buenos_Aires')::date)
        and (trayecto_id is null or public.puede_ver_trayecto(trayecto_id)))
  );

create policy novedades_insert on public.novedades for insert to authenticated
  with check (public.es_admin());
create policy novedades_update on public.novedades for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy novedades_delete on public.novedades for delete to authenticated
  using (public.es_admin());

grant select on public.novedades to anon;
grant select, insert, update, delete on public.novedades to authenticated;

-- Registro de cambios (auditoría), igual que el resto de las tablas
drop trigger if exists trg_auditoria on public.novedades;
create trigger trg_auditoria after insert or update or delete on public.novedades
  for each row execute function public.registrar_auditoria();

-- Comprobación: debe devolver 0 filas y ningún error
select * from public.novedades limit 1;
