-- =============================================================================
-- PASO 61 — ENCUESTA DE CIERRE INSTITUCIONAL  (y baja de «Bitácora» y «Encuesta»
--           como tipos de publicación del instructor)
--
-- Qué hace:
--   1. Saca 'bitacora' y 'encuesta' de los tipos de publicación (no había
--      ninguna cargada). La bitácora se superponía con «Práctica en taller».
--   2. encuesta_cierre_config: UNA sola encuesta / autoevaluación para toda la
--      institución. Las preguntas las edita solo el Director.
--   3. encuesta_cierre_respuestas: una respuesta por estudiante y trayecto.
--      No lleva nota. Cada estudiante ve solo la suya; nadie más lee la tabla.
--   4. Se abre sola `dias_antes` días antes de la fecha de cierre del trayecto
--      (7 por defecto) y queda abierta `dias_despues` días después (30).
--   5. Resultados siempre agrupados y sin nombres (función
--      encuesta_cierre_resultados): Dirección ve todo; el instructor ve los de
--      sus trayectos, sin los comentarios escritos.
--
-- Se puede ejecutar más de una vez.
-- =============================================================================

-- 1. TIPOS DE PUBLICACIÓN ------------------------------------------------------
alter table public.clases drop constraint if exists clases_tipo_check;
alter table public.clases add constraint clases_tipo_check
  check (tipo in ('material','tp','practica','cuestionario','escrita','diagnostico','presupuesto'));

create or replace function public.alumno_puede_responder(cid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clases c
     where c.id = cid
       and c.tipo in ('tp','escrita','presupuesto')
       and (c.fecha_publicacion is null or c.fecha_publicacion <= public.hoy_ar())
       and (c.fecha_limite is null or now() <= c.fecha_limite)
  );
$$;
revoke all on function public.alumno_puede_responder(bigint) from public, anon;
grant execute on function public.alumno_puede_responder(bigint) to authenticated;

-- 2. CONFIGURACIÓN (una sola fila) ---------------------------------------------
create table if not exists public.encuesta_cierre_config (
  id           smallint primary key default 1 check (id = 1),
  activa       boolean not null default true,
  dias_antes   integer not null default 7  check (dias_antes between 1 and 60),
  dias_despues integer not null default 30 check (dias_despues between 0 and 120),
  preguntas    jsonb not null check (jsonb_typeof(preguntas) = 'array' and octet_length(preguntas::text) <= 20000),
  updated_at   timestamptz not null default now()
);

insert into public.encuesta_cierre_config (id, preguntas) values (1, '[
  {"id":"apr",  "tipo":"escala", "bloque":"Tu autoevaluación", "enunciado":"¿Cuánto sentís que aprendiste en este trayecto?"},
  {"id":"prep", "tipo":"escala", "bloque":"Tu autoevaluación", "enunciado":"¿Qué tan preparado/a te sentís para aplicar lo aprendido en un trabajo?"},
  {"id":"comp", "tipo":"escala", "bloque":"Tu autoevaluación", "enunciado":"¿Cómo fue tu compromiso con la cursada (asistencia, entregas, participación)?"},
  {"id":"cont", "tipo":"escala", "bloque":"El trayecto", "enunciado":"¿Los contenidos y las prácticas respondieron a lo que esperabas?"},
  {"id":"inst", "tipo":"escala", "bloque":"El trayecto", "enunciado":"¿Las explicaciones y el acompañamiento del instructor/a te ayudaron a aprender?"},
  {"id":"rec",  "tipo":"escala", "bloque":"El trayecto", "enunciado":"¿Los espacios, las herramientas y los materiales (o los recursos virtuales) fueron adecuados?"},
  {"id":"plat", "tipo":"escala", "bloque":"El trayecto", "enunciado":"¿La plataforma te resultó fácil de usar?"},
  {"id":"reco", "tipo":"opcion", "bloque":"El trayecto", "enunciado":"¿Recomendarías este trayecto a otra persona?", "opciones":["Sí","Tal vez","No"]},
  {"id":"plan", "tipo":"opcion", "bloque":"Lo que viene", "enunciado":"¿Qué pensás hacer con lo que aprendiste?", "opciones":["Buscar trabajo en el rubro","Trabajar por mi cuenta","Mejorar en mi trabajo actual","Seguir capacitándome","Uso personal"]},
  {"id":"mejor","tipo":"texto",  "bloque":"Lo que viene", "enunciado":"¿Qué fue lo mejor del trayecto?"},
  {"id":"camb", "tipo":"texto",  "bloque":"Lo que viene", "enunciado":"¿Qué mejorarías?"}
]'::jsonb)
on conflict (id) do nothing;

alter table public.encuesta_cierre_config enable row level security;
drop policy if exists enc_cfg_select on public.encuesta_cierre_config;
create policy enc_cfg_select on public.encuesta_cierre_config for select to authenticated using (true);
drop policy if exists enc_cfg_update on public.encuesta_cierre_config;
create policy enc_cfg_update on public.encuesta_cierre_config for update to authenticated
  using (public.es_admin_total()) with check (public.es_admin_total());
revoke all on public.encuesta_cierre_config from anon;
grant select, update on public.encuesta_cierre_config to authenticated;

