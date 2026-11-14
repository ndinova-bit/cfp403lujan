-- 70 · Prácticas de «Seguridad Informática»: la corrección pasa al servidor.
-- Las respuestas correctas viven en practica_claves (sin acceso desde el navegador).
-- La función «practica-servidor» corrige, calcula el puntaje y carga la nota; el navegador ya no manda el puntaje.

-- 1. Tablas privadas (RLS activo, sin políticas: solo las lee la función con la clave de servicio)
create table if not exists public.practica_claves (
  trayecto text not null, practica int not null, claves jsonb not null,
  primary key (trayecto, practica));
create table if not exists public.practica_sesiones (
  id uuid primary key default gen_random_uuid(),
  creada timestamptz not null default now(),
  dni text not null, trayecto text not null, practica int not null,
  modo text not null check (modo in ('nota','practica')),
  version int not null default 0,
  estado jsonb not null default '{}'::jsonb,
  terminada timestamptz, puntaje int);
create index if not exists practica_sesiones_busqueda on public.practica_sesiones (dni, trayecto, practica, creada desc);
alter table public.practica_claves enable row level security;
alter table public.practica_sesiones enable row level security;
revoke all on public.practica_claves, public.practica_sesiones from anon, authenticated;

-- 2. Estado de una práctica para un DNI dado (misma lógica que estado_practica, sin depender de la sesión del navegador)
create or replace function public._estado_practica(p_dni text, p_trayecto text, p_practica integer)
returns jsonb language plpgsql stable security definer set search_path = public as $f$
declare
  v_dni text := p_dni; v_cid bigint; e record; v_hist int; v_num numeric; v_pub date;
  v_auto text := 'Nota cargada automáticamente desde la plataforma de prácticas.';
begin
  if v_dni is null then return jsonb_build_object('estado','sin_sesion'); end if;
  v_cid := public._clase_de_practica(v_dni, p_trayecto, p_practica);
  if v_cid is null then
    if exists (select 1 from public.inscripciones i join public.trayectos t on t.id=i.trayecto_id
                where i.estudiante_user=v_dni and upper(i.estado)='ACTIVA'
                  and t.nombre ilike case p_trayecto when 'seguridad' then '%seguridad inform%' when 'planillas' then '%planillas de c%' when 'pensamiento' then '%pensamiento comput%' else '-' end)
    then return jsonb_build_object('estado','sin_clase'); end if;
    return jsonb_build_object('estado','no_inscripto');
  end if;
  select c.fecha_publicacion into v_pub from public.clases c where c.id = v_cid;
  if v_pub is not null and v_pub > public.hoy_ar() then return jsonb_build_object('estado','no_publicada','fecha',v_pub); end if;
  if not public.alumno_puede_responder(v_cid) then return jsonb_build_object('estado','fuera_de_plazo'); end if;
  select * into e from public.entregas_actividades where clase_id = v_cid and estudiante_user = v_dni;
  if not found then return jsonb_build_object('estado','primer_intento','reintentos',2); end if;
  v_hist := coalesce(jsonb_array_length(e.respuestas->'historial'), 0);
  begin v_num := nullif(trim(e.nota),'')::numeric; exception when others then v_num := null; end;
  if e.nota is not null and (coalesce(e.comentario_docente,'') <> v_auto or e.nota is distinct from (e.respuestas->>'nota_auto')) then
    return jsonb_build_object('estado','evaluada','nota',e.nota);
  end if;
  if v_hist = 0 and e.nota is null then return jsonb_build_object('estado','primer_intento','reintentos',2); end if;
  if v_num is not null and v_num >= 70 then return jsonb_build_object('estado','aprobada','nota',e.nota); end if;
  if e.nota is null then return jsonb_build_object('estado','reintento','reintentos',1,'nota',null,'reabierta',true); end if;
  if coalesce((e.respuestas->>'reintentos_usados')::int,0) >= 2 then return jsonb_build_object('estado','agotada','nota',e.nota); end if;
  return jsonb_build_object('estado','reintento','reintentos', 2 - coalesce((e.respuestas->>'reintentos_usados')::int,0),'nota',e.nota);
