-- 67 · Preinscripción pública: límite por conexión (sin servicios externos).
-- Se guarda solo un hash de la conexión, nunca la IP. El tope global pasa de 150 a 300 cada 10 minutos
-- porque ahora el freno principal es por conexión.

alter table public.preinscripciones add column if not exists ip_hash text;
create index if not exists preinscripciones_ip_hash_idx on public.preinscripciones (ip_hash, created_at);

create or replace function public.preinscribir(p_trayecto bigint, p_datos jsonb, p_web text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cfg   public.inscripcion_config;
  dni_  text;
  ape   text;
  nom   text;
  mail  text;
  nuevo bigint;
  num   text;
  hdr   jsonb;
  ip_   text;
  iph   text;
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

  -- Origen de la conexión: el encabezado de Cloudflare no se puede falsificar desde el navegador
  begin
    hdr := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    hdr := '{}'::jsonb;
  end;
  ip_ := coalesce(
           nullif(trim(hdr->>'cf-connecting-ip'), ''),
           nullif(trim(split_part(coalesce(hdr->>'x-forwarded-for', ''), ',', 1)), '')
         );
  if ip_ is not null then
    iph := encode(extensions.digest(ip_ || ':cfp403-preinscripcion', 'sha256'), 'hex');
  end if;

  if iph is not null then
    if (select count(*) from public.preinscripciones where ip_hash = iph and created_at > now() - interval '10 minutes') >= 8 then
      raise exception 'Se enviaron demasiadas solicitudes desde tu conexión. Probá de nuevo en unos minutos';
    end if;
    if (select count(*) from public.preinscripciones where ip_hash = iph and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'Se alcanzó el máximo de solicitudes por hora desde tu conexión. Probá más tarde';
    end if;
  end if;
  if (select count(*) from public.preinscripciones where created_at > now() - interval '10 minutes') > 300 then
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
  insert into public.preinscripciones (ciclo, trayecto_id, dni, apellido, nombre, email, datos, ip_hash)
  values (cfg.ciclo, p_trayecto, dni_, left(ape, 80), left(nom, 80), mail, p_datos, iph)
  returning id into nuevo;
  num := 'P' || cfg.ciclo || '-' || lpad(nuevo::text, 4, '0');
  update public.preinscripciones set numero = num where id = nuevo;
  return jsonb_build_object('numero', num);
end $function$;