-- 3. RESPUESTAS ----------------------------------------------------------------
create table if not exists public.encuesta_cierre_respuestas (
  id              bigserial primary key,
  trayecto_id     bigint not null references public.trayectos(id) on delete cascade,
  estudiante_user text not null,
  respuestas      jsonb not null check (jsonb_typeof(respuestas) = 'object' and octet_length(respuestas::text) <= 12000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (trayecto_id, estudiante_user)
);

-- ¿Está abierta para mí la encuesta de este trayecto?
create or replace function public.encuesta_cierre_abierta(tid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.trayectos t
      join public.encuesta_cierre_config c on c.id = 1 and c.activa
      join public.inscripciones i on i.trayecto_id = t.id and i.estudiante_user = public.mi_dni()
     where t.id = tid
       and t.fecha_cierre is not null
       and upper(coalesce(i.estado, '')) <> 'BAJA'
       and public.hoy_ar() between t.fecha_cierre - c.dias_antes and t.fecha_cierre + c.dias_despues
  );
$$;
revoke all on function public.encuesta_cierre_abierta(bigint) from public, anon;
grant execute on function public.encuesta_cierre_abierta(bigint) to authenticated;

alter table public.encuesta_cierre_respuestas enable row level security;
drop policy if exists enc_resp_select on public.encuesta_cierre_respuestas;
create policy enc_resp_select on public.encuesta_cierre_respuestas for select to authenticated
  using (estudiante_user = public.mi_dni());
drop policy if exists enc_resp_insert on public.encuesta_cierre_respuestas;
create policy enc_resp_insert on public.encuesta_cierre_respuestas for insert to authenticated
  with check (estudiante_user = public.mi_dni() and public.encuesta_cierre_abierta(trayecto_id));
drop policy if exists enc_resp_update on public.encuesta_cierre_respuestas;
create policy enc_resp_update on public.encuesta_cierre_respuestas for update to authenticated
  using (estudiante_user = public.mi_dni())
  with check (estudiante_user = public.mi_dni() and public.encuesta_cierre_abierta(trayecto_id));
revoke all on public.encuesta_cierre_respuestas from anon;
grant select, insert, update on public.encuesta_cierre_respuestas to authenticated;
grant usage, select on sequence public.encuesta_cierre_respuestas_id_seq to authenticated;

-- 4. MIS ENCUESTAS ABIERTAS (estudiante) ----------------------------------------
create or replace function public.encuesta_cierre_mias()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'trayecto_id', t.id, 'nombre', t.nombre, 'fecha_cierre', t.fecha_cierre,
           'hasta', t.fecha_cierre + c.dias_despues,
           'respondida', exists (select 1 from public.encuesta_cierre_respuestas r
                                  where r.trayecto_id = t.id and r.estudiante_user = public.mi_dni())
         ) order by t.fecha_cierre), '[]'::jsonb)
    from public.trayectos t
    join public.encuesta_cierre_config c on c.id = 1 and c.activa
    join public.inscripciones i on i.trayecto_id = t.id and i.estudiante_user = public.mi_dni()
   where t.fecha_cierre is not null
     and upper(coalesce(i.estado, '')) <> 'BAJA'
     and public.hoy_ar() between t.fecha_cierre - c.dias_antes and t.fecha_cierre + c.dias_despues;
$$;
revoke all on function public.encuesta_cierre_mias() from public, anon;
grant execute on function public.encuesta_cierre_mias() to authenticated;

-- 5. RESULTADOS AGRUPADOS, SIN NOMBRES -------------------------------------------
--    p_trayecto: un trayecto (Dirección o su instructor). Sin p_trayecto: toda la
--    institución en el ciclo p_ciclo (solo Dirección). El instructor no recibe
--    los comentarios escritos.
create or replace function public.encuesta_cierre_resultados(p_trayecto bigint default null, p_ciclo integer default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_dir boolean := public.es_admin();
  v_textos text[];
  v_out jsonb;
begin
  if p_trayecto is null and not v_dir then
    raise exception 'Sin permiso';
  end if;
  if p_trayecto is not null and not (v_dir or public.es_docente_de(p_trayecto)) then
    raise exception 'Sin permiso';
  end if;

  select coalesce(array_agg(q->>'id'), '{}') into v_textos
    from public.encuesta_cierre_config c, jsonb_array_elements(c.preguntas) q
   where c.id = 1 and q->>'tipo' = 'texto';

  with tr as (
    select t.id, t.nombre, t.sector, t.fecha_cierre,
           (select count(*) from public.inscripciones i
             where i.trayecto_id = t.id and upper(coalesce(i.estado, '')) <> 'BAJA') as activos,
           (select count(*) from public.encuesta_cierre_respuestas r where r.trayecto_id = t.id) as respondieron
      from public.trayectos t
     where (p_trayecto is not null and t.id = p_trayecto)
        or (p_trayecto is null and (p_ciclo is null or t.ciclo_lectivo = p_ciclo))
  )
  select jsonb_build_object(
    've_textos', v_dir,
    'activos', coalesce((select sum(activos) from tr), 0),
    'respondieron', coalesce((select sum(respondieron) from tr), 0),
    'trayectos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'sector', sector,
                    'fecha_cierre', fecha_cierre, 'activos', activos, 'respondieron', respondieron) order by nombre, id) from tr), '[]'::jsonb),
    'respuestas', coalesce((select jsonb_agg(case when v_dir then r.respuestas else r.respuestas - v_textos end order by random())
                    from public.encuesta_cierre_respuestas r where r.trayecto_id in (select id from tr)), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;
revoke all on function public.encuesta_cierre_resultados(bigint, integer) from public, anon;
grant execute on function public.encuesta_cierre_resultados(bigint, integer) to authenticated;