end $f$;

create or replace function public.estado_practica(p_trayecto text, p_practica integer)
returns jsonb language sql stable security definer set search_path = public as $f$
  select public._estado_practica(public.mi_dni(), p_trayecto, p_practica);
$f$;

-- 3. Carga de nota para un DNI dado (misma lógica que registrar_nota_practica)
create or replace function public._registrar_nota_practica(p_dni text, p_trayecto text, p_practica integer, p_puntaje integer, p_detalle jsonb default null)
returns text language plpgsql security definer set search_path = public as $f$
declare
  v_dni text := p_dni; v_est jsonb; v_cid bigint; e record; v_nota int; v_resp jsonb; v_estado text;
  v_auto text := 'Nota cargada automáticamente desde la plataforma de prácticas.';
begin
  if p_practica is null or p_practica < 1 or p_practica > 100 or p_puntaje is null or p_puntaje < 0 or p_puntaje > 100 then return 'datos_invalidos'; end if;
  v_est := public._estado_practica(v_dni, p_trayecto, p_practica);
  v_estado := v_est->>'estado';
  if v_estado not in ('primer_intento','reintento') then return v_estado; end if;
  v_cid := public._clase_de_practica(v_dni, p_trayecto, p_practica);
  select * into e from public.entregas_actividades where clase_id = v_cid and estudiante_user = v_dni;
  if v_estado = 'primer_intento' then
    v_nota := p_puntaje;
    v_resp := jsonb_build_object('origen','plataforma de prácticas','practica',p_practica,'nota_auto',v_nota::text,'reintentos_usados',0,
               'historial', jsonb_build_array(jsonb_build_object('intento',1,'puntaje',p_puntaje,'fecha',now())), 'detalle', p_detalle);
  else
    v_nota := greatest(coalesce(nullif(trim(e.nota),'')::numeric,0), least(p_puntaje,70))::int;
    v_resp := coalesce(e.respuestas,'{}'::jsonb)
      || jsonb_build_object('nota_auto', v_nota::text,
                            'reintentos_usados', case when (v_est->>'reabierta')::boolean then coalesce((e.respuestas->>'reintentos_usados')::int,0) else coalesce((e.respuestas->>'reintentos_usados')::int,0) + 1 end,
                            'historial', coalesce(e.respuestas->'historial','[]'::jsonb) || jsonb_build_array(jsonb_build_object('intento', coalesce(jsonb_array_length(e.respuestas->'historial'),0)+1, 'puntaje',p_puntaje,'tope',70,'fecha',now())),
                            'detalle', p_detalle);
  end if;
  if e.id is null then
    insert into public.entregas_actividades (clase_id, estudiante_user, nota, respuestas, comentario_docente)
    values (v_cid, v_dni, v_nota::text, v_resp, v_auto);
  else
    update public.entregas_actividades set nota = v_nota::text, respuestas = v_resp, comentario_docente = v_auto, updated_at = now()
     where id = e.id;
  end if;
  return case when v_estado = 'primer_intento' then 'cargada' else 'recuperatorio' end;
end $f$;

-- La versión que usa el navegador: si el trayecto se corrige en el servidor, no acepta puntajes que mande el navegador.
create or replace function public.registrar_nota_practica(p_trayecto text, p_practica integer, p_puntaje integer, p_detalle jsonb default null)
returns text language plpgsql security definer set search_path = public as $f$
begin
  if exists (select 1 from public.practica_claves k where k.trayecto = p_trayecto) then return 'solo_servidor'; end if;
  return public._registrar_nota_practica(public.mi_dni(), p_trayecto, p_practica, p_puntaje, p_detalle);
end $f$;

-- Las versiones con DNI explícito solo las puede llamar el servidor (nunca el navegador)
revoke all on function public._estado_practica(text, text, integer) from public, anon, authenticated;
revoke all on function public._registrar_nota_practica(text, text, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public._estado_practica(text, text, integer) to service_role;
grant execute on function public._registrar_nota_practica(text, text, integer, integer, jsonb) to service_role;
