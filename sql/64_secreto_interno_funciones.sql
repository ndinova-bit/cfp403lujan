-- 64 · Clave compartida entre la base (trigger y cron) y las Edge Functions que no usan JWT
-- (subir-preinscripcion-drive y resguardo-semanal). Se genera acá adentro: nadie la ve ni la tipea.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'secreto_interno_funciones') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'secreto_interno_funciones',
      'Clave compartida entre la base (trigger y cron) y las Edge Functions sin JWT'
    );
  end if;
end $$;

create or replace function public.secreto_interno()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'secreto_interno_funciones' limit 1;
$$;

revoke all on function public.secreto_interno() from public, anon, authenticated;
grant execute on function public.secreto_interno() to service_role;

-- El trigger de preinscripciones y el cron del resguardo mandan esa clave en el encabezado x-internal-secret
create or replace function public.preinscripciones_avisar_drive()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  begin
    perform net.http_post(
      url     := 'https://dxgqtdaexlegsaohdywx.supabase.co/functions/v1/subir-preinscripcion-drive',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', public.secreto_interno()),
      body    := jsonb_build_object('id', new.id)
    );
  exception when others then
    null;
  end;
  return new;
end $function$;

select cron.alter_job(1, command := $cmd$
  select net.http_post(
    url := 'https://dxgqtdaexlegsaohdywx.supabase.co/functions/v1/resguardo-semanal',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', public.secreto_interno()),
    body := '{}'::jsonb);
$cmd$);
