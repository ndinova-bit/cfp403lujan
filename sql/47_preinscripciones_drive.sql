-- =====================================================================================
-- PASO 47 — PREINSCRIPCIONES: COPIA AUTOMÁTICA EN DRIVE + TOPE POR DNI
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS del paso 46 (se puede repetir).
--
-- 1. Cada preinscripción nueva avisa a la función «subir-preinscripcion-drive», que arma el PDF
--    y lo guarda en Drive. Si el aviso o la subida fallan, la preinscripción queda igual
--    guardada en la base (Drive es una copia).
-- 2. Una misma persona (DNI) puede estar preinscripta, como máximo, en 5 trayectos por ciclo
--    (se descuentan las rechazadas). Seguía valiendo: no repetir DNI en el mismo trayecto.
-- =====================================================================================

alter table public.preinscripciones add column if not exists drive_archivo_id text;
alter table public.preinscripciones add column if not exists drive_subido_en  timestamptz;
alter table public.preinscripciones add column if not exists drive_error      text;

create extension if not exists pg_net with schema extensions;

create or replace function public.preinscripciones_avisar_drive()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform net.http_post(
      url     := 'https://dxgqtdaexlegsaohdywx.supabase.co/functions/v1/subir-preinscripcion-drive',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := jsonb_build_object('id', new.id)
    );
  exception when others then
    null;   -- nunca debe impedir que la preinscripción se guarde
  end;
  return new;
end $$;

-- El número se asigna en un update posterior al insert (ver preinscribir), por eso el aviso sale
-- cuando ya tiene número: se dispara en el update que completa «numero».
drop trigger if exists preinscripciones_drive on public.preinscripciones;
create trigger preinscripciones_drive
  after update of numero on public.preinscripciones
  for each row when (old.numero is null and new.numero is not null)
  execute function public.preinscripciones_avisar_drive();

-- preinscribir: igual que en el paso 46, con el tope de 5 trayectos por DNI y ciclo
create or replace function public.preinscribir(p_trayecto bigint, p_datos jsonb, p_web text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg   public.inscripcion_config;
  dni_  text;
  ape   text;
  nom   text;
  mail  text;
  nuevo bigint;
  num   text;
begin
  if coalesce(p_web, '') <> '' then raise exception 'No se pudo enviar la preinscripción'; end if;

  select * into cfg from public.inscripcion_config where id = 1;
  if not found or not cfg.abierta then raise exception 'La inscripción está cerrada por el momento'; end if;

  if not exists (select 1 from public.trayectos t
                  where t.id = p_trayecto and nullif(to_jsonb(t)->>'ciclo_lectivo', '')::integer = cfg.ciclo) then
    raise exception 'El trayecto elegido no está disponible para este ciclo';
  end if;

  if p_datos is null or jsonb_typeof(p_datos) <> 'object' or length(p_datos::text) > 40000 then
    raise exception 'Datos inválidos';
  end if;

  dni_ := regexp_replace(coalesce(p_datos->>'dni', ''), '\D', '', 'g');
  ape  := upper(trim(coalesce(p_datos->>'apellido', '')));
  nom  := trim(coalesce(p_datos->>'nombre', ''));
  mail := nullif(lower(trim(coalesce(p_datos->>'email', ''))), '');
  if dni_ !~ '^[0-9]{6,9}$' then raise exception 'El DNI debe tener entre 6 y 9 números, sin puntos'; end if;
  if ape = '' or nom = '' then raise exception 'Completá apellido y nombre'; end if;
  if mail is not null and mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El correo electrónico no es válido'; end if;

  if (select count(*) from public.preinscripciones where created_at > now() - interval '10 minutes') > 150 then
    raise exception 'Hay demasiadas solicitudes en este momento. Probá de nuevo en unos minutos';
  end if;

  if exists (select 1 from public.preinscripciones
              where trayecto_id = p_trayecto and dni = dni_ and estado <> 'rechazada') then
    raise exception 'Ya existe una preinscripción con ese DNI para este trayecto';
  end if;

  if (select count(*) from public.preinscripciones
       where ciclo = cfg.ciclo and dni = dni_ and estado <> 'rechazada') >= 5 then
    raise exception 'Este DNI ya tiene 5 preinscripciones en este ciclo. Consultá en el CFP si necesitás cambiar alguna';
  end if;

  insert into public.preinscripciones (ciclo, trayecto_id, dni, apellido, nombre, email, datos)
  values (cfg.ciclo, p_trayecto, dni_, left(ape, 80), left(nom, 80), mail, p_datos)
  returning id into nuevo;

  num := 'P' || cfg.ciclo || '-' || lpad(nuevo::text, 4, '0');
  update public.preinscripciones set numero = num where id = nuevo;
  return jsonb_build_object('numero', num);
end $$;
revoke all on function public.preinscribir(bigint, jsonb, text) from public;
grant execute on function public.preinscribir(bigint, jsonb, text) to anon, authenticated;

-- Verificación: tiene que aparecer el trigger y las 3 columnas
select 'trigger' as tipo, tgname::text as nombre from pg_trigger where tgname = 'preinscripciones_drive'
union all
select 'columna', column_name::text from information_schema.columns
 where table_name = 'preinscripciones' and column_name like 'drive_%';
